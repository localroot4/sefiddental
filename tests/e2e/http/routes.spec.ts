// System and feed routes (deliverables 5 and 7; spec-platform 9.4-9.6, 11.1-11.3) on the running
// artifact. Tests of routes Lane P is still building skip until their source file exists
// (tests/helpers/pending.ts) and then run without an edit.
import { expect, test, type APIRequestContext } from '@playwright/test';

import { t } from '@/i18n/fa';
import { ADMIN_ROUTE, PAGE_PATHS } from '@/lib/paths';

import { jsonLdScripts, type JsonLdNode } from '../../helpers/jsonld';
import { requireRoutes, routeExists } from '../../helpers/pending';
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
    expect(text).not.toContain(ADMIN_ROUTE);
    expect(text).not.toContain('/admin');
  });

  test('T-RT13 the same artifact with ALLOW_INDEXING=true allows the site and names the sitemap', async ({
    request,
  }) => {
    const response = await request.get(`${INDEXING_ORIGIN}/robots.txt`);
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/^Allow: \/$/m);
    expect(text).toMatch(/^Allow: \/api\/media\/file\/$/m);
    expect(text).toMatch(/^Disallow: \/api\/$/m);
    // The admin answers X-Robots-Tag noindex (headers.spec.ts T-HD8); robots.txt never names it.
    expect(text).not.toContain(ADMIN_ROUTE);
    expect(text).not.toContain('/admin');
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

// Phase 6 (H16, H18, C17, C25): the sitemaps list every published URL once with its content date,
// and nothing else; the feed holds the newest published articles. Read on the ALLOW_INDEXING
// server, whose sitemaps are not empty.

/** Decoded site path of an absolute URL. */
const sitePath = (url: string) => decodeURI(new URL(url).pathname);

/** Every `<url>` of one child sitemap: decoded path, absolute loc and lastmod. */
async function sitemapUrls(request: APIRequestContext, name: (typeof SITEMAP_CHILDREN)[number]) {
  const response = await request.get(`${INDEXING_ORIGIN}/sitemaps/${name}.xml`);
  expect(response.status(), name).toBe(200);
  return findAll(parseXml(await response.text()), 'url').map((url) => {
    const loc = textOf(url, 'loc') ?? '';
    return { loc, path: sitePath(loc), lastmod: textOf(url, 'lastmod') };
  });
}

/** Decoded site paths linked from a page (the hubs list what is published). */
async function linkedPaths(request: APIRequestContext, path: string): Promise<string[]> {
  const response = await request.get(`${INDEXING_ORIGIN}${encodeURI(path)}`);
  expect(response.status(), path).toBe(200);
  return [...(await response.text()).matchAll(/href="(\/[^"#?]*)/g)].map((m) => decodeURI(m[1]!));
}

/** The canonical href and meta robots of a page's HTML. */
function headOf(html: string): { canonical?: string; robots?: string } {
  return {
    canonical: /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&'),
    robots: /<meta name="robots" content="([^"]+)"/.exec(html)?.[1],
  };
}

interface PublishedArticle {
  path: string;
  dateModified: string;
  category: string | undefined;
}

/**
 * Every published article as the site shows it: the hub's pages walked until one lists no post
 * (or answers the past-the-end redirect), then each post's Article dateModified and the category
 * of its breadcrumb (H16: the date the sitemap must give).
 */
async function publishedArticles(request: APIRequestContext): Promise<PublishedArticle[]> {
  const isPost = (p: string) => /^\/مقالات\/[^/]+$/.test(p) && !/\/(دسته|برچسب)$/.test(p);
  const posts = new Set<string>();
  for (let page = 1; page < 50; page++) {
    const url = `${INDEXING_ORIGIN}${encodeURI('/مقالات')}${page > 1 ? `?page=${page}` : ''}`;
    const response = await request.get(url, { maxRedirects: 0 });
    if (response.status() !== 200) break;
    const found = [...(await response.text()).matchAll(/href="(\/[^"#?]*)/g)]
      .map((m) => decodeURI(m[1]!))
      .filter(isPost);
    if (found.length === 0) break;
    for (const post of found) posts.add(post);
  }
  const articles: PublishedArticle[] = [];
  for (const path of posts) {
    const response = await request.get(`${INDEXING_ORIGIN}${encodeURI(path)}`);
    expect(response.status(), path).toBe(200);
    const nodes = jsonLdScripts(await response.text()).flatMap(
      (script) => (script as { '@graph': JsonLdNode[] })['@graph'],
    );
    const article = nodes.find((n) => n['@type'] === 'Article');
    const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList')?.itemListElement as
      Array<{ item: string }> | undefined;
    expect(article, `${path}: Article JSON-LD`).toBeDefined();
    articles.push({
      path,
      dateModified: String(article!.dateModified),
      category: crumbs?.map((c) => sitePath(c.item)).find((p) => p.startsWith('/مقالات/دسته/')),
    });
  }
  return articles;
}

const same = (a: string | null | undefined, b: string) =>
  expect(Date.parse(a ?? ''), `${a} = ${b}`).toBe(Date.parse(b));

test('T-RT15 every loc of every child sitemap is unique, answers 200, is self-canonical and indexable', async ({
  request,
}) => {
  requireRoutes('sitemapIndex');
  test.setTimeout(180_000);
  const urls = (await Promise.all(SITEMAP_CHILDREN.map((n) => sitemapUrls(request, n)))).flat();
  const locs = urls.map((u) => u.loc);
  expect(new Set(locs).size, 'a loc in two places').toBe(locs.length);
  // Pages of routes another lane is still building are listed (published) but not served yet.
  const pending = [
    ...(routeExists('cases') ? [] : ['/قبل-و-بعد']),
    ...(routeExists('articlesHub') ? [] : ['/مقالات']),
  ];
  for (const { loc, path } of urls.filter((u) => !pending.includes(u.path))) {
    expect(loc, 'absolute on the indexing origin').toMatch(new RegExp(`^${INDEXING_ORIGIN}/`));
    const response = await request.get(loc, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    const head = headOf(await response.text());
    // The home canonical has no trailing slash, the sitemap's does: the same URL once parsed.
    expect(head.canonical && new URL(head.canonical).href, `${path}: self-canonical`).toBe(loc);
    expect(head.robots ?? '', `${path}: indexable`).not.toMatch(/noindex/);
  }
});

test('T-RT15b the sitemaps list every published document once and nothing else (C17, C25)', async ({
  request,
}) => {
  requireRoutes('sitemapIndex', 'articlesHub', 'article', 'articleCategory', 'tag');
  test.setTimeout(240_000);
  const count = (list: Array<{ path: string }>, path: string) =>
    list.filter((u) => u.path === path).length;

  const hubLinks = async (hub: string) =>
    [...new Set(await linkedPaths(request, hub))].filter((p) => p.startsWith(`${hub}/`));
  // admin.spec.ts publishes articles meanwhile (H39): retry until one read of both sides agrees.
  await expect(async () => {
    const [pages, services, doctors, articles] = await Promise.all(
      SITEMAP_CHILDREN.map((n) => sitemapUrls(request, n)),
    );
    for (const path of await hubLinks('/خدمات')) expect(count(services!, path), path).toBe(1);
    for (const path of await hubLinks('/پزشکان')) expect(count(doctors!, path), path).toBe(1);
    for (const path of await hubLinks('/راهنمای-بیمار')) expect(count(pages!, path), path).toBe(1);
    expect(count(pages!, '/قبل-و-بعد'), '/قبل-و-بعد').toBe(1);

    const published = await publishedArticles(request);
    expect(published.length, 'the QA fixture publishes articles').toBeGreaterThan(0);
    expect(count(pages!, '/مقالات'), 'the hub, listed while it has articles').toBe(1);
    const posts = articles!.filter((u) => !u.path.startsWith('/مقالات/دسته/'));
    // Exactly the published posts: a draft or an unpublished post is never listed.
    expect(posts.map((u) => u.path).sort()).toEqual(published.map((a) => a.path).sort());

    // Categories with 5 published articles or more, dated by their newest article; no tag.
    const perCategory = new Map<string, string[]>();
    for (const article of published) {
      if (!article.category) continue;
      perCategory.set(article.category, [
        ...(perCategory.get(article.category) ?? []),
        article.dateModified,
      ]);
    }
    const listed = articles!.filter((u) => u.path.startsWith('/مقالات/دسته/'));
    const expected = [...perCategory].filter(([, dates]) => dates.length >= 5);
    expect(listed.map((u) => u.path).sort()).toEqual(expected.map(([path]) => path).sort());
    for (const [path, dates] of expected) {
      const newest = dates.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b));
      same(listed.find((u) => u.path === path)!.lastmod, newest);
    }
    const all = [...pages!, ...services!, ...doctors!, ...articles!];
    expect(
      all.filter((u) => u.path.includes('/برچسب/')),
      'tags are never listed',
    ).toEqual([]);
  }).toPass({ timeout: 120_000 });
});

test('T-RT16 an article lastmod equals the dateModified of its page', async ({ request }) => {
  requireRoutes('sitemapIndex', 'articlesHub', 'article');
  test.setTimeout(180_000);
  await expect(async () => {
    const urls = await sitemapUrls(request, 'articles');
    const published = await publishedArticles(request);
    expect(published.length).toBeGreaterThan(0);
    for (const article of published) {
      same(urls.find((u) => u.path === article.path)?.lastmod, article.dateModified);
    }
  }).toPass({ timeout: 60_000 });
});

test('T-RT17 the feed: the newest published posts, unique permalinks to their canonical pages', async ({
  request,
}) => {
  requireRoutes('rss', 'articlesHub', 'article');
  test.setTimeout(180_000);
  // The feed and the hub walk are two reads: a publish between them settles on a retry.
  await expect(async () => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);
    const rss = parseXml(await response.text());
    expect(rss.attributes['xmlns:atom']).toBe('http://www.w3.org/2005/Atom');
    expect(findAll(rss, 'atom:link')[0]?.attributes.href).toBe(`${APP_ORIGIN}/rss.xml`);
    const items = findAll(rss, 'item').map((item) => ({
      link: textOf(item, 'link') ?? '',
      guid: textOf(item, 'guid') ?? '',
      pubDate: textOf(item, 'pubDate') ?? '',
    }));
    expect(items.length, 'the QA fixture post at least').toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(20);
    expect(new Set(items.map((i) => i.guid)).size).toBe(items.length);
    const published = new Set((await publishedArticles(request)).map((a) => a.path));
    const now = Date.now();
    let previous = Infinity;
    for (const item of items) {
      expect(item.guid).toBe(item.link);
      expect(item.link).toMatch(new RegExp(`^${APP_ORIGIN}/`));
      expect(published, `${item.link} is a published post`).toContain(sitePath(item.link));
      expect(item.pubDate).toMatch(
        /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/,
      );
      const date = Date.parse(item.pubDate);
      expect(date, `${item.link}: not in the future`).toBeLessThanOrEqual(now);
      expect(date, `${item.link}: newest first`).toBeLessThanOrEqual(previous);
      previous = date;
      const page = await request.get(item.link);
      expect(page.status(), item.link).toBe(200);
      expect(headOf(await page.text()).canonical, `${item.link}: canonical`).toBe(item.link);
    }
  }).toPass({ timeout: 60_000 });
});

