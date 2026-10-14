// Canonical and host redirects (deliverable 5; freeze 3.13 step 6; spec-platform 6.3): one 301
// to SITE_URL's origin for the normalized path, the query kept as it is; the canonical link tag
// is where the query is cleaned (spec-platform 9.3). The e2e server runs the production build
// with SITE_URL=http://localhost:<port>, so the rules apply to the Host header `localhost:<port>`.
import { expect, test } from '@playwright/test';

import { requireRoutes } from '../../helpers/pending';
import { APP_ORIGIN } from '../../helpers/servers';

const host = new URL(APP_ORIGIN).host;
const at = (path: string) => new URL(path, APP_ORIGIN).href;

test('T-CN1 a trailing slash answers one 301 to the path without it', async ({ request }) => {
  const response = await request.get('/qa/not-found/', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(at('/qa/not-found'));
});

test('T-CN2 ASCII capitals and a trailing slash fold into the same single hop', async ({
  request,
}) => {
  const response = await request.get('/QA/Not-Found/', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(at('/qa/not-found'));
});

test('T-CN2b a doubled slash never reaches the proxy: Next answers 308 to the collapsed path', async ({
  request,
}) => {
  // next/dist/server/base-server.js (16.4.0) handleRequestImpl redirects any path with `//` or
  // `\` before the proxy runs, with a relative Location. The proxy's '//' rule is unreachable.
  const response = await request.get('/qa//not-found', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toBe('/qa/not-found');
  // The one exception to "security headers on every response": next.config headers() never runs
  // for this 308, so the reverse proxy adds the static set (docs/deploy.md). Tripwire: when Next
  // adds them, drop the exception from docs/deploy.md and tests/e2e/http/headers.spec.ts.
  expect(response.headers()['x-content-type-options']).toBeUndefined();
});

test('T-CN3 Arabic ي and ك in a path redirect to the Persian letters', async ({ request }) => {
  const response = await request.get(encodeURI('/خدمات/كامپوزيت-دندان'), { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(at('/خدمات/کامپوزیت-دندان'));
});

test('T-CN4 the canonical redirect keeps the query as it is (utm_* reach bookings)', async ({
  request,
}) => {
  const response = await request.get('/qa/not-found/?utm_source=x&b=2', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(at('/qa/not-found?utm_source=x&b=2'));
});

test('T-CN5 Host www.<site> answers one 301 to the apex, path normalized in the same hop', async ({
  request,
}) => {
  const www = { host: `www.${host}` };
  const clean = await request.get('/qa/not-found?a=1', { headers: www, maxRedirects: 0 });
  expect(clean.status()).toBe(301);
  expect(clean.headers().location).toBe(at('/qa/not-found?a=1'));

  const slashed = await request.get('/QA/not-found/', { headers: www, maxRedirects: 0 });
  expect(slashed.status()).toBe(301);
  expect(slashed.headers().location).toBe(at('/qa/not-found'));
});

test('T-CN6 a foreign Host is never redirected (no open redirect)', async ({ request }) => {
  const response = await request.get('/qa/not-found/', {
    headers: { host: 'evil.example' },
    maxRedirects: 0,
  });
  expect(response.status()).not.toBe(301);
  expect(response.headers().location).toBeUndefined();
});

test('T-CN7 canonical pages, API paths and percent-encoding case never redirect', async ({
  request,
}) => {
  for (const path of [
    '/',
    '/qa/not-found',
    '/api/form-session/',
    // خدمات with lower-case hex escapes: the same path as the upper-case form.
    '/%d8%ae%d8%af%d9%85%d8%a7%d8%aa',
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).not.toBe(301);
    expect(response.headers().location, path).toBeUndefined();
  }
});

test('T-CN8 the canonical link drops tracking and unknown query keys', async ({ page }) => {
  requireRoutes('serviceProbe');
  const response = await page.goto(
    encodeURI('/خدمات/ترمیم-دندان') + '?utm_source=x&gclid=y&service=implant',
  );
  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    at('/خدمات/ترمیم-دندان'),
  );
});
