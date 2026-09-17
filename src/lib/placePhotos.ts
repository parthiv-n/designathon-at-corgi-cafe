import { foodSearchQueries, outfitSearchQueries } from './inspoQueries';
import { photoIdentity, searchUnsplashPhoto } from './unsplash';
import {
  isFoodOrDrinkStop,
  type Activity,
  type FillerKind,
  type FillerPhoto,
  type PhotoCredit,
} from './vibeBoard';
import { lookupVenuePhoto } from './venuePhoto';

/**
 * Finds a real photo of a real place.
 *
 * Named stops -- "Pikes Ibiza", "Cédric Grolet Opéra" -- go through Google
 * Places. That is a photo of the actual venue, which is the only kind of
 * picture that belongs on a card labelled with that name. A miss is a miss:
 * we do not then search Unsplash for a generic cocktail, because that is how
 * a bar card ended up with a stranger's doorway.
 *
 * Destination-level pictures (the fillers that top a thin board up, the
 * wallpaper) still come from Unsplash and Commons. Those are not tied to one
 * business, so a wide shot of the city is an honest caption.
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

type CommonsHit = { src: string; title?: string };

/**
 * A short name for what a photograph is of.
 *
 * Unsplash captions are sentences ("The Eiffel Tower in Paris at sunset").
 * The slip under the print only has room for the place, and the destination
 * is already in the letter beads, so that city name is the first thing to go.
 */
