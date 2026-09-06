import { isInstagramCdnHost } from '@/lib/vibeBoard';

/** Matches the scraper's own budget; a slow frame should not hang the rail. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Re-serves an Instagram CDN photo from our own origin.
 *
 * Instagram signs its CDN URLs and refuses them when a browser asks directly,
 * so every scraped photo 404s in an <img> even though the same URL fetches
 * fine from the server. Without this the photo bank is permanently empty.
 *
 * Strictly allowlisted to Instagram's own hosts -- a proxy that will fetch any
 * URL a caller names is an SSRF hole, not a feature.
 */
export async function GET(request: Request) {
  const src = new URL(request.url).searchParams.get('src');

  if (!src) {
    return new Response('Missing src', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(src);
  } catch {
    return new Response('Malformed src', { status: 400 });
  }

  if (target.protocol !== 'https:' || !isInstagramCdnHost(target.hostname)) {
    return new Response('Only Instagram CDN photos can be proxied', {
      status: 403,
    });
  }

  try {
    const upstream = await fetch(target, {
      // Instagram serves the bytes happily to a server, but it does look at
      // where the request claims to come from.
      headers: { referer: 'https://www.instagram.com/' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Upstream refused', { status: 502 });
    }

    const contentType = upstream.headers.get('content-type') ?? '';

    return new Response(upstream.body, {
      headers: {
        'content-type': contentType.startsWith('image/')
          ? contentType
          : 'image/jpeg',
        // The signed URL expires anyway, so there is no point caching past it.
        'cache-control': 'public, max-age=3600, immutable',
      },
    });
  } catch (error) {
    console.error('[ig-photo] could not proxy', target.hostname, error);
    return new Response('Could not fetch that photo', { status: 502 });
  }
}
