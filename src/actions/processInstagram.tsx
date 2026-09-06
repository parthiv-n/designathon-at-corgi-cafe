'use server';

import type { ReactNode } from 'react';
import {
  createStreamableValue,
  streamUI,
  type StreamableValue,
} from '@ai-sdk/rsc';

import { withModelFallback } from '../lib/modelChain';
import { withPlacePhotos } from '../lib/placePhotos';
import {
  FALLBACK_VIBE_BOARD,
  MOCK_POST,
  normalizePalette,
  vibeBoardSchema,
  type PostDetails,
  type VibeBoardPayload,
} from '../lib/vibeBoard';

const RAPIDAPI_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';

// This API fetches from Instagram live with no caching and averages ~5.2s per
// call, so a tight timeout trips on healthy requests.
const FETCH_TIMEOUT_MS = 15_000;

/** Safety net: if no tool and no text ever lands, do not leave the client hanging. */
const BOARD_CHANNEL_TIMEOUT_MS = 45_000;

/** A carousel can run to ten frames; more than this is rail spam. */
const MAX_BANK_PHOTOS = 12;

/** Vision frames sent to the model. Three reads a carousel without the latency. */
const MAX_VISION_FRAMES = 3;

/** Per-image download budget for the vision call. */
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

const SYSTEM_PROMPT = `You are an aesthetic travel planner with an eye for visual mood.

You are given one or more photos from a single Instagram post and its caption.
Read the palette, light, texture and mood across them, infer the city or
neighbourhood they were taken in, then build a short itinerary that feels like
it belongs in the same post.

Rules:
- Always call the generate_vibe_board tool exactly once. Never reply in prose.
- Copy the first image URL you were given into originalImage verbatim.
- colorPalette must be exactly three hex codes actually present in the photos.
- Give exactly three activities, ordered as a walkable day or evening.
- activities[].title must be the REAL, SPECIFIC NAME of a real place --
  "Watkins Glen State Park", "Rooster Fish Brewing", "Taughannock Falls".
  Never a description of an activity ("cozy village tavern dinner", "sunset
  pier walk"). The name is both the label printed on the card and the search
  that finds a photo of the actual place, so a description leaves the card
  with a stock photo of somewhere else entirely.
- activities[].imageUrl is only a fallback: a lowercase hyphenated keyword for
  the look of the place (e.g. "jazz-bar-dark"), never a URL.`;

interface InstagramPost {
  /** Every frame in the post, cover first. Never empty. */
  imageUrls: string[];
  /** Caption, author and place, when the post carries them. */
  details: PostDetails;
  /** True when this came from MOCK_POST rather than a live fetch. */
  isMock: boolean;
}

type MediaKind = 'post' | 'reel';

/**
 * Pulls the shortcode out of any Instagram permalink shape: /p/, /reel/,
 * /reels/, /tv/, an optional `username/` prefix, and any trailing query string.
 * The media kind matters because the scraper needs it as a query param.
 */
function parseInstagramUrl(url: string): {
  shortcode: string;
  kind: MediaKind;
} {
  const match = url.match(
    /(?:instagram\.com|instagr\.am)\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i,
  );

  if (!match) {
    throw new Error(
      `Could not find an Instagram shortcode in: ${url}. Expected something like https://www.instagram.com/p/XYZ123/`,
    );
  }

  const kind: MediaKind = match[1].toLowerCase().startsWith('reel')
    ? 'reel'
    : 'post';

  return { shortcode: match[2], kind };
}

/** Walks a list of candidate paths and returns the first non-empty string. */
function firstString(source: unknown, paths: string[][]): string | undefined {
  for (const path of paths) {
    const value = at(source, path);
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return undefined;
}

/** The image fields one media node has been seen to carry, best quality first. */
const NODE_IMAGE_PATHS: string[][] = [
  ['image_versions2', 'candidates', '0', 'url'],
  ['display_url'],
  ['image_url'],
  // display_resources runs small-to-large, so index 2 is the 1080px cut.
  ['display_resources', '2', 'src'],
  ['display_resources', '1', 'src'],
  ['display_resources', '0', 'src'],
  ['thumbnail_url'],
  ['thumbnail_src'],
];

/** Every place a payload has been seen to hang its media off the root. */
const MEDIA_ROOTS: string[][] = [[], ['data'], ['post'], ['media'], ['items', '0']];

/**
 * Reads a nested path out of a parsed JSON blob. Numeric segments work on
 * arrays too, since a["0"] and a[0] are the same lookup in JS.
 */
function at(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
    if (cursor === undefined || cursor === null) return undefined;
  }
  return cursor;
}

/**
 * Every image in the post, not just the cover: carousel frames first, then the
 * root node's own image fields.
 *
 * Scraper wrappers reshape their payloads without warning, so this probes each
 * known root rather than trusting one shape. Deduped on the URL minus its query
 * string, because the Instagram CDN appends per-request signed params and the
 * same frame otherwise lands in the rail two or three times.
 */