export function labelFromCaption(
  caption: string | undefined,
  destination: string,
): string {
  if (!caption?.trim()) return '';

  const dest = destination.trim().toLowerCase();
  const destWords = new Set(dest.split(/\s+/).filter(Boolean));

  let text = caption
    .toLowerCase()
    .replace(/^file:/i, '')
    .replace(/\.[a-z0-9]{2,4}$/i, '')
    .replace(/[_./\\|]+/g, ' ')
    .replace(
      /\b(photo|image|picture|pic|wallpaper|shot|jpg|jpeg|png|hd|4k|uhd)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();

  if (dest) {
    const escaped = dest.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), ' ');
    text = text.replace(/\s+/g, ' ').trim();
  }

  const skip = new Set([
    'a',
    'an',
    'the',
    'of',
    'in',
    'at',
    'on',
    'to',
    'and',
    'with',
    'from',
    'during',
    'near',
    'over',
    'under',
    'by',
    'its',
    'this',
    'that',
  ]);

  const words = text
    .split(' ')
    .map((word) => word.replace(/^[^a-z0-9à-ÿ]+|[^a-z0-9à-ÿ]+$/gi, ''))
    .filter((word) => word.length > 1 && !skip.has(word) && !destWords.has(word));

  if (words.length === 0) return '';

  return words.slice(0, 3).join(' ');
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
): Promise<CommonsHit | null> {
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

    return { src: url, title: page.title };
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
      const photo: ResolvedPhoto = { src: found.src };
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
 * Attaches a photo to each named stop.
 *
 * Food and bars stay Places-only: a stock plate is not that restaurant.
 * Parks, villages, towers and beaches may fall through to Unsplash/Commons
 * under the place's own name, so a cool location still gets a print.
 */
export async function withPlacePhotos<
  T extends { title: string; imageUrl: string; placeType?: string },
>(
  activities: T[],
  destination?: string,
): Promise<(T & { resolvedImage?: string; resolvedCredit?: PhotoCredit })[]> {
  const place = destination?.trim() ?? '';
  const exclude = new Set<string>();
  const resolved: (T & { resolvedImage?: string; resolvedCredit?: PhotoCredit })[] =
    [];

  for (const activity of activities) {
    const venue = await lookupVenuePhoto(activity.title, place);
    if (venue.found) {
      exclude.add(photoIdentity(venue.src));
      resolved.push({ ...activity, resolvedImage: venue.src });
      continue;
    }

    if (isFoodOrDrinkStop(activity)) {
      resolved.push({ ...activity });
      continue;
    }

    const query = [activity.title.trim(), place].filter(Boolean).join(' ');
    const stock = await searchFillerStock(query, exclude);
    if (stock) {
      exclude.add(photoIdentity(stock.src));
      resolved.push({
        ...activity,
        resolvedImage: stock.src,
        ...(stock.credit ? { resolvedCredit: stock.credit } : {}),
      });
      continue;
    }

    resolved.push({ ...activity });
  }

  return resolved;
}

/** A board this thin reads as a failure rather than a sparse arrangement. */
export const MIN_BOARD_PHOTOS = 3;

export type FillerVibe = {
  vibeSummary?: string;
  focus?: string;
  colorPalette?: string[];
};

async function searchFillerStock(
  query: string,
  exclude: Set<string>,
): Promise<{
  src: string;
  description?: string;
  alt?: string;
  credit?: PhotoCredit;
} | null> {
  try {
    const photo = await searchUnsplashPhoto(query, { exclude });
    if (photo) {
      return {
        src: photo.src,
        description: photo.description,
        alt: photo.alt,
        credit: photo.credit,
      };
    }
  } catch (error) {
    console.warn('[placePhotos] Unsplash filler lookup failed for', query, error);
  }

  try {
    const photo = await searchCommons(query, exclude);
    if (photo) return { src: photo.src, description: photo.title };
  } catch (error) {
    console.warn('[placePhotos] Commons filler lookup failed for', query, error);
  }

  return null;
}

/**
 * Photos of the destination itself, to top a thin board up to the minimum.
 *
 * Deliberately the last resort. The board's whole claim is that every print is
 * the place it is labelled as, so this only runs once the named stops have had
 * their turn, and it searches the destination rather than generic travel stock
 * -- a wide shot of Kazakhstan on a Kazakhstan board is honest, a stranger's
 * beach is not.
 *
 * After those scene queries, the same Unsplash/Commons path also pulls 1–2
 * food prints and 1–2 outfit prints so the page has something to eat and wear,
 * labelled as inspo rather than as a stop.
 */
export async function fillerPhotosFor(
  destination: string,
  activities: Array<{ resolvedImage?: string }>,
  extras: Array<string | undefined> = [],
  vibe: FillerVibe = {},
): Promise<FillerPhoto[]> {
  const place = destination.trim();
  if (!place) return [];

  const resolved = activities.filter(a => a.resolvedImage).length;
  const wanted = MIN_BOARD_PHOTOS - resolved;

  const exclude = usedIdentities(boardImageSrcs(activities, extras));
  const found: FillerPhoto[] = [];
  const usedLabels = new Set<string>();

  const take = async (
    query: string,
    kind?: FillerKind,
    fallbackLabel = '',
  ): Promise<boolean> => {
    const photo = await searchFillerStock(query, exclude);
    if (!photo) return false;
    exclude.add(photoIdentity(photo.src));
    const label = uniqueFillerLabel(
      labelFromCaption(photo.description, place) ||
        labelFromCaption(photo.alt, place) ||
        fallbackLabel,
      usedLabels,
    );
    found.push(kind ? { src: photo.src, label, kind } : { src: photo.src, label });
    return true;
  };

  // Different angles on the same place, so the top-up does not come back with
  // three near-identical postcards of one skyline. Landmarks lead because a
  // bakery board still needs named places on the prints -- "paris" three times
  // is the destination, not a caption.
  if (wanted > 0) {
    const queries = [
      `${place} landmark`,
      `${place} monument`,
      `${place} bridge`,
      `${place} street`,
      place,
    ];

    for (const query of queries) {
      if (found.filter(photo => !photo.kind).length >= wanted) break;
      await take(query);
    }
  }

  const foods = foodSearchQueries(place, vibe.vibeSummary, vibe.focus);
  const outfits = outfitSearchQueries(
    place,
    vibe.vibeSummary,
    vibe.focus,
    vibe.colorPalette,
  );

  // Interleave so a board with only two spare slots still gets one of each.
  const inspo: Array<{ query: string; kind: FillerKind; fallback: string }> = [];
  for (let i = 0; i < 2; i += 1) {
    if (foods[i]) {
      inspo.push({ query: foods[i], kind: 'food', fallback: 'food' });
    }
    if (outfits[i]) {
      inspo.push({ query: outfits[i], kind: 'outfit', fallback: 'outfit' });
    }
  }

  for (const item of inspo) {
    await take(item.query, item.kind, item.fallback);
  }

  return found;
}

/** Prefer a distinct slip; fall back to the raw caption rather than a blank. */
function uniqueFillerLabel(label: string, used: Set<string>): string {
  const trimmed = label.trim();
  if (trimmed && !used.has(trimmed)) {
    used.add(trimmed);
    return trimmed;
  }
  return trimmed;
}

/** Search term for a wide scene of the destination, not a specific stop. */
export function backdropQuery(
  vibeSummary: string,
  place?: string,
  titles: string[] = [],
  destination?: string,
): string {
  if (destination?.trim()) return `${destination.trim()} landscape`;
  const named = titles.find((title) => title.trim());
  if (named) return `${named.trim()} landscape`;
  if (vibeSummary.trim()) return `${vibeSummary.trim()} landscape`;
  if (place?.trim()) return `${place.trim()} skyline`;
  return '';
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
    if (found) return found.src;
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
  destination?: string,
): Promise<string | undefined> {
  const used = boardImageSrcs(activities, extras);
  const found = await resolveBackdropImage(
    backdropQuery(
      vibeSummary,
      place,
      activities.map((activity) => activity.title),
      destination,
    ),
    used,
  );

  // Keep the last wallpaper only when the new destination has no photo.
  return found ?? currentBackdrop;
}
