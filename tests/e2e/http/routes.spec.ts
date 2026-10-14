// System and feed routes (deliverables 5 and 7; spec-platform 9.4-9.6, 11.1-11.3) on the running
// artifact. Tests of routes Lane P is still building skip until their source file exists
// (tests/helpers/pending.ts) and then run without an edit.
import { expect, test } from '@playwright/test';

import { t } from '@/i18n/fa';

import { requireRoutes } from '../../helpers/pending';
import { APP_ORIGIN, INDEXING_ORIGIN } from '../../helpers/servers';
import { findAll, parseXml, textOf } from '../../helpers/xml';

const SITEMAP_CHILDREN = ['pages', 'services', 'doctors', 'articles'] as const;

test.describe('GET and HEAD /api/health', () => {
  test.beforeEach(() => requireRoutes('health'));

  test('T-RT1 health answers 200 JSON with the public shape only, never cached', async ({
    request,
  }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^application\/json/);
    expect(response.headers()['cache-control']).toMatch(/no-store/);
    const body = (await response.json()) as Record<string, unknown>;
    // No Node version, host names, env names or counts in the public body (spec 11.1).
    expect(Object.keys(body).sort()).toEqual(
      ['checks', 'maintenance', 'status', 'time', 'uptimeSeconds', 'version'].sort(),
    );
    expect(body.status).toBe('ok');
    expect(body.maintenance).toBe(false);
    expect(typeof body.version).toBe('string');
    expect(Number.isNaN(Date.parse(String(body.time)))).toBe(false);
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(body.checks).toEqual({
      database: { status: 'ok', latencyMs: expect.any(Number) },
    });
  });

  test('T-RT2 HEAD /api/health answers 200 without a body', async ({ request }) => {
    const response = await request.head('/api/health');
    expect(response.status()).toBe(200);
    expect((await response.body()).byteLength).toBe(0);
  });
});

test.describe('POST /api/events', () => {
  test.beforeEach(() => requireRoutes('events'));

  test('T-RT3 a valid event answers 204 and sets no cookie (JSON and sendBeacon text)', async ({
    request,
  }) => {
    const json = await request.post('/api/events', {
      data: { event: 'call_click', location: 'header', pageType: 'home' },
    });
    expect(json.status()).toBe(204);
    expect(json.headers()['set-cookie']).toBeUndefined();

    // navigator.sendBeacon sends text/plain from the same origin.
    const beacon = await request.post('/api/events', {
      headers: { 'content-type': 'text/plain;charset=UTF-8', origin: APP_ORIGIN },
      data: JSON.stringify([{ event: 'theme_toggle' }, { event: 'whatsapp_click' }]),
    });
    expect(beacon.status()).toBe(204);
    expect(beacon.headers()['set-cookie']).toBeUndefined();
  });

  test('T-RT4 an unknown event name is dropped with 204', async ({ request }) => {
    const response = await request.post('/api/events', { data: { event: 'evil' } });
    expect(response.status()).toBe(204);
  });

  test('T-RT5 rejects: bad JSON 400, cross-site 403, foreign Origin 403, over 2 KB 413', async ({
    request,
  }) => {
    const badJson = await request.post('/api/events', {
      headers: { 'content-type': 'text/plain' },
      data: '{"event":',
    });
    expect(badJson.status()).toBe(400);

    const crossSite = await request.post('/api/events', {
      headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
      data: { event: 'call_click' },
    });
    expect(crossSite.status()).toBe(403);

    const foreignOrigin = await request.post('/api/events', {
      headers: { origin: 'https://evil.example' },
      data: { event: 'call_click' },
    });
    expect(foreignOrigin.status()).toBe(403);

    const tooLarge = await request.post('/api/events', {
      headers: { 'content-type': 'text/plain' },
      data: JSON.stringify({ event: 'call_click', serviceKey: 'x'.repeat(3000) }),
    });
    expect(tooLarge.status()).toBe(413);
  });
});

