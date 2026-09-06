import { z } from 'zod';

// Model selection lives in ./modelChain.ts (MODEL_CHAIN), which both flows
// fall through on 503s. Gemini handles both photo analysis and the chat
// director -- there is no OpenAI key in this project.

/**
 * A required string the model is still guided towards, but whose absence
 * cannot fail the call.
 *
 * Gemini drops a field from one object in an array often enough to matter --
 * an activity with a cost, a description and no `title` -- and a plain
 * `z.string()` turns that single omission into a rejected tool call and an
 * empty board. `.catch('')` degrades it to an empty string instead; the
 * description and the "required" flag both survive into the JSON schema the
 * model sees, so this costs nothing in output quality. Callers drop the
 * entries that came back nameless via `usableActivities`.
 */
function guided(description: string) {
  return z.string().catch('').describe(description);
}

/** A single stop on the board. One shape, reused by every tool. */
export const activitySchema = z.object({
  title: guided('Name of the place or activity'),
  description: guided('One sentence explaining why this fits the vibe'),
  cost: guided('Rough price, e.g. "$$", "Free", "$15"'),
  placeType: guided(
    'A short category for this place, e.g. "cafe", "attraction", "hike", "restaurant", "bar", or "gallery". Never include travel time or transport.',
  ),
  imageUrl: guided(
    'A short lowercase hyphenated fallback keyword describing the look of this place, e.g. "jazz-bar-dark". A keyword, never a URL. It is only used if no photo of the real place can be found.',
  ),
});

/** Who took a photo, and where to link them. Required by Unsplash's guidelines. */
export interface PhotoCredit {
  name: string;
  /** The photographer's Unsplash profile, un-tagged. Run it through `withUnsplashUtm`. */
  profileUrl: string;
}

export type Activity = z.infer<typeof activitySchema> & {
  /**
   * A real photo of this place, filled in server-side by the lookup chain in
   * ./placePhotos. Not part of the schema -- the model never writes it.
   */
  resolvedImage?: string;
  /**
   * Set only when `resolvedImage` came from Unsplash search; Commons photos and
   * the curated fallbacks carry no photographer we can name.
   */
  resolvedCredit?: PhotoCredit;
};

/**
 * Field contents are deliberately loose (plain strings with descriptions
 * rather than a /^#[0-9a-f]{6}$/ regex) so a slightly-off model response
 * cannot throw a Zod error mid-demo. Shape is strict, contents are guided.
 */
export const vibeBoardSchema = z.object({
  originalImage: z
    .string()
    .describe('The exact image URL you were given, copied verbatim'),
  vibeSummary: z
    .string()
    .describe(
      'A punchy 3-5 word description of the aesthetic, e.g. "Neon Cyberpunk Night"',
    ),
  // `.length(3)` is left off both arrays on purpose. The prompt and these
  // descriptions ask for three, but a model that returns two or four should
  // give a slightly-off board rather than no board: normalizePalette pads the
  // palette, and the layout has slots for extra stops. An exact-length rule
  // here only converts a small miscount into a total failure.
  colorPalette: z
    .array(z.string())
    .catch([])
    .describe(
      'Exactly three hex colour codes drawn from the photo, e.g. "#1a0b2e"',
    ),
  activities: z
    .array(activitySchema)
    .catch([])
    .describe('Exactly three stops that match the vibe'),
});

export type VibeBoardData = z.infer<typeof vibeBoardSchema>;

/** What the scrape read off the post itself, as opposed to what the model made of it. */
export interface PostDetails {
  /** The post's own words. Rendered on the board when there are any. */
  caption?: string;
  /** e.g. "nationalparksguide". */
  author?: string;
  /** Instagram's own alt text, when it wrote one. */
  altText?: string;
  /** Tagged place, when the post has one. */
  place?: string;
  /**
   * Photo URL -> the place the caption names for that frame, for posts whose
   * caption is a numbered legend. See `parseCaptionLegend`.
   */
  photoLabels?: Record<string, string>;
}

/**
 * Pulls a numbered legend out of a caption.
 *
 * Carousel posts very often caption themselves as an index rather than prose:
 *
 *     Japanese Greenery Collection.
 *
 *     1 Narai jyuku, Nagano
 *     2 Otagi Nenbutsuji temple, Kyoto
 *     3-4 Nagano
 *
 * That is the only place the name of each photo exists, so without this a
 * twenty-frame carousel becomes twenty scraps labelled "pinned". Returns a
 * 1-based index -> label map; a range covers every frame it spans.
 *
 * Accepts "1", "1.", "1)", "1:" and "1 -", and ranges written with a hyphen,
 * en dash or em dash.
 */
