import { describe, expect, it } from 'vitest';

import type { PathKind } from '@/lib/http/classify';
import { API_CSP, buildCsp } from '@/lib/http/csp';
import { securityHeaders } from '@/lib/http/securityHeaders';
import { testEnv } from '@/lib/http/testEnv';

function headersFor(
  kind: PathKind,
  pathname: string,
  opts: { draft?: boolean; indexing?: boolean } = {},
) {
  const env = testEnv({
    ALLOW_INDEXING: String(opts.indexing ?? false),
    CSP_ADMIN_MODE: 'enforce',
  });
  const csp =
    kind === 'page' || kind === 'admin'
      ? buildCsp({
          kind,
          nonce: 'bm9uY2Vub25jZW5vbmNlMQ==',
          env,
          draft: opts.draft ?? false,
          ga4MeasurementId: null,
        })
      : null;
  const list = securityHeaders({
    kind,
    csp,
    env,
    https: true,
    reqId: 'req-1',
    pathname,
    draft: opts.draft ?? false,
  });
  return new Map(list.map(([k, v]) => [k.toLowerCase(), v]));
}

describe('securityHeaders (spec 7.1)', () => {
  it('H1 public page', () => {
    const h = headersFor('page', '/');
    expect(h.get('content-security-policy')).toContain("'nonce-bm9uY2Vub25jZW5vbmNlMQ=='");
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(h.get('reporting-endpoints')).toBe('csp="https://sefiddental.ir/api/csp-report"');
    expect(h.get('x-robots-tag')).toBe('noindex');
    expect(h.get('x-request-id')).toBe('req-1');
  });

  it('H2 indexing on: pages carry no X-Robots-Tag; sitemaps stay noindex', () => {
    expect(headersFor('page', '/', { indexing: true }).has('x-robots-tag')).toBe(false);
    expect(
      headersFor('feed', '/sitemaps/services.xml', { indexing: true }).get('x-robots-tag'),
    ).toBe('noindex');
    expect(headersFor('feed', '/sitemap.xml', { indexing: true }).get('x-robots-tag')).toBe(
      'noindex',
    );
    expect(headersFor('feed', '/rss.xml', { indexing: true }).has('x-robots-tag')).toBe(false);
    expect(headersFor('feed', '/robots.txt', { indexing: true }).has('x-robots-tag')).toBe(false);
  });

  it('H3 draft cookie: SAMEORIGIN for live preview', () => {
    expect(headersFor('page', '/', { draft: true }).get('x-frame-options')).toBe('SAMEORIGIN');
    expect(headersFor('admin', '/admin', { draft: true }).get('x-frame-options')).toBe('DENY');
  });

  it('H4 admin', () => {
    const h = headersFor('admin', '/admin');
    expect(h.get('content-security-policy')).toContain("style-src 'self' 'unsafe-inline'");
    expect(h.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  it.each(['api', 'internal'] as const)('H5 %s: API policy, DENY, noindex, no COOP', (kind) => {
    const h = headersFor(kind, '/api/health');
    expect(h.get('content-security-policy')).toBe(API_CSP);
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('x-robots-tag')).toBe('noindex');
    expect(h.has('cross-origin-opener-policy')).toBe(false);
    expect(h.has('reporting-endpoints')).toBe(false);
  });

  it('H6 static headers stay in next.config (no duplicates from the proxy)', () => {
    for (const kind of ['page', 'admin', 'api', 'feed'] as const) {
      const h = headersFor(kind, '/');
      expect(h.has('strict-transport-security')).toBe(false);
      expect(h.has('x-content-type-options')).toBe(false);
      expect(h.has('referrer-policy')).toBe(false);
      expect(h.has('permissions-policy')).toBe(false);
    }
  });

  it('H7 report-only CSP keeps its header name', () => {
    const env = testEnv({ CSP_MODE: 'report-only' });
    const csp = buildCsp({ kind: 'page', nonce: 'x', env, draft: false, ga4MeasurementId: null });
    const list = securityHeaders({
      kind: 'page',
      csp,
      env,
      https: true,
      reqId: 'r',
      pathname: '/',
      draft: false,
    });
    expect(list.map(([k]) => k)).toContain('Content-Security-Policy-Report-Only');
    expect(list.map(([k]) => k)).not.toContain('Content-Security-Policy');
  });
});
