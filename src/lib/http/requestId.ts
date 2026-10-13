import type { PathKind } from '@/lib/http/classify';

/** An incoming id is kept only from a trusted proxy and only in this shape. */
const TRUSTED_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Headers only the proxy may put on the request that reaches the render: a client copy would
 * forge the CSP nonce, the form session id, the admin path seen by payload-totp or the id.
 */
const PROXY_OWNED = [
  'x-nonce',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-sefid-form-sid',
  'x-pathname',
  'x-request-id',
];

export function requestIdFrom(headers: Headers, trust: boolean): string {
  const incoming = headers.get('x-request-id');
  if (trust && incoming !== null && TRUSTED_REQUEST_ID.test(incoming)) return incoming;
  return globalThis.crypto.randomUUID();
}

/**
 * Copy of the request headers for `NextResponse.next({ request: { headers } })`: proxy-owned
 * headers dropped, `x-request-id` set to `reqId`, and `x-internal-token` kept only for kind
 * 'internal', the one route family that reads it. `trust` is part of the frozen signature;
 * requestIdFrom already applied it to the id, and no other header depends on it today.
 */
export function sanitizeRequestHeaders(
  src: Headers,
  kind: PathKind,
  trust: boolean,
  reqId: string,
): Headers {
  const headers = new Headers(src);
  for (const name of PROXY_OWNED) headers.delete(name);
  if (kind !== 'internal') headers.delete('x-internal-token');
  headers.set('x-request-id', reqId);
  return headers;
}