export function parseCaptionLegend(
  caption: string | undefined,
): Record<number, string> {
  if (!caption) return {};

  const line =
    /^\s*(\d{1,2})\s*(?:[-–—]\s*(\d{1,2}))?\s*[.):\-–—]?\s+(\S.*?)\s*$/;
  const legend: Record<number, string> = {};
  let matched = 0;

  for (const raw of caption.split(/\r?\n/)) {
    const found = raw.match(line);
    if (!found) continue;

    const label = found[3].replace(/\s*#[\wÀ-￿]+/g, '').trim();
    // A line that was nothing but hashtags, or a bare number, names nothing.
    if (label.length === 0) continue;

    const from = Number(found[1]);
    const to = found[2] ? Number(found[2]) : from;
    // Backwards or absurd ranges are a misparse, not a legend.
    if (to < from || to - from > 20) continue;

    for (let i = from; i <= to; i += 1) legend[i] = label;
    matched += 1;
  }

  // One numbered line is far more likely to be prose that opens with a figure
  // ("2 days in Kyoto...") than an index of the carousel.
  return matched >= 2 ? legend : {};
}

/**
 * What the Instagram action streams back: the model's board, every image the
 * scraper found (which fills the rail), and what the post itself said.
 */
export type VibeBoardPayload = VibeBoardData & {
  photoBank: string[];
  post: PostDetails;
  /** Wide destination photo, never one of the scrapbook cards. */
  backdropImage?: string;
};

/** What the chat director mutates. */
export interface CanvasState {
  vibeSummary: string;
  colorPalette: string[];
  activities: Activity[];
  /** Every image pulled from the scraped post. Drives the photo bank rail. */
  photoBank: string[];
  /** Bank photos the user has clicked onto the board. */
  pinned: string[];
  /** The post's cover photo, pinned as the board's hero scrap. */
  originalImage?: string;
  /** Destination wallpaper. Must not be a photo already taped to the page. */
  backdropImage?: string;
  /** Caption, author and place, straight off the post. */
  post: PostDetails;
}

/** Nothing scraped yet: blank board, empty slots in the rail. */
export const EMPTY_CANVAS: CanvasState = {
  vibeSummary: '',
  colorPalette: ['#1f4e6b', '#e2b84a', '#8e3b4a'],
  activities: [],
  photoBank: [],
  pinned: [],
  post: {},
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * streamUI hands the client a ReactNode, which a hook cannot read values back
 * out of. So tools emit one of these onto a parallel streamable channel and
 * the client folds them into state with applyCanvasPatch.
 */
export type CanvasPatch =
  | { type: 'theme'; vibeSummary: string; colorPalette: string[] }
  | { type: 'swap'; index: number; activity: Activity; backdropImage?: string }
  | { type: 'add'; activities: Activity[]; backdropImage?: string }
  | {
      type: 'board';
      vibeSummary: string;
      colorPalette: string[];
      activities: Activity[];
      backdropImage?: string;
    };

/** Instagram's photo CDNs. Anything else must not go through the proxy. */
export function isInstagramCdnHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === 'cdninstagram.com' ||
    host === 'instagram.com' ||
    host.endsWith('.cdninstagram.com') ||
    host.endsWith('.fbcdn.net')
  );
}

/**
 * The URL an <img> should actually point at.
 *
 * Instagram CDN URLs are signed and refused when a browser asks for them
 * directly, so those get routed through /api/ig-photo. Everything else --
 * Unsplash, and the blob: URLs the paperclip makes -- is served as given.
 */
export function displayPhotoUrl(url: string): string {
  if (!url) return url;

  try {
    if (isInstagramCdnHost(new URL(url).hostname)) {
      return `/api/ig-photo?src=${encodeURIComponent(url)}`;
    }
  } catch {
    // Not an absolute URL (a blob: or a relative path). Leave it alone.
  }

  return url;
}

export const DEFAULT_PALETTE = ['#1a0b2e', '#ff2e88', '#00e5ff'];

