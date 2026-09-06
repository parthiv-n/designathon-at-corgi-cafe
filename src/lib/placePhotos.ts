import { photoIdentity, searchUnsplashPhoto } from './unsplash';
import type { Activity, PhotoCredit } from './vibeBoard';

/**
 * Finds a real photo of a real place. Two sources, first hit wins.
 *
 * 1. Unsplash search. The director is told to name actual places, and Unsplash
 *    is strong on them -- "Omoide Yokocho" returns the red lanterns in that
 *    Shinjuku alley. It also looks the part, which matters on a page whose
 *    whole subject is a vibe.
 * 2. Wikimedia Commons. No key, and better than Unsplash on the long tail of
 *    named landmarks: obscure state parks, small museums, minor monuments.
 * If neither source finds the place, no image is returned. Showing fewer
 * photos is preferable to presenting unrelated travel imagery as a match.
 */

/** A photo plus, when Unsplash found it, the photographer we owe a credit. */
export interface ResolvedPhoto {
  src: string;
  credit?: PhotoCredit;
}

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
const cache = new Map<string, ResolvedPhoto | null>();

/** Commons is full of maps, plaques and logos; none of them read as a photo. */
const REJECTED_TITLE = /\b(map|logo|seal|coat of arms|diagram|plaque|sign|chart|flag)\b/i;

interface CommonsPage {
  title?: string;
  imageinfo?: { thumburl?: string; url?: string; mime?: string }[];
  index?: number;
}

function usedIdentities(srcs: Array<string | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const src of srcs) {
    if (src) ids.add(photoIdentity(src));
  }
  return ids;
}

async function searchCommons(
  query: string,
  exclude?: Set<string>,
): Promise<string | null> {
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
    if (exclude?.has(photoIdentity(url))) continue;

    return url;
  }

  return null;
}

/**
 * Best photo for one place, or null when no relevant result exists. Never
 * throws: a missing card is preferable to an unrelated image.
 */
export async function resolvePlaceImage(
  query: string,
): Promise<ResolvedPhoto | null> {
  const key = query.trim().toLowerCase();

  if (!key) return null;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  // Each source gets its own try. One in a shared block would mean an Unsplash
  // timeout skipped Commons entirely, which is the opposite of a fallback.
  let failed = false;

  try {
    const found = await searchUnsplashPhoto(key);
    if (found) {
      const photo: ResolvedPhoto = { src: found.src, credit: found.credit };
      cache.set(key, photo);
      return photo;
    }
  } catch (error) {
    failed = true;
    console.warn('[placePhotos] Unsplash lookup failed for', key, error);
  }

  try {
    const found = await searchCommons(key);
    if (found) {
      const photo: ResolvedPhoto = { src: found };
      cache.set(key, photo);
      return photo;
    }
  } catch (error) {
    failed = true;
    console.warn('[placePhotos] Commons lookup failed for', key, error);
  }

  // Only cache a genuine "nobody has a photo of this". A timeout or a spent
  // rate limit says nothing about the next attempt.
  if (!failed) cache.set(key, null);

  return null;
}

/**
 * Attaches a real photo to each stop. Runs the lookups together, because doing
 * four of them in series would add four round trips to a turn that already
 * spent seconds in the model.
 */
export async function withPlacePhotos<
  T extends { title: string; imageUrl: string },
>(
  activities: T[],
): Promise<(T & { resolvedImage?: string; resolvedCredit?: PhotoCredit })[]> {
  return Promise.all(
    activities.map(async activity => {
      const photo = await resolvePlaceImage(activity.title);

      return {
        ...activity,
        ...(photo
          ? {
              resolvedImage: photo.src,
              resolvedCredit: photo.credit,
            }
          : {}),
      };
    }),
  );
}

/** Search term for a wide scene of the destination, not a specific stop. */
export function backdropQuery(
  vibeSummary: string,
  place?: string,
  titles: string[] = [],
): string {
  if (place?.trim()) return `${place.trim()} skyline`;
  if (vibeSummary.trim()) return `${vibeSummary.trim()} landscape`;
  const named = titles.find(title => title.trim());
  return named ? `${named.trim()} landscape` : '';
}

/**
 * A destination-wide photo that is not already on a card, in the bank, or
 * pinned. Returns null rather than recycling a scrapbook image.
 */
export async function resolveBackdropImage(
  query: string,
  excludeSrcs: Array<string | undefined>,
): Promise<string | null> {
  const key = query.trim();
  if (!key) return null;

  const exclude = usedIdentities(excludeSrcs);

  try {
    const found = await searchUnsplashPhoto(key, {
      exclude,
      orientation: 'landscape',
    });
    if (found) return found.src;
  } catch (error) {
    console.warn('[placePhotos] Unsplash backdrop lookup failed for', key, error);
  }

  try {
    const found = await searchCommons(key, exclude);
    if (found) return found;
  } catch (error) {
    console.warn('[placePhotos] Commons backdrop lookup failed for', key, error);
  }

  return null;
}

export function boardImageSrcs(
  activities: Array<{ resolvedImage?: string }>,
  extras: Array<string | undefined> = [],
): Array<string | undefined> {
  return [...activities.map(activity => activity.resolvedImage), ...extras];
}

export async function backdropForBoard(
  vibeSummary: string,
  activities: Activity[],
  extras: Array<string | undefined> = [],
  place?: string,
  currentBackdrop?: string,
): Promise<string | undefined> {
  const used = boardImageSrcs(activities, extras);
  if (currentBackdrop && !usedIdentities(used).has(photoIdentity(currentBackdrop))) {
    return currentBackdrop;
  }

  return (
    (await resolveBackdropImage(
      backdropQuery(
        vibeSummary,
        place,
        activities.map(activity => activity.title),
      ),
      used,
    )) ?? undefined
  );
}