test.describe('GET /api/cron/tick', () => {
  test.beforeEach(() => requireRoutes('cron'));

  test('T-RT6 without the bearer, or with a wrong one, the tick answers 401', async ({
    request,
  }) => {
    expect((await request.get('/api/cron/tick')).status()).toBe(401);
    const wrong = await request.get('/api/cron/tick', {
      headers: { authorization: 'Bearer not-the-cron-secret' },
    });
    expect(wrong.status()).toBe(401);
  });

  test('T-RT7 with CRON_SECRET the tick runs and returns the run summary', async ({ request }) => {
    const secret = process.env.CRON_SECRET;
    test.skip(!secret, 'CRON_SECRET is not set in the test environment (.env or CI).');
    const response = await request.get('/api/cron/tick', {
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toMatch(/no-store/);
    expect(await response.json()).toEqual({
      ranJobs: expect.any(Number),
      failed: expect.any(Number),
      remaining: expect.any(Number),
      scheduled: expect.any(Number),
      durationMs: expect.any(Number),
    });
  });
});

test.describe('sitemaps', () => {
  test.beforeEach(() => requireRoutes('sitemapIndex'));

  test('T-RT8 /sitemap.xml is a sitemap index that lists the four child sitemaps', async ({
    request,
  }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/^application\/xml/);
    expect(response.headers()['cache-control']).toBe('public, max-age=3600');
    expect(response.headers()['x-robots-tag']).toMatch(/noindex/);
    const index = parseXml(await response.text());
    expect(index.name).toBe('sitemapindex');
    const locs = findAll(index, 'loc').map((loc) => loc.text.trim());
    expect(locs).toEqual(SITEMAP_CHILDREN.map((name) => `${APP_ORIGIN}/sitemaps/${name}.xml`));
  });

  test('T-RT9 every child sitemap is strict XML; empty while ALLOW_INDEXING is false', async ({
    request,
  }) => {
    for (const name of SITEMAP_CHILDREN) {
      const response = await request.get(`/sitemaps/${name}.xml`);
      expect(response.status(), name).toBe(200);
      expect(response.headers()['content-type'], name).toMatch(/^application\/xml/);
      const urlset = parseXml(await response.text());
      expect(urlset.name, name).toBe('urlset');
      expect(findAll(urlset, 'url'), name).toEqual([]);
    }
  });

  test('T-RT10 with ALLOW_INDEXING=true the services sitemap lists the published services', async ({
    request,
  }) => {
    const response = await request.get(`${INDEXING_ORIGIN}/sitemaps/services.xml`);
    expect(response.status()).toBe(200);
    const locs = findAll(parseXml(await response.text()), 'loc').map((loc) =>
      decodeURI(loc.text.trim()),
    );
    expect(locs).toContain(`${INDEXING_ORIGIN}/خدمات/ترمیم-دندان`);
    expect(new Set(locs).size).toBe(locs.length);
  });
});

test('T-RT11 /rss.xml is a strict RSS 2.0 document in Persian', async ({ request }) => {
  requireRoutes('rss');
  const response = await request.get('/rss.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/rss\+xml/);
  const rss = parseXml(await response.text());
  expect(rss.name).toBe('rss');
  expect(rss.attributes.version).toBe('2.0');
  const [channel] = findAll(rss, 'channel');
  expect(channel).toBeDefined();
  expect(textOf(channel!, 'title')).toBe('مقالات کلینیک دندانپزشکی سفید');
  expect(textOf(channel!, 'language')).toBe('fa-IR');
  expect(decodeURI(textOf(channel!, 'link') ?? '')).toBe(`${APP_ORIGIN}/مقالات`);
  expect(findAll(channel!, 'atom:link')[0]?.attributes).toMatchObject({
    rel: 'self',
    href: `${APP_ORIGIN}/rss.xml`,
  });
});

test.describe('robots.txt switches with ALLOW_INDEXING at run time (decision 39)', () => {
  test('T-RT12 ALLOW_INDEXING unset: the whole site is disallowed and no sitemap is named', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/^User-Agent: \*$/im);
    expect(text).toMatch(/^Disallow: \/$/m);
    expect(text).not.toMatch(/^Allow:/m);
    expect(text).not.toMatch(/^Sitemap:/im);
  });

  test('T-RT13 the same artifact with ALLOW_INDEXING=true allows the site and names the sitemap', async ({
    request,
  }) => {
    const response = await request.get(`${INDEXING_ORIGIN}/robots.txt`);
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text).toMatch(/^Allow: \/api\/media\/file\/$/m);
    expect(text).toMatch(/^Disallow: \/admin$/m);
    expect(text).toMatch(/^Disallow: \/api\/$/m);
    expect(text).not.toMatch(/^Disallow: \/$/m);
    expect(text).toMatch(new RegExp(`^Sitemap: ${INDEXING_ORIGIN}/sitemap\\.xml$`, 'im'));
  });
});

test('T-RT14 a Persian dynamic path renders from its ASCII folder; the folder itself is the 404', async ({
  page,
}) => {
  requireRoutes('serviceProbe');
  // Next 16.4 never matches [slug] under a Persian folder, so the proxy rewrites
  // /خدمات/<slug> to /r/services/<slug> (src/lib/http/proxyRules.ts routeRewrite).
  const slug = 'ترمیم-دندان';
  const service = await page.goto(encodeURI(`/خدمات/${slug}`));
  expect(service?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^ترمیم دندان در سه سطح/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${APP_ORIGIN}${encodeURI(`/خدمات/${slug}`)}`,
  );

  // No duplicate content: the internal path answers the branded 404, noindex.
  const direct = await page.goto(`/r/services/${encodeURIComponent(slug)}`);
  expect(direct?.status()).toBe(404);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('notFound.heading'));
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
});