/**
 * Matches any Instagram permalink shape: /p/, /reel/, /reels/, /tv/, an
 * optional `username/` prefix, and any trailing query string.
 *
 * Shared so the prompt bar routes on exactly the rule the server parses with.
 * Deliberately not /g: a global regex carries lastIndex between .test() calls
 * and would fail every other submit.
 */
export const INSTAGRAM_PERMALINK_RE =
  /(?:instagram\.com|instagr\.am)\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})/i;

/** True when this prompt is a link to scrape, not a note to the director. */
export function looksLikeInstagramUrl(value: string): boolean {
  return INSTAGRAM_PERMALINK_RE.test(value);
}

/**
 * The director's reply is a ReactNode, so there is no text to put in the
 * history. This turns the patch into an assistant turn instead, which is what
 * keeps follow-ups like "make it even cheaper" in context.
 */
export function describePatch(patch: CanvasPatch): string {
  switch (patch.type) {
    case 'theme':
      return `Done — I gave your board a "${patch.vibeSummary}" feel.`;
    case 'swap':
      return `Good call — I swapped in "${patch.activity.title}" (${patch.activity.cost}, ${patch.activity.placeType}).`;
    case 'add':
      return `Absolutely — I added ${patch.activities.map(a => `"${a.title}"`).join(', ')} to your page.`;
    case 'board':
      return `Fresh start! I rebuilt your board with a "${patch.vibeSummary}" feel: ${patch.activities.map(a => a.title).join(', ')}.`;
    default:
      return 'All set — I updated your board.';
  }
}

/**
 * Drops stops the model left nameless.
 *
 * The title is the one field a card cannot do without: it is the label on the
 * scrap and the query that finds a photo of the place. `guided()` lets a
 * missing one through as '' rather than failing the whole board, so this is
 * where those entries actually get discarded.
 */
export function usableActivities<T extends { title: string }>(
  activities: T[] | undefined,
): T[] {
  return (activities ?? []).filter(
    activity => typeof activity?.title === 'string' && activity.title.trim() !== '',
  );
}

/** Pads or trims to exactly three entries so the UI never gets a short array. */
export function normalizePalette(
  next: string[] | undefined,
  fallback: string[] = DEFAULT_PALETTE,
): string[] {
  const source = next?.filter(c => typeof c === 'string' && c.length > 0) ?? [];
  return [0, 1, 2].map(i => source[i] ?? fallback[i] ?? DEFAULT_PALETTE[i]);
}

/** Pure reducer, kept out of the hook so it stays testable. */
export function applyCanvasPatch(
  state: CanvasState,
  patch: CanvasPatch,
): CanvasState {
  switch (patch.type) {
    case 'theme':
      return {
        ...state,
        vibeSummary: patch.vibeSummary,
        colorPalette: normalizePalette(patch.colorPalette, state.colorPalette),
      };

    case 'swap': {
      if (patch.index < 0 || patch.index >= state.activities.length) {
        return state;
      }
      const activities = [...state.activities];
      activities[patch.index] = patch.activity;
      return {
        ...state,
        activities,
        backdropImage: patch.backdropImage ?? state.backdropImage,
      };
    }

    case 'add': {
      const existing = new Set(
        state.activities.map(a => a.title.toLowerCase()),
      );
      // The director will happily suggest a place already on the page.
      const fresh = (patch.activities ?? []).filter(
        a => !existing.has(a.title.toLowerCase()),
      );
      if (fresh.length === 0) return state;
      return {
        ...state,
        activities: [...state.activities, ...fresh],
        backdropImage: patch.backdropImage ?? state.backdropImage,
      };
    }

    case 'board':
      // Spread rather than rebuild. A whole-board pivot rewrites the itinerary,
      // but the photo bank, the pinned scraps and the hero photo came off
      // Instagram and must survive it.
      return {
        ...state,
        vibeSummary: patch.vibeSummary,
        colorPalette: normalizePalette(patch.colorPalette, state.colorPalette),
        activities:
          patch.activities?.length > 0 ? patch.activities : state.activities,
        backdropImage: patch.backdropImage ?? state.backdropImage,
      };

    default:
      return state;
  }
}

/**
 * Must match the application name registered at
 * unsplash.com/oauth/applications -- Unsplash reconciles referral traffic
 * against it, so a mismatch means the photographer is not credited for it.
 */
export const UNSPLASH_APP_NAME = 'designathon_at_corgi_cafe';

