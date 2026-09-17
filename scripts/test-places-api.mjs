/**
 * Does the Google Places key actually work?
 *
 *   node scripts/test-places-api.mjs
 *
 * Not part of the app. It exists to answer one question before any Places code
 * gets written, so that the first time a board comes back without photos we
 * already know whether to suspect the key or ourselves.
 *
 * It walks the whole chain rather than stopping at the search, because the two
 * halves fail independently and only the second one matters to a scrapbook:
 * Text Search and Place Photos are enabled separately in the Cloud console,
 * and a key restricted by HTTP referrer will happily answer a search from a
 * server and then refuse the image. A photo name in the response proves
 * nothing on its own.
 *
 * Deliberately dependency-free. This is the thing you reach for when you no
 * longer trust the setup, so it should not have a setup of its own.
 */

import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VENUE = "Pikes Ibiza, Ibiza";

const KEY_NAME = "GOOGLE_PLACES_API_KEY";
const ENV_FILE = join(dirname(dirname(fileURLToPath(import.meta.url))), ".env.local");

/** Big enough to be a real card image, small enough to download in a moment. */
const PHOTO_WIDTH = 800;

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

const pass = (message) => console.log(`  ok    ${message}`);
const fail = (message) => console.log(`  FAIL  ${message}`);
const note = (message) => console.log(`        ${message}`);

/**
 * Reads one variable out of .env.local.
 *
 * Hand-rolled rather than pulled from dotenv, and it only has to handle what
 * this file actually contains: comments, blank lines and KEY=value. Quotes are
 * stripped because a key pasted out of the Cloud console often arrives in them.
 */
async function readEnvValue(file, name) {
  let contents;

  try {
    contents = await readFile(file, "utf8");
  } catch {
    return null;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const split = trimmed.indexOf("=");
    if (split === -1) continue;
    if (trimmed.slice(0, split).trim() !== name) continue;

    return trimmed
      .slice(split + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  return null;
}

/**
 * Google's errors are the useful part of this script, so surface the body.
 *
 * A rejected key comes back as a perfectly readable sentence -- "This API
 * project is not authorized to use this API", "API keys with referer
 * restrictions cannot be used with this API" -- and each one points at a
 * different fix. Collapsing them into "request failed" throws away the answer.
 */
async function readError(response) {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body);
    return parsed.error?.message ?? body;
  } catch {
    return body;
  }
}

/** Text Search (New). Returns the first matching place, or null. */
async function findPlace(key) {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": key,
      // There is no default set of fields: omit the mask and the call is
      // rejected outright. `photos` is the one being tested; the others are so
      // the log can show it found the right Pikes and not a travel agent.
      "x-goog-fieldmask":
        "places.id,places.displayName,places.formattedAddress,places.photos",
    },
    body: JSON.stringify({ textQuery: VENUE, pageSize: 3 }),
  });

  if (!response.ok) {
    fail(`Text Search returned HTTP ${response.status}`);
    note(await readError(response));
    return null;
  }

  const { places = [] } = await response.json();

  if (places.length === 0) {
    fail(`Text Search matched nothing for "${VENUE}"`);
    note("The key and the API work; this query just found no place.");
    return null;
  }

  const [place] = places;
  pass(`Text Search matched ${places.length} place(s)`);
  note(`${place.displayName?.text ?? "(unnamed)"} — ${place.formattedAddress ?? "no address"}`);
  note(`place id: ${place.id}`);

  return place;
}

/**
 * Turns a photo name into actual bytes.
 *
 * Two requests on purpose. `skipHttpRedirect` hands back the JSON containing
 * the lh3.googleusercontent.com URL, which is the thing an <img src> would end
 * up pointing at and therefore the thing worth printing; fetching that URL
 * afterwards is what proves it serves an image rather than a 403 placeholder.
 */
async function fetchPhoto(key, photoName) {
  const media = new URL(`https://places.googleapis.com/v1/${photoName}/media`);
  media.searchParams.set("key", key);
  media.searchParams.set("maxWidthPx", String(PHOTO_WIDTH));
  media.searchParams.set("skipHttpRedirect", "true");

  const lookup = await fetch(media);

  if (!lookup.ok) {
    fail(`Place Photos returned HTTP ${lookup.status}`);
    note(await readError(lookup));
    return false;
  }

  const { photoUri } = await lookup.json();

  if (!photoUri) {
    fail("Place Photos answered without a photoUri");
    return false;
  }

  pass("Place Photos resolved the reference to a URL");
  note(photoUri);

  const image = await fetch(photoUri);
  const type = image.headers.get("content-type") ?? "unknown";

  if (!image.ok || !type.startsWith("image/")) {
    fail(`That URL served HTTP ${image.status} (${type}), not an image`);
    return false;
  }

  const bytes = (await image.arrayBuffer()).byteLength;
  pass(`Downloaded a real image: ${type}, ${(bytes / 1024).toFixed(0)} KB`);

  return true;
}

async function main() {
  console.log(`\nChecking ${KEY_NAME} against "${VENUE}"\n`);

  const key = await readEnvValue(ENV_FILE, KEY_NAME);

  if (!key) {
    fail(`No ${KEY_NAME} in .env.local`);
    note("Add the key to that line, then run this again.");
    process.exitCode = 1;
    return;
  }

  // Enough to confirm which key loaded without putting a usable one on screen.
  pass(`Loaded a key (${key.length} chars, starts "${key.slice(0, 4)}")`);

  const place = await findPlace(key);
  if (!place) {
    process.exitCode = 1;
    return;
  }

  const photos = place.photos ?? [];

  if (photos.length === 0) {
    fail("That place came back with no photos");
    note("Search works, but this venue has nothing to pin to a board.");
    process.exitCode = 1;
    return;
  }

  pass(`Got ${photos.length} photo reference(s)`);
  note(photos[0].name);

  const ok = await fetchPhoto(key, photos[0].name);

  console.log(
    ok
      ? "\nPlaces is working end to end. Safe to build on.\n"
      : "\nSearch works, photos do not. Check Place Photos is enabled and the key is unrestricted or IP-restricted, not referrer-restricted.\n",
  );

  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  fail("The script itself threw");
  console.error(error);
  process.exitCode = 1;
});
