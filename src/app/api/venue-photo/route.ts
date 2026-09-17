import { lookupVenuePhoto } from '@/lib/venuePhoto';

export const dynamic = 'force-dynamic';

const MAX_NAME = 200;
const MAX_LOCATION = 120;

type Body = {
  name?: unknown;
  venue?: unknown;
  location?: unknown;
};

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function clip(value: string, max: number): string {
  return value.slice(0, max);
}

/**
 * Pulls a venue name and optional location out of either a query string or a
 * JSON body. `name` and `venue` are accepted as aliases so a caller can send
 * whichever word they reached for.
 */
function parseInput(
  search: URLSearchParams,
  body: Body | null,
): { name: string; location: string } | { error: string } {
  const name = clip(
    readString(search.get('name')) ||
      readString(search.get('venue')) ||
      readString(body?.name) ||
      readString(body?.venue),
    MAX_NAME,
  );
  const location = clip(
    readString(search.get('location')) || readString(body?.location),
    MAX_LOCATION,
  );

  if (!name) return { error: 'Missing venue name' };
  return { name, location };
}

async function readBody(request: Request): Promise<Body | null> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return null;

  try {
    return (await request.json()) as Body;
  } catch {
    return null;
  }
}

async function handle(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const body =
    request.method === 'POST' || request.method === 'PUT'
      ? await readBody(request)
      : null;

  const input = parseInput(url.searchParams, body);
  if ('error' in input) {
    return Response.json({ found: false, error: input.error }, { status: 400 });
  }

  const result = await lookupVenuePhoto(input.name, input.location);
  return Response.json(result);
}

/**
 * A real photo of a named venue, looked up through Places (New).
 *
 * The API key never leaves the server. A miss is `{ found: false }` with a
 * 200, not an error -- plenty of real bars have no photo, and the board
 * already knows how to pin a written card instead.
 */
export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
