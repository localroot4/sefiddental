import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of a presented secret with the expected one. Both sides are hashed
 * first, so the comparison length never depends on the input and an empty secret never matches.
 */
export function secretMatches(presented: string | null | undefined, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

/** Token of an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorization ?? '');
  return match?.[1] ?? null;
}

/** `/api/internal/*` guard (spec 10.2): the proxy sends INTERNAL_API_TOKEN in x-internal-token. */
export function isInternalCaller(headers: Headers, internalApiToken: string): boolean {
  return secretMatches(headers.get('x-internal-token'), internalApiToken);
}

/** `/api/cron/tick` guard (spec 11.3): `Authorization: Bearer CRON_SECRET`. */
export function isCronCaller(headers: Headers, cronSecret: string): boolean {
  return secretMatches(bearerToken(headers.get('authorization')), cronSecret);
}