/**
 * Every link back to Unsplash has to carry these. Guideline, not decoration:
 * it is how a photographer sees that their work sent someone their way.
 */
export function withUnsplashUtm(url: string): string {
  try {
    const tagged = new URL(url);
    tagged.searchParams.set('utm_source', UNSPLASH_APP_NAME);
    tagged.searchParams.set('utm_medium', 'referral');
    return tagged.toString();
  } catch {
    // Not an absolute URL. Nothing useful to tag, and a credit line that
    // renders is better than one that throws.
    return url;
  }
}

export const UNSPLASH_HOME_URL = withUnsplashUtm('https://unsplash.com/');

/**
 * Last resort, below Unsplash search and Commons in ./placePhotos.
 *
 * Unsplash retired source.unsplash.com, so keyword URLs no longer resolve.
 * This maps a keyword onto a stable photo from a curated moody-travel set: the
 * image will not match the keyword, but it always loads, which is the only job
 * it has once both searches have come up empty.
 */
const UNSPLASH_FALLBACKS = [
  'photo-1502920917128-1aa500764cbd',
  'photo-1503899036084-c55cdd92da26',
  'photo-1493976040374-85c8e12f0c0e',
  'photo-1533050487297-09b450131914',
  'photo-1480796927426-f609979314bd',
  'photo-1513635269975-59663e0ac1ad',
  'photo-1526481280693-3bfa7568e0f3',
  'photo-1536098561742-ca998e48cbcc',
];

export function unsplashUrlFor(keyword: string, width = 1200): string {
  let hash = 0;
  for (const char of keyword) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  const id = UNSPLASH_FALLBACKS[Math.abs(hash) % UNSPLASH_FALLBACKS.length];
  return `https://images.unsplash.com/${id}?q=80&w=${width}&auto=format&fit=crop`;
}

/** Handy for a "see more" link, since the keyword is a search term. */
export function unsplashSearchUrl(keyword: string): string {
  return withUnsplashUtm(
    `https://unsplash.com/s/photos/${encodeURIComponent(keyword)}`,
  );
}

/**
 * Served when RapidAPI fails, rate-limits, times out, or has no key.
 *
 * Six frames rather than one, so the photo bank still fills on the fallback
 * path: a rail holding a single chip reads as broken on stage.
 *
 * No `auto=format` on these URLs -- that makes Unsplash negotiate WebP, and we
 * declare them as image/jpeg when handing them to Gemini.
 */
export const MOCK_POST = {
  imageUrls: UNSPLASH_FALLBACKS.slice(0, 6).map(
    id => `https://images.unsplash.com/${id}?q=80&w=1600&fm=jpg&fit=crop`,
  ),
  details: {
    caption: 'Late night wandering under the neon lights. #tokyo #cyberpunk',
    author: 'corgi.cafe',
  } as PostDetails,
};

/**
 * Last line of defence for the Instagram flow: shown when every model in the
 * chain is congested, so the board still renders instead of throwing a 500.
 */
export const FALLBACK_VIBE_BOARD: VibeBoardData = {
  originalImage: MOCK_POST.imageUrls[0],
  vibeSummary: 'Neon Cyberpunk Night',
  colorPalette: ['#12071f', '#ff2e88', '#00e5ff'],
  activities: [
    {
      title: 'Omoide Yokocho',
      description:
        'Smoke, red lanterns and six-seat counters echo the alley in the photo.',
      cost: '$$',
      placeType: 'restaurant',
      imageUrl: 'tokyo-alley-lanterns',
    },
    {
      title: 'Shibuya Crossing Overpass',
      description:
        'The screen glow gives you the same magenta-on-black contrast at scale.',
      cost: 'Free',
      placeType: 'attraction',
      imageUrl: 'shibuya-crossing-night',
    },
    {
      title: 'Golden Gai Listening Bar',
      description: 'Low light and vinyl to land the night somewhere quieter.',
      cost: '$$',
      placeType: 'bar',
      imageUrl: 'jazz-bar-dark',
    },
  ],
};

/** Served when the Gemini call fails, so a rate limit still mutates the board. */
export const FALLBACK_SWAP_ACTIVITY: Activity = {
  title: '$5 Street Food Market',
  description:
    'Skewers and steam under paper lanterns keeps the neon mood without the cocktail bar tab.',
  cost: '$5',
  placeType: 'food market',
  imageUrl: 'street-food-night-market',
};
