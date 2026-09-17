/**
 * Google Places (New) lookup for a named venue's photo.
 *
 * The key lives only on the server. Both the `/api/venue-photo` route and the
 * board builder call this, so a demo that asks for Pikes twice in one session
 * pays for it once.
 */

export type VenuePhotoHit = {
  found: true;
  src: string;
  name: string;
};

export type VenuePhotoMiss = { found: false };

export type VenuePhotoResult = VenuePhotoHit | VenuePhotoMiss;

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

/** Card art, not a hero. Matches the size the scrapbook actually paints. */
const PHOTO_WIDTH = 800;

const LOOKUP_TIMEOUT_MS = 6_000;

/**
 * Only these fields. Google bills a Text Search at the dearest SKU of any
 * field in the mask, so asking for rating or hours here would multiply the
 * cost of every board.
 */
const FIELD_MASK = 'places.id,places.displayName,places.photos';

const cache = new Map<string, VenuePhotoResult>();

function cacheKey(name: string, location: string): string {
  return `${name.trim().toLowerCase()}|${location.trim().toLowerCase()}`;
}

function textQuery(name: string, location: string): string {
  const venue = name.trim();
  const place = location.trim();
  if (!place) return venue;
  // "Pikes Ibiza, Ibiza" is how the Text Search docs expect a named venue
  // qualified by where it is. Skip the suffix when the name already carries it.
  if (venue.toLowerCase().includes(place.toLowerCase())) return venue;
  return `${venue}, ${place}`;
}

async function readError(response: Response): Promise<string> {
  const body = await response.text();
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    return parsed.error?.message ?? body;
  } catch {
    return body;
  }
}

interface PlaceSearchResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    photos?: { name?: string }[];
  }[];
}

/**
 * Resolves a Places photo resource name to a hotlinkable image URL.
 *
 * `skipHttpRedirect` returns JSON with `photoUri` rather than the bytes, which
 * is what an <img src> needs. The key goes in a header, not the query string,
 * so it does not land in access logs.
 */
async function resolvePhotoUri(
  key: string,
  photoName: string,
): Promise<string | null> {
  const media = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  media.searchParams.set('maxWidthPx', String(PHOTO_WIDTH));
  media.searchParams.set('skipHttpRedirect', 'true');
  // Place Photos (New) is a GET and Google's own examples put the key on the
  // query string. The key still never leaves this process.
  media.searchParams.set('key', key);

  const response = await fetch(media, {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });

  if (!response.ok) {
    console.warn(
      '[venuePhoto] Place Photos returned',
      response.status,
      await readError(response),
    );
    return null;
  }

  const { photoUri } = (await response.json()) as { photoUri?: string };
  return photoUri?.trim() || null;
}

/**
 * Best photo of a named venue, or `{ found: false }` when there is none.
 *
 * Never throws: a missing photo is the normal case, and the board already
 * knows how to pin a written card instead. Transport failures are logged and
 * treated the same as a miss, but they are not cached, so a missing key or a
 * 403 can be retried after the console is fixed.
 */
export async function lookupVenuePhoto(
  name: string,
  location = '',
): Promise<VenuePhotoResult> {
  const venue = name.trim();
  if (!venue) return { found: false };

  const key = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!key) {
    console.warn('[venuePhoto] GOOGLE_PLACES_API_KEY is empty; skipping lookup');
    return { found: false };
  }

  const cached = cache.get(cacheKey(venue, location));
  if (cached) return cached;

  try {
    const response = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
        'x-goog-fieldmask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: textQuery(venue, location),
        pageSize: 1,
      }),
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(
        '[venuePhoto] Text Search returned',
        response.status,
        await readError(response),
      );
      return { found: false };
    }

    const { places = [] } = (await response.json()) as PlaceSearchResponse;
    const place = places[0];
    const photoName = place?.photos?.[0]?.name;
    const displayName = place?.displayName?.text?.trim() || venue;

    if (!photoName) {
      const miss: VenuePhotoMiss = { found: false };
      cache.set(cacheKey(venue, location), miss);
      return miss;
    }

    const src = await resolvePhotoUri(key, photoName);
    if (!src) return { found: false };

    const hit: VenuePhotoHit = { found: true, src, name: displayName };
    cache.set(cacheKey(venue, location), hit);
    return hit;
  } catch (error) {
    console.warn('[venuePhoto] lookup failed for', venue, error);
    return { found: false };
  }
}