function collectImages(json: unknown): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const push = (value: unknown) => {
    if (typeof value !== 'string' || value.trim().length === 0) return;
    if (urls.length >= MAX_BANK_PHOTOS) return;

    let key: string;
    try {
      const parsed = new URL(value);
      // Signed CDN params differ per request; origin + path identifies the frame.
      key = `${parsed.origin}${parsed.pathname}`;
    } catch {
      return; // Not a usable URL. Drop it rather than hand it to the model.
    }

    if (seen.has(key)) return;
    seen.add(key);
    urls.push(value);
  };

  const pushNode = (node: unknown) => {
    for (const path of NODE_IMAGE_PATHS) push(at(node, path));
  };

  for (const root of MEDIA_ROOTS) {
    const node = at(json, root);
    if (!node || typeof node !== 'object') continue;

    const record = node as Record<string, unknown>;

    // Carousel frames first so they keep the order they have in the post.
    //
    // Two shapes in the wild: the mobile API's flat `carousel_media`, and the
    // web GraphQL `edge_sidecar_to_children.edges[].node`, which is what this
    // provider actually returns. Missing the second one silently turns an
    // eleven-photo carousel into a bank of one.
    const carousel = record.carousel_media;
    if (Array.isArray(carousel)) carousel.forEach(pushNode);

    const sidecar = at(node, ['edge_sidecar_to_children', 'edges']);
    if (Array.isArray(sidecar)) {
      for (const edge of sidecar) pushNode(at(edge, ['node']) ?? edge);
    }

    pushNode(node);
  }

  return urls;
}

/**
 * What the post itself says, as opposed to what the model makes of it.
 * Everything here is optional -- posts routinely have no caption or no place.
 */
function collectPostDetails(json: unknown): PostDetails {
  const caption = firstString(json, [
    ['edge_media_to_caption', 'edges', '0', 'node', 'text'],
    ['caption_text'],
    ['data', 'caption_text'],
    ['caption', 'text'],
    ['data', 'caption', 'text'],
    ['caption'],
    ['data', 'caption'],
    ['title'],
    ['description'],
  ]);

  const author = firstString(json, [
    ['owner', 'username'],
    ['data', 'owner', 'username'],
    ['user', 'username'],
    ['username'],
  ]);

  const altText = firstString(json, [
    ['accessibility_caption'],
    ['data', 'accessibility_caption'],
  ]);

  const place = firstString(json, [
    ['location', 'name'],
    ['data', 'location', 'name'],
  ]);

  return { caption, author, altText, place };
}

/**
 * Never throws. Any failure -- no key, network error, 429, timeout, or a
 * response we cannot read an image out of -- falls back to MOCK_POST so the
 * demo keeps moving.
 */
async function fetchInstagramPost(
  shortcode: string,
  kind: MediaKind,
): Promise<InstagramPost> {
  try {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      throw new Error('RAPIDAPI_KEY is not set');
    }

    // The param takes a full permalink or a bare code; the permalink is the
    // shape the provider documents, so rebuild a canonical one.
    const permalink = `https://www.instagram.com/${kind === 'reel' ? 'reel' : 'p'}/${shortcode}/`;

    const endpoint = new URL(`https://${RAPIDAPI_HOST}/get_media_data.php`);
    endpoint.searchParams.set('reel_post_code_or_url', permalink);
    endpoint.searchParams.set('type', kind);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': apiKey,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
      // Turns a hanging scraper into a caught error instead of a dead demo.
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    // Covers 429 rate limits and 4xx/5xx alike.
    if (!response.ok) {
      throw new Error(`RapidAPI responded ${response.status}`);
    }

    const json = await response.json();

    const imageUrls = collectImages(json);
    const details = collectPostDetails(json);

    if (imageUrls.length === 0) {
      // Logged so an unexpected payload shape can be mapped in one round trip
      // instead of guessing at field names.
      console.error(
        '[processInstagram] no image field found. Top-level keys were:',
        json && typeof json === 'object' ? Object.keys(json) : typeof json,
      );
      throw new Error('No usable image URL in the RapidAPI response');
    }

    console.log(
      `[processInstagram] ${shortcode}: ${imageUrls.length} image(s) scraped, author @${details.author ?? '?'}`,
    );

    return { imageUrls, details, isMock: false };
  } catch (error) {
    console.error(
      `[processInstagram] falling back to mock for ${shortcode}:`,
      error,
    );
    return { ...MOCK_POST, isMock: true };
  }
}

interface InlineImage {
  mediaType: string;
  data: Uint8Array;
}

/**
 * Downloads a photo so it can be sent to Gemini as bytes.
 *
 * Gemini will NOT go and fetch an arbitrary https URL for you: a `fileUri`
 * has to point at the File API or GCS, and anything else comes back as a flat
 * 403 PERMISSION_DENIED. So the image has to travel inline. Instagram CDN URLs
 * are signed and short-lived too, which is one more reason to read them here
 * and now rather than hand them off.
 *
 * Returns null instead of throwing -- one unreachable frame should not sink
 * the whole board.
 */
