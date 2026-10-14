// Security headers on every response kind (acceptance: "Security headers on every response; CSP
// has no unsafe-inline or unsafe-eval"; spec-platform 7.1). The static set comes from
// next.config `headers()` on every path, so build assets and media files (outside the proxy
// matcher) carry it too; the proxy adds the route-dependent headers. One exception: Next's own 308
// for a path with '//' or '\' runs before headers() and carries none (canonical.spec.ts T-CN2b);
// docs/deploy.md has the reverse proxy set the static set on every response.
import { expect, test, type APIResponse } from '@playwright/test';

import { requireRoutes } from '../../helpers/pending';

const STATIC_SET: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
};

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

function expectStaticSet(response: APIResponse, label: string): void {
  const headers = response.headers();
  for (const [name, value] of Object.entries(STATIC_SET)) {
    expect(headers[name], `${label}: ${name}`).toBe(value);
  }
  expect(headers['x-powered-by'], `${label}: x-powered-by`).toBeUndefined();
}

/** The enforced public policy: nonce and 'strict-dynamic' scripts, no unsafe keyword at all. */
function expectPublicCsp(response: APIResponse, label: string): string {
  const headers = response.headers();
  const csp = headers['content-security-policy'];
  expect(csp, `${label}: enforced CSP`).toBeTruthy();
  expect(headers['content-security-policy-report-only'], label).toBeUndefined();
  expect(csp, label).not.toMatch(/'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'/);
  const scriptSrc = /(?:^|;)\s*script-src ([^;]+)/.exec(csp ?? '')?.[1] ?? '';
  expect(scriptSrc, `${label}: script-src`).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
  expect(scriptSrc, `${label}: script-src`).toContain("'strict-dynamic'");
  expect(csp, label).toMatch(/frame-ancestors 'none'/);
  expect(headers['x-frame-options'], label).toBe('DENY');
  expect(headers['cross-origin-opener-policy'], label).toBe('same-origin');
  expect(headers['x-request-id'], label).toBeTruthy();
  return /'nonce-([A-Za-z0-9+/=]+)'/.exec(scriptSrc)?.[1] ?? '';
}

/** Every executable script in the server HTML carries the header's nonce (spec X19). */
function expectScriptsCarryNonce(html: string, nonce: string, label: string): void {
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1] ?? '');
  const executable = scripts.filter((attrs) => !/type="application\/(ld\+)?json"/.test(attrs));
  expect(executable.length, `${label}: scripts`).toBeGreaterThan(0);
  for (const attrs of executable) {
    expect(attrs, `${label}: <script${attrs}>`).toContain(`nonce="${nonce}"`);
  }
}

test('T-HD1 public HTML (home, 404 template, unknown path): static set and a strict CSP', async ({
  request,
}) => {
  for (const [path, status] of [
    ['/', 200],
    ['/qa/not-found', 200],
    [`/no-such-page-${Date.now()}`, 404],
  ] as const) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(status);
    expectStaticSet(response, path);
    const nonce = expectPublicCsp(response, path);
    expectScriptsCarryNonce(await response.text(), nonce, path);
  }
});

test('T-HD2 every HTML response gets a fresh nonce', async ({ request }) => {
  const nonces = new Set<string>();
  for (let i = 0; i < 3; i += 1) {
    const csp = (await request.get('/')).headers()['content-security-policy'] ?? '';
    nonces.add(/'nonce-([^']+)'/.exec(csp)?.[1] ?? '');
  }
  expect(nonces.size).toBe(3);
});

test('T-HD3 public pages load without a single CSP violation', async ({ page }) => {
  const violations: string[] = [];
  await page.exposeFunction('__reportCspViolation', (line: string) => violations.push(line));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (window as unknown as { __reportCspViolation: (s: string) => void })
        .__reportCspViolation;
      report(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`);
    });
  });
  for (const path of ['/', '/qa/not-found', '/?debug=1&tier=1']) {
    await page.goto(path);
    await page.waitForLoadState('load');
    // The canvas chunk and the overlay load after `load`; give them time to run.
    await page.waitForTimeout(1500);
  }
  expect(violations).toEqual([]);
});

test('T-HD4 API JSON: static set, the API policy, DENY, noindex, request id', async ({
  request,
}) => {
  const response = await request.get('/api/form-session');
  expect(response.headers()['content-type']).toMatch(/^application\/json/);
  expectStaticSet(response, '/api/form-session');
  const headers = response.headers();
  expect(headers['content-security-policy']).toBe(API_CSP);
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-robots-tag']).toBe('noindex');
  expect(headers['x-request-id']).toBeTruthy();
});

test('T-HD5 /api/health carries the API set too', async ({ request }) => {
  requireRoutes('health');
  const response = await request.get('/api/health');
  expectStaticSet(response, '/api/health');
  expect(response.headers()['content-security-policy']).toBe(API_CSP);
  expect(response.headers()['x-robots-tag']).toBe('noindex');
});

test('T-HD6 static assets outside the proxy (build chunk, font, brand file) carry the static set', async ({
  request,
}) => {
  const html = await (await request.get('/')).text();
  const chunk = /\/_next\/static\/[^"'\s]+\.js/.exec(html)?.[0];
  expect(chunk, 'a build chunk referenced by the home HTML').toBeTruthy();
  for (const path of [chunk!, '/fonts/Vazirmatn-wght.woff2', '/brand/favicon.svg']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expectStaticSet(response, path);
  }
});

test('T-HD7 the media file route (outside the proxy) carries the static set', async ({
  request,
}) => {
  // No media is seeded yet (insurer logos are a content gap), so this is the route's 404: the
  // same handler and header rules as a stored file.
  const response = await request.get('/api/media/file/e2e-missing-file.png');
  expect(response.status()).toBe(404);
  expectStaticSet(response, '/api/media/file');
});

test('T-HD7b HTML and JSON on paths the proxy skips cannot be framed (CSP-3)', async ({
  request,
}) => {
  for (const path of ['/brand/x', '/fonts/x', '/favicon.ico.x']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expectStaticSet(response, path);
    expect(response.headers()['x-frame-options'], path).toBe('DENY');
    expect(response.headers()['content-security-policy'], path).toContain("frame-ancestors 'none'");
  }
  for (const path of ['/api/media', '/api/mediax']) {
    const response = await request.get(path);
    expectStaticSet(response, path);
    expect(response.headers()['content-security-policy'], path).toBe(API_CSP);
    expect(response.headers()['x-robots-tag'], path).toBe('noindex');
  }
});

test('T-HD8 admin HTML: static set, nonce scripts, never unsafe-eval, DENY, noindex', async ({
  request,
}) => {
  const response = await request.get('/admin/login');
  expect(response.status()).toBe(200);
  expectStaticSet(response, '/admin/login');
  const headers = response.headers();
  // CSP_ADMIN_MODE defaults to enforce since integration B (zero admin violations).
  const csp = headers['content-security-policy'] ?? '';
  expect(headers['content-security-policy-report-only']).toBeUndefined();
  expect(csp).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(csp).not.toContain("'unsafe-eval'");
  expect(/script-src ([^;]+)/.exec(csp)?.[1]).not.toContain("'unsafe-inline'");
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-robots-tag']).toBe('noindex, nofollow');
});

test('T-HD9 feeds: robots.txt carries the static set and the API policy', async ({ request }) => {
  const response = await request.get('/robots.txt');
  expectStaticSet(response, '/robots.txt');
  expect(response.headers()['content-security-policy']).toBe(API_CSP);
  expect(response.headers()['x-frame-options']).toBe('DENY');
});
