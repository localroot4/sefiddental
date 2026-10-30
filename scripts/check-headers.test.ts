import { describe, expect, it } from 'vitest';

import { API_CSP, headerProblems, STATIC } from './check-headers.mjs';

const STATIC_SET = { ...STATIC, 'x-frame-options': 'DENY' };
const PAGE_CSP =
  "default-src 'self'; script-src 'self' 'nonce-abc123==' 'strict-dynamic' 'sha256-x'; " +
  "style-src 'self' 'nonce-abc123==' 'sha256-y'; object-src 'none'; base-uri 'none'; " +
  "frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-report";
const page = (extra: Record<string, string> = {}) =>
  new Headers({
    ...STATIC_SET,
    'content-security-policy': PAGE_CSP,
    'cross-origin-opener-policy': 'same-origin',
    ...extra,
  });

describe('check-headers', () => {
  it('T-CH1 the launch policy passes; an unsafe keyword, a missing nonce or framing fails', () => {
    expect(headerProblems('page', page())).toEqual([]);
    const unsafe = PAGE_CSP.replace("'strict-dynamic'", "'strict-dynamic' 'unsafe-inline'");
    expect(headerProblems('page', page({ 'content-security-policy': unsafe }))).toEqual([
      expect.stringMatching(/^unsafe script-src/),
    ]);
    const styles = PAGE_CSP.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
    expect(headerProblems('page', page({ 'content-security-policy': styles }))).toEqual([
      expect.stringMatching(/^unsafe style-src/),
    ]);
    // The admin keeps style 'unsafe-inline' (Payload's runtime styles), never in scripts.
    expect(
      headerProblems(
        'admin',
        page({ 'content-security-policy': styles, 'x-robots-tag': 'noindex, nofollow' }),
      ),
    ).toEqual([]);
    const noNonce = PAGE_CSP.replace(" 'nonce-abc123=='", '');
    expect(headerProblems('page', page({ 'content-security-policy': noNonce }))).toContain(
      'script-src has no nonce',
    );
    expect(headerProblems('page', page({ 'x-frame-options': 'SAMEORIGIN' }))).toEqual([
      'X-Frame-Options is not DENY',
    ]);
    expect(
      headerProblems('page', page({ 'content-security-policy-report-only': PAGE_CSP })),
    ).toEqual(['the CSP is report-only']);
  });

  it('T-CH2 the static set, leaked internals and the API policy', () => {
    const headers = page({ 'x-powered-by': 'Next.js', 'x-middleware-rewrite': '/r/booking' });
    headers.delete('referrer-policy');
    expect(headerProblems('page', headers)).toEqual([
      'referrer-policy is "null", want "strict-origin-when-cross-origin"',
      'x-powered-by is sent',
      'x-middleware-rewrite passes the proxy',
    ]);
    const api = new Headers({ ...STATIC_SET, 'content-security-policy': API_CSP });
    expect(headerProblems('api', api)).toEqual([]);
    api.set('content-security-policy', "default-src 'self'");
    expect(headerProblems('api', api)).toEqual([`API CSP is "default-src 'self'"`]);
  });

  it('T-CH3 cookies need HttpOnly, Secure on HTTPS and SameSite Lax or Strict', () => {
    const good = '__Host-sefid-form=v; Path=/; Max-Age=86400; Secure; HttpOnly; SameSite=lax';
    expect(headerProblems('page', page(), { cookies: [good] })).toEqual([]);
    // Payload writes `Secure=true; HttpOnly=true`; browsers read the attribute names.
    const payload = 'payload-token=v; Path=/; Secure=true; HttpOnly=true; SameSite=Strict';
    expect(headerProblems('page', page(), { cookies: [payload] })).toEqual([]);
    // A cookie the route must set and did not is a problem of its own.
    expect(headerProblems('page', page(), { expect: ['__Host-sefid-form'] })).toEqual([
      'cookie __Host-sefid-form is not set',
    ]);
    expect(headerProblems('page', page(), { cookies: ['a=v; Path=/; SameSite=None'] })).toEqual([
      'cookie a lacks HttpOnly',
      'cookie a lacks Secure',
      'cookie a lacks SameSite=Lax or Strict',
    ]);
  });
});
