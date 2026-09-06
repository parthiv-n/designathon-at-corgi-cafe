import { unsplashUrlFor } from './vibeBoard';

/**
 * Finds a real photo of a real place.
 *
 * Unsplash retired its keyword endpoint and its Search API needs a key this
 * project does not have, which is why every card used to fall back to the same
 * eight moody stock photos -- a Tokyo alley standing in for a brewery in the
 * Finger Lakes. Wikimedia Commons needs no key and, because the director is
 * told to name actual places, its search is a good match: query "Watkins Glen
 * State Park" and you get Watkins Glen State Park.
 *
 * Coverage is the trade-off. Landmarks, parks and neighbourhoods resolve well;
 * a three-month-old natural wine bar will not, and those fall back to the
 * curated set, which is why `unsplashUrlFor` is still here.
 */

const COMMONS_ENDPOINT = 'https://commons.wikimedia.org/w/api.php';

/** The scrape and the model already cost seconds; photos must not add many. */
const LOOKUP_TIMEOUT_MS = 6_000;

/** Card art, not wallpaper. */
const THUMB_WIDTH = 900;

/**
 * Process-wide and unbounded on purpose: keys are place names, a single session
 * produces a few dozen, and the process is a dev server or a serverless worker
 * that gets recycled long before this matters.
 */
const cache = new Map<string, string | null>();

/** Commons is full of maps, plaques and logos; none of them read as a photo. */
const REJECTED_TITLE = /\b(map|logo|seal|coat of arms|diagram|plaque|sign|chart|flag)\b/i;

interface CommonsPage {
  title?: string;
  imageinfo?: { thumburl?: string; url?: string; mime?: string }[];
  index?: number;
}

async function searchCommons(query: string): Promise<string | null> {
  const endpoint = new URL(COMMONS_ENDPOINT);
  endpoint.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '6',
    // Namespace 6 is File:, so the generator returns media rather than articles.
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|mime',
    iiurlwidth: String(THUMB_WIDTH),
    format: 'json',
    origin: '*',
  }).toString();

  const response = await fetch(endpoint, {
    headers: { 'user-agent': 'designathon-at-corgi-cafe/0.1 (scrapbook demo)' },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    // Place photos do not change; let Next reuse them across requests.
    next: { revalidate: 86_400 },
  });

  if (!response.ok) throw new Error(`Commons responded ${response.status}`);

  const json = (await response.json()) as {
    query?: { pages?: Record<string, CommonsPage> };
  };

  const pages = Object.values(json.query?.pages ?? {})
    // The generator returns pages in hash order; `index` is the ranking.
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));

  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const url = info?.thumburl ?? info?.url;

    if (!url) continue;
    if (info?.mime && !info.mime.startsWith('image/')) continue;
    // SVGs on Commons are almost always diagrams or logos.
    if (info?.mime === 'image/svg+xml') continue;
    if (page.title && REJECTED_TITLE.test(page.title)) continue;

    return url;
  }

  return null;
}

/**
 * Best photo for one place, or the curated fallback. Never throws -- a card
 * with a slightly-off photo beats a card with a hole in it.
 */
export async function resolvePlaceImage(
  query: string,
  fallbackKey: string,
): Promise<string> {
  const key = query.trim().toLowerCase();
  const fallback = unsplashUrlFor(fallbackKey);

  if (!key) return fallback;

  if (cache.has(key)) {
    return cache.get(key) ?? fallback;
  }

  try {
    const found = await searchCommons(key);
    cache.set(key, found);
    return found ?? fallback;
  } catch (error) {
    console.warn('[placePhotos] lookup failed for', key, error);
    // Not cached: a timeout now says nothing about the next attempt.
    return fallback;
  }
}

/**
 * Attaches a real photo to each stop. Runs the lookups together, because doing
 * four of them in series would add four round trips to a turn that already
 * spent seconds in the model.
 */
export async function withPlacePhotos<
  T extends { title: string; imageUrl: string },
>(activities: T[]): Promise<(T & { resolvedImage?: string })[]> {
  return Promise.all(
    activities.map(async activity => ({
      ...activity,
      resolvedImage: await resolvePlaceImage(activity.title, activity.imageUrl),
    })),
  );
}
