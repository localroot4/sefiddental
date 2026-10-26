import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { API_CSP, buildCsp, newNonce } from '@/lib/http/csp';
import { testEnv } from '@/lib/http/testEnv';
import { STATIC_PAGE_STYLE_SHA256 } from '@/lib/system-pages/staticPage';
import { THEME_INIT_SCRIPT } from '@/lib/theme/themeInitScript';

const NONCE = 'AAAAAAAAAAAAAAAAAAAAAA==';

function directives(value: string): Map<string, string[]> {
  return new Map(
    value.split(';').map((d) => {
      const [name = '', ...sources] = d.trim().split(/\s+/);
      return [name, sources] as const;
    }),
  );
}

const sha = (text: string) => createHash('sha256').update(text).digest('base64');

describe('newNonce', () => {
  it('N1 16 random bytes in base64, matching the pattern Next reads', () => {
    const nonce = newNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9+/_-]+={0,2}$/);
    expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
    expect(newNonce()).not.toBe(nonce);
  });
});

describe('buildCsp public pages (spec 7.2)', () => {
  const page = (env = testEnv(), extra: { draft?: boolean; ga?: string | null } = {}) =>
    buildCsp({
      kind: 'page',
      nonce: NONCE,
      env,
      draft: extra.draft ?? false,
      ga4MeasurementId: extra.ga ?? null,
    });

  it('CSP1 production policy: no unsafe-inline or unsafe-eval token anywhere', () => {
    const { header, value } = page();
    expect(header).toBe('Content-Security-Policy');
    const tokens = value.split(/[\s;]+/);
    expect(tokens).not.toContain("'unsafe-inline'");
    expect(tokens).not.toContain("'unsafe-eval'");
  });

  it('CSP2 scripts: self, nonce, strict-dynamic, the theme script hash', () => {
    const d = directives(page().value);
    expect(d.get('script-src')).toEqual([
      "'self'",
      `'nonce-${NONCE}'`,
      "'strict-dynamic'",
      `'sha256-${sha(THEME_INIT_SCRIPT)}'`,
    ]);
    expect(d.get('style-src')).toEqual([
      "'self'",
      `'nonce-${NONCE}'`,
      `'sha256-${STATIC_PAGE_STYLE_SHA256}'`,
    ]);
  });

  it('CSP3 full directive set and order', () => {
    expect([...directives(page().value).keys()]).toEqual([
      'default-src',
      'script-src',
      'style-src',
      'img-src',
      'font-src',
      'connect-src',
      'media-src',
      'worker-src',
      'manifest-src',
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
      'upgrade-insecure-requests',
      'report-uri',
      'report-to',
    ]);
    const d = directives(page().value);
    expect(d.get('frame-ancestors')).toEqual(["'none'"]);
    expect(d.get('object-src')).toEqual(["'none'"]);
    expect(d.get('base-uri')).toEqual(["'none'"]);
    expect(d.get('report-uri')).toEqual(['/api/csp-report']);
    expect(d.get('report-to')).toEqual(['csp']);
  });

  it('CSP4 draft cookie lets the admin frame the page (live preview)', () => {
    expect(directives(page(testEnv(), { draft: true }).value).get('frame-ancestors')).toEqual([
      "'self'",
    ]);
  });

  it('CSP5 GA hosts only when GA4 is on', () => {
    const off = page().value;
    expect(off).not.toContain('google');
    const d = directives(page(testEnv(), { ga: 'G-ABC123' }).value);
    expect(d.get('script-src')).toContain('https://www.googletagmanager.com');
    expect(d.get('connect-src')).toEqual([
      "'self'",
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://*.googletagmanager.com',
    ]);
    expect(d.get('img-src')).toContain('https://*.google-analytics.com');
  });

  it('CSP6 media origin joins img-src and media-src', () => {
    const d = directives(page(testEnv({ MEDIA_PUBLIC_ORIGIN: 'https://cdn.example.com' })).value);
    expect(d.get('img-src')).toEqual(["'self'", 'data:', 'blob:', 'https://cdn.example.com']);
    expect(d.get('media-src')).toEqual(["'self'", 'https://cdn.example.com']);
  });

  it('CSP7 development: unsafe-eval for scripts, unsafe-inline styles without nonce', () => {
    const d = directives(
      page(testEnv({ NODE_ENV: 'development', SITE_URL: 'http://localhost:3000' })).value,
    );
    expect(d.get('script-src')).toContain("'unsafe-eval'");
    expect(d.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(d.has('upgrade-insecure-requests')).toBe(false);
  });

  it('CSP8 report-only mode: header name, no upgrade-insecure-requests', () => {
    const { header, value } = page(testEnv({ CSP_MODE: 'report-only' }));
    expect(header).toBe('Content-Security-Policy-Report-Only');
    expect(directives(value).has('upgrade-insecure-requests')).toBe(false);
  });
});

describe('buildCsp admin (spec 7.3, decision 2)', () => {
  const admin = (env = testEnv({ CSP_ADMIN_MODE: 'enforce' })) =>
    buildCsp({ kind: 'admin', nonce: NONCE, env, draft: false, ga4MeasurementId: 'G-ABC123' });

  it('CSA1 strict scripts, inline styles without nonce or hash', () => {
    const d = directives(admin().value);
    expect(d.get('script-src')).toEqual(["'self'", `'nonce-${NONCE}'`, "'strict-dynamic'"]);
    expect(d.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(admin().value).not.toContain("'unsafe-eval'");
    expect(admin().value).not.toContain('google');
    expect(d.get('frame-src')).toEqual(["'self'"]);
    expect(d.get('worker-src')).toEqual(["'self'", 'blob:']);
  });

  it('CSA2 enforced by default; CSP_ADMIN_MODE=report-only switches to the report header', () => {
    expect(admin(testEnv()).header).toBe('Content-Security-Policy');
    expect(admin(testEnv({ CSP_ADMIN_MODE: 'report-only' })).header).toBe(
      'Content-Security-Policy-Report-Only',
    );
  });
});

describe('buildCsp non-HTML kinds', () => {
  it.each(['api', 'internal', 'feed'] as const)('CSN1 %s gets the API policy, enforced', (kind) => {
    expect(
      buildCsp({
        kind,
        nonce: null,
        env: testEnv({ CSP_MODE: 'report-only' }),
        draft: false,
        ga4MeasurementId: null,
      }),
    ).toEqual({
      header: 'Content-Security-Policy',
      value: API_CSP,
    });
  });
});
