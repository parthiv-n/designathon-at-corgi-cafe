import type { PhotoCredit } from './vibeBoard';

/**
 * The only file that talks to the Unsplash API.
 *
 * Search is the whole point: the director names real places ("Omoide Yokocho",
 * "Watkins Glen State Park") and Unsplash usually has a photograph of exactly
 * that, which is what a card needs. It runs server-side only -- the access key
 * is never shipped to the browser.
 */

const SEARCH_ENDPOINT = 'https://api.unsplash.com/search/photos';

/** Matches the Commons budget. The model already spent seconds; photos may not. */
const LOOKUP_TIMEOUT_MS = 6_000;

/**
 * Ask for a handful rather than one. Costs the same single request, and the
 * top result occasionally has no usable `urls.regular`.
 */
const CANDIDATES = 5;
const BACKDROP_CANDIDATES = 10;

/** Photos of places do not change; a day of reuse also protects the rate limit. */
const REVALIDATE_SECONDS = 86_400;

export interface UnsplashPhoto {
  /** `urls.regular`, hotlinked as the API guidelines require. */
  src: string;
  alt?: string;
  /** Photographer-written caption, often more specific than `alt`. */
  description?: string;
  credit: PhotoCredit;
}

interface UnsplashSearchResponse {
  results?: {
    id?: string;
    alt_description?: string | null;
    description?: string | null;
    urls?: { regular?: string };
    links?: { download_location?: string };
    user?: { name?: string; links?: { html?: string } };
  }[];
}

/**
 * Stable id for "is this the same photograph?" Crop and size query params
 * change between card and backdrop URLs, so those must not count as different.
 */
export function photoIdentity(src: string): string {
  try {
    const url = new URL(src);
    const unsplash = url.pathname.match(/photo-[\w-]+/i);
    if (unsplash) return `unsplash:${unsplash[0].toLowerCase()}`;
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return src.trim().toLowerCase();
  }
}

function authHeaders(accessKey: string): HeadersInit {
  return {
    Authorization: `Client-ID ${accessKey}`,
    // Pinning the version stops a future default from reshaping the payload.
    'Accept-Version': 'v1',
  };
}

/**
 * Tells Unsplash the photo was actually used.
 *
 * Required by the API guidelines -- it is what credits the photographer for
 * the use, separately from the view they get from hotlinking. Fire and forget:
 * a failed ping must never cost us the photo.
 */
function triggerDownload(downloadLocation: string, accessKey: string): void {
  void fetch(downloadLocation, {
    headers: authHeaders(accessKey),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    // Every use is its own event, so this one must not be served from cache.
    cache: 'no-store',
  }).catch(error => {
    console.warn('[unsplash] download ping failed:', error);
  });
}

/**
 * Best photo for a search term, or null when Unsplash has nothing to offer.
 *
 * Returns null rather than throwing for the two expected "no photo" cases --
 * no key configured, and an empty result set -- so the caller falls through to
 * the next source. Genuine faults still throw, so they get logged as faults.
 */
export async function searchUnsplashPhoto(
  query: string,
  options: {
    /** Skip photos already used on the scrapbook so a backdrop is never a card. */
    exclude?: Set<string>;
    orientation?: 'landscape' | 'portrait' | 'squarish';
  } = {},
): Promise<UnsplashPhoto | null> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  const trimmed = query.trim();

  // No key is a normal configuration, not an error: the chain still has
  // Commons and the curated set behind it.
  if (!accessKey || !trimmed) return null;

  const params = new URLSearchParams({
    query: trimmed,
    per_page: String(options.exclude?.size ? BACKDROP_CANDIDATES : CANDIDATES),
    // The board is built from someone's holiday photo; keep it safe for a demo.
    content_filter: 'high',
  });
  if (options.orientation) params.set('orientation', options.orientation);

  const endpoint = new URL(SEARCH_ENDPOINT);
  endpoint.search = params.toString();

  const response = await fetch(endpoint, {
    headers: authHeaders(accessKey),
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });

  // How Unsplash reports a spent rate limit. Demo apps get 50 requests an hour
  // and a board costs three, so this is reachable on a busy afternoon. Called
  // out loudly because the symptom otherwise is "the photos quietly got worse".
  if (response.status === 403) {
    console.warn(
      '[unsplash] 403 -- hourly rate limit spent (demo apps get 50/hour). Falling back to Commons until it resets.',
    );
    return null;
  }

  if (!response.ok) {
    throw new Error(`Unsplash responded ${response.status}`);
  }

  const json = (await response.json()) as UnsplashSearchResponse;

  const photo = json.results?.find(result => {
    if (typeof result?.urls?.regular !== 'string') return false;
    if (!options.exclude?.size) return true;
    return !options.exclude.has(photoIdentity(result.urls.regular));
  });

  if (!photo?.urls?.regular) return null;

  if (photo.links?.download_location) {
    triggerDownload(photo.links.download_location, accessKey);
  }

  return {
    src: photo.urls.regular,
    alt: photo.alt_description ?? undefined,
    description: photo.description ?? undefined,
    credit: {
      name: photo.user?.name ?? 'an Unsplash photographer',
      profileUrl: photo.user?.links?.html ?? 'https://unsplash.com',
    },
  };
}
