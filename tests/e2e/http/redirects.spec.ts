// The redirects table through the proxy (deliverable 5; freeze 3.13 step 5; spec-platform 6.5
// X10-X13). The seeder writes the /vip alias of the restoration service (docs/ia.md). The proxy
// reads the table from /api/internal/proxy-config (Lane P), so these tests wait for that route.
// The admin slug-change and CSV import cases are in admin.spec.ts (they need a signed-in session).
import { expect, test } from '@playwright/test';

import { redirectsText } from '@/i18n/fa-redirects';

import { requireRoutes } from '../../helpers/pending';
import { APP_ORIGIN } from '../../helpers/servers';

const VIP_TARGET = new URL('/خدمات/ترمیم-دندان#سطح-ترمیم', APP_ORIGIN).href;

test.beforeEach(() => requireRoutes('proxyConfig'));

test('T-RD1 X10 the seeded /vip redirect answers 301 to the restoration tiers', async ({
  request,
}) => {
  const response = await request.get('/vip', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(VIP_TARGET);
  expect(response.headers()['x-request-id']).toBeTruthy();
});

test('T-RD2 X11 /VIP/ and HEAD /vip take the same single hop', async ({ request }) => {
  const upper = await request.get('/VIP/', { maxRedirects: 0 });
  expect(upper.status()).toBe(301);
  expect(upper.headers().location).toBe(VIP_TARGET);
  const head = await request.head('/vip', { maxRedirects: 0 });
  expect(head.status()).toBe(301);
  expect(head.headers().location).toBe(VIP_TARGET);
});

test('T-RD3 X12 only utm_* query keys travel to the target', async ({ request }) => {
  const response = await request.get('/vip?utm_source=a&p=2', { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  const location = new URL(response.headers().location ?? '');
  expect([...location.searchParams.keys()]).toEqual(['utm_source']);
  expect(location.searchParams.get('utm_source')).toBe('a');
});

test('T-RD4 X13 a POST to /vip is never redirected', async ({ request }) => {
  const response = await request.post('/vip', { maxRedirects: 0, data: {} });
  expect(response.status()).not.toBe(301);
  expect(response.headers().location).toBeUndefined();
});

test('T-RD5 the old-URL import endpoint answers 403 without a verified admin session', async ({
  request,
}) => {
  const response = await request.post('/api/redirects/import', {
    data: { csv: '/old-page,/خدمات', origins: '' },
  });
  expect(response.status()).toBe(403);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual({ message: redirectsText('redirects.import.forbidden') });
});
