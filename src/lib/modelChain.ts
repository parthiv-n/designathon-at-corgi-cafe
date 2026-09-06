import { google } from '@ai-sdk/google';

/**
 * Tried in order. The newest flash model gets the most traffic and is the
 * first to return 503 "experiencing high demand", so the chain starts on a
 * slightly older one and only reaches for the newest as a last resort.
 */
export const MODEL_CHAIN = [
  'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
] as const;

/**
 * True for problems worth retrying on a *different* model: 503 UNAVAILABLE,
 * 429 rate limits, 500s, and the 403/404s Google returns for a model this key
 * cannot reach or that has been retired.
 *
 * 403 belongs here even though it reads like an auth failure. Google returns a
 * flat "The caller does not have permission" both for a bad key and for a model
 * the key is not entitled to, and only the second is per-model -- but treating
 * both as retryable costs four fast failures on a bad key, where treating
 * neither as retryable strands the chain on its first entry. Anything else
 * (bad schema, malformed request) rethrows immediately.
 */
export function isCapacityError(error: unknown): boolean {
  const codes = new Set([403, 404, 429, 500, 502, 503, 504]);

  const walk = (value: unknown, depth = 0): boolean => {
    if (!value || typeof value !== 'object' || depth > 3) return false;
    const record = value as Record<string, unknown>;

    if (typeof record.statusCode === 'number' && codes.has(record.statusCode)) {
      return true;
    }

    if (Array.isArray(record.errors) && record.errors.some(e => walk(e, depth + 1))) {
      return true;
    }

    return walk(record.lastError, depth + 1) || walk(record.cause, depth + 1);
  };

  if (walk(error)) return true;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('does not have permission') ||
    message.includes('no longer available')
  );
}

/**
 * Runs `attempt` against each model in turn until one works.
 *
 * `maxRetries` is deliberately low at each call site: retrying the *same*
 * congested model three times cost 34s in testing, where failing over to the
 * next model is near instant.
 */
export async function withModelFallback<T>(
  attempt: (model: ReturnType<typeof google>, modelId: string) => Promise<T>,
  options: { onFallback?: (modelId: string, error: unknown) => void } = {},
): Promise<T> {
  let lastError: unknown;

  for (const modelId of MODEL_CHAIN) {
    try {
      return await attempt(google(modelId), modelId);
    } catch (error) {
      lastError = error;
      options.onFallback?.(modelId, error);

      if (!isCapacityError(error)) throw error;
    }
  }

  throw lastError;
}
