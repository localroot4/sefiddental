import { describe, expect, it } from 'vitest';

import { requestIdFrom, sanitizeRequestHeaders } from '@/lib/http/requestId';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('requestIdFrom', () => {
  it('R1 keeps a well-formed id only from a trusted proxy', () => {
    const headers = new Headers({ 'x-request-id': 'edge-req-12345' });
    expect(requestIdFrom(headers, true)).toBe('edge-req-12345');
    expect(requestIdFrom(headers, false)).toMatch(UUID);
  });

  it.each(['short', '<script>alert(1)</script>', 'a'.repeat(65), 'has space 12345'])(
    'R2 replaces a malformed id %s with a UUID',
    (id) => {
      expect(requestIdFrom(new Headers({ 'x-request-id': id }), true)).toMatch(UUID);
    },
  );

  it('R3 gives a fresh UUID when none is sent', () => {
    const a = requestIdFrom(new Headers(), true);
    const b = requestIdFrom(new Headers(), true);
    expect(a).toMatch(UUID);
    expect(a).not.toBe(b);
  });
});

describe('sanitizeRequestHeaders', () => {
  const forged = () =>
    new Headers({
      'x-nonce': 'evil',
      'content-security-policy': "script-src 'nonce-evil'",
      'content-security-policy-report-only': "script-src 'nonce-evil'",
      'x-sefid-form-sid': 'forged-sid',
      'x-pathname': '/admin',
      'x-request-id': '<script>',
      'x-internal-token': 'guess',
      cookie: 'payload-token=abc',
      accept: 'text/html',
    });

  it('R4 drops proxy-owned headers and sets the request id (spec X18)', () => {
    const headers = sanitizeRequestHeaders(forged(), 'page', false, 'req-id-0001');
    for (const name of [
      'x-nonce',
      'content-security-policy',
      'content-security-policy-report-only',
      'x-sefid-form-sid',
      'x-pathname',
      'x-internal-token',
    ]) {
      expect(headers.get(name), name).toBeNull();
    }
    expect(headers.get('x-request-id')).toBe('req-id-0001');
    expect(headers.get('cookie')).toBe('payload-token=abc');
    expect(headers.get('accept')).toBe('text/html');
  });

  it('R5 keeps x-internal-token only for kind internal', () => {
    expect(sanitizeRequestHeaders(forged(), 'internal', false, 'r').get('x-internal-token')).toBe(
      'guess',
    );
    expect(sanitizeRequestHeaders(forged(), 'api', false, 'r').get('x-internal-token')).toBeNull();
  });

  it('R6 does not mutate the source headers', () => {
    const src = forged();
    sanitizeRequestHeaders(src, 'page', false, 'r');
    expect(src.get('x-nonce')).toBe('evil');
  });
});