async function toInlineImage(url: string): Promise<InlineImage | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`image responded ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? '';

    return {
      // Trust the server, but only if it actually named an image type.
      mediaType: contentType.startsWith('image/') ? contentType : 'image/jpeg',
      data: new Uint8Array(buffer),
    };
  } catch (error) {
    console.warn('[processInstagram] could not download frame:', url, error);
    return null;
  }
}

export interface InstagramVibeResult {
  /** Streamed status text from the model, shown as a slip under the prompt bar. */
  ui: ReactNode;
  /** The typed board, for useCanvasController to seed the canvas from. */
  board: StreamableValue<VibeBoardPayload>;
}

/**
 * Instagram URL in, streamed vibe board out.
 *
 * Returns UI *and* a parallel data channel, the same split chatRefiner uses:
 * a client hook cannot read values back out of a rendered React tree, and the
 * scrapbook needs the board as data to lay its cards out.
 *
 * Only an unparseable URL throws; every other failure degrades to the mock.
 */
export async function processInstagramVibe(
  url: string,
): Promise<InstagramVibeResult> {
  const { shortcode, kind } = parseInstagramUrl(url);
  const post = await fetchInstagramPost(shortcode, kind);

  // Pulled in parallel, before the model call, because they have to go inline.
  const frames = (
    await Promise.all(
      post.imageUrls.slice(0, MAX_VISION_FRAMES).map(toInlineImage),
    )
  ).filter((frame): frame is InlineImage => frame !== null);

  console.log(
    `[processInstagram] ${frames.length} frame(s) downloaded for the vision call`,
  );

  const boardStream = createStreamableValue<VibeBoardPayload>();

  // .done() throws if called twice, and every exit path wants to close the
  // channel, so all of them funnel through here.
  let closed = false;
  const closeBoard = () => {
    if (closed) return;
    closed = true;
    clearTimeout(failSafe);
    boardStream.done();
  };
  const failSafe = setTimeout(closeBoard, BOARD_CHANNEL_TIMEOUT_MS);

  try {
    const result = await withModelFallback(
      model => {
        // If a previous model already emitted the board we cannot replay the
        // turn: the channel is closed and update() would throw. Bail out as a
        // non-capacity error so the chain stops here.
        if (closed) {
          throw new Error('Board channel already closed; not retrying.');
        }

        return streamUI({
          model,
          instructions: SYSTEM_PROMPT,
          // One retry per model, then fail over. Retrying a congested model
          // three times costs ~34s; switching models is near instant.
          maxRetries: 1,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: `Caption: ${post.details.caption || '(no caption)'}\n\nThis post has ${post.imageUrls.length} image(s). Copy this URL into originalImage: ${post.imageUrls[0]}`,
                },
                // Bytes, not URLs -- see toInlineImage.
                ...frames.map(frame => ({
                  type: 'file' as const,
                  mediaType: frame.mediaType,
                  data: frame.data,
                })),
              ],
            },
          ],
          // Escape hatch: if the model ignores the tool, at least show its words.
          text: ({ content, done }) => {
            if (done) closeBoard();
            return <p>{content}</p>;
          },
          tools: {
            generate_vibe_board: {
              description:
                'Build the vibe board for this photo. Call this exactly once.',
              inputSchema: vibeBoardSchema,
              generate: async function* (params) {
                yield <p>reading the vibe...</p>;

                boardStream.update({
                  ...params,
                  activities: await withPlacePhotos(params.activities),
                  // The model paraphrases URLs surprisingly often.
                  originalImage: post.imageUrls[0],
                  colorPalette: normalizePalette(params.colorPalette),
                  photoBank: post.imageUrls,
                  post: post.details,
                });
                closeBoard();

                return <p>{params.vibeSummary.toLowerCase()}</p>;
              },
            },
          },
        });
      },
      {
        onFallback: (modelId, error) =>
          console.warn(
            `[processInstagram] ${modelId} failed, trying next model:`,
            error instanceof Error ? error.message : error,
          ),
      },
    );

    return { ui: result.value, board: boardStream.value };
  } catch (error) {
    // Every model was congested. Serve the fallback board rather than a 500 --
    // the pitch keeps moving, and the bank still fills from the scrape.
    console.error(
      '[processInstagram] all models failed, serving fallback board:',
      error,
    );

    if (!closed) {
      boardStream.update({
        ...FALLBACK_VIBE_BOARD,
        originalImage: post.imageUrls[0],
        photoBank: post.imageUrls,
                  post: post.details,
      });
      closeBoard();
    }

    return {
      ui: <p>the models are busy -- here is one we had ready.</p>,
      board: boardStream.value,
    };
  }
}