test('T-RT18 no public output names the admin route: feeds, page HTML, JSON-LD and every chunk', async ({
  page,
  request,
}) => {
  requireRoutes('sitemapIndex', 'rss', 'booking');
  // The admin is found only by its path (src/lib/paths.ts ADMIN_ROUTE): a public file or script
  // that names it would undo the move away from /admin.
  for (const url of [
    '/robots.txt',
    `${INDEXING_ORIGIN}/robots.txt`,
    `${INDEXING_ORIGIN}/sitemap.xml`,
    ...SITEMAP_CHILDREN.map((name) => `${INDEXING_ORIGIN}/sitemaps/${name}.xml`),
    '/rss.xml',
  ]) {
    expect(await (await request.get(url)).text(), url).not.toContain(ADMIN_ROUTE);
  }
  // Every same-origin response of the browser: documents, build chunks loaded at once or later,
  // styles and API answers.
  const bodies: Array<Promise<[string, string]>> = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.origin !== APP_ORIGIN || (response.status() >= 300 && response.status() < 400)) return;
    bodies.push(
      response.text().then(
        (text): [string, string] => [url.pathname, text],
        (): [string, string] => [url.pathname, ''],
      ),
    );
  });
  for (const path of [
    '/',
    PAGE_PATHS.booking,
    PAGE_PATHS['services-hub'],
    '/admin',
    `/no-such-page-${Date.now()}`,
  ]) {
    await page.goto(encodeURI(path));
    await page.waitForLoadState('load');
    // The canvas chunk and the overlay load after `load`; give them time to arrive.
    await page.waitForTimeout(1500);
  }
  const seen = await Promise.all(bodies);
  const scripts = seen.filter(
    ([path]) => path.startsWith('/_next/static/') && path.endsWith('.js'),
  );
  expect(scripts.length, 'build chunks checked').toBeGreaterThan(3);
  for (const [path, text] of seen) expect(text, path).not.toContain(ADMIN_ROUTE);
});
