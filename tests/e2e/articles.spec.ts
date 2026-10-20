// Article templates (phase 6 deliverables 1 and 8, plan section 5 T-AR1 to T-AR8): the hub, a post,
// a category and a tag, their pagination (H3), indexability (H4, C25) and internal links (H24).
// The QA fixture (tests/fixtures/qa-seed.ts, H40 with C28) publishes 13 posts in category A, all
// with the QA tag, one in category B, and keeps one draft; admin tests may publish more while
// this runs, so these tests check that fixture items are present and drafts absent, never global
// counts (H39). Desktop-light and phone-light only, as pages.spec.ts; request-level rows once.
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

import { requireRoutes } from '../helpers/pending';
import { APP_ORIGIN, INDEXING_ORIGIN } from '../helpers/servers';

const MARK = 'نمونهٔ آزمایشی';
const HUB = '/مقالات';
const POST = '/مقالات/نمونه-آزمایشی-مقاله-کامل';
const CATEGORY_A = '/مقالات/دسته/نمونه-آزمایشی-دسته-الف';
const CATEGORY_B = '/مقالات/دسته/نمونه-آزمایشی-دسته-ب';
const CATEGORY_EMPTY = '/مقالات/دسته/نمونه-آزمایشی-دسته-خالی';
const TAG = '/مقالات/برچسب/نمونه-آزمایشی-برچسب';
const DRAFT = '/مقالات/نمونه-آزمایشی-پیش-نویس';
const DENTIST = '/پزشکان/دکتر-نمونه-آزمایشی';
const RESTORATION = '/خدمات/ترمیم-دندان';
const PERSIAN_DOCUMENT = /<html[^>]*\slang="fa"[^>]*\sdir="rtl"/;

test.beforeEach(() => {
  requireRoutes('articlesHub', 'article', 'articleCategory', 'tag');
});

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(encodeURI(path));
  expect(response?.status(), path).toBe(200);
  await page.waitForLoadState('load');
}

type Node = { '@type': string; [key: string]: unknown };

async function jsonLd(page: Page): Promise<Node[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => (JSON.parse(text) as { '@graph': Node[] })['@graph']);
}

const ofType = (nodes: Node[], type: string) => nodes.filter((n) => n['@type'] === type);

async function crumbNames(page: Page): Promise<string[]> {
  const [list] = ofType(await jsonLd(page), 'BreadcrumbList');
  return (list?.itemListElement as Array<{ name: string }>).map((item) => item.name);
}

/** The canonical href and meta robots of a server HTML document. */
function headOf(html: string): { canonical?: string; robots?: string; title?: string } {
  return {
    canonical: /<link rel="canonical" href="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&'),
    robots: /<meta name="robots" content="([^"]+)"/.exec(html)?.[1],
    title: /<title>([^<]*)<\/title>/.exec(html)?.[1],
  };
}

/** A GET that does not follow redirects. */
const get = (request: APIRequestContext, path: string, query = '', origin = APP_ORIGIN) =>
  request.get(`${origin}${encodeURI(path)}${query}`, { maxRedirects: 0 });

/** A redirect's target as a decoded site path with its query. */
const target = (location: string | undefined) => {
  const url = new URL(location ?? '', APP_ORIGIN);
  return decodeURI(url.pathname) + url.search;
};

test('T-AR1 hub: H1, featured on page 1, category chips, 12 cards, self-canonical, ItemList, no booking', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, HUB);
  await expect(page.locator('[data-page-type="articles"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('مقالات سلامت دهان و دندان');
  const list = page.locator('[data-section="list"]');
  // The newest post is the featured card: the page's one eager image.
  const featured = list.locator('[data-featured]');
  await expect(featured).toHaveCount(1);
  await expect(featured.locator('img:not([aria-hidden])')).toHaveAttribute('loading', 'eager');
  // 12 a page (H3): the featured card and 11 more.
  await expect(list.locator('article')).toHaveCount(12);
  await expect(list.locator('img[loading="eager"]')).toHaveCount(1);
  const chips = page.getByRole('navigation', { name: 'دسته‌های مقاله' });
  await expect(chips.getByRole('link', { name: 'همه' })).toHaveAttribute('aria-current', 'page');
  await expect(chips.getByRole('link', { name: `${MARK}: دستهٔ الف` })).toHaveAttribute(
    'href',
    CATEGORY_A,
  );
  // An empty category has no chip (H4).
  await expect(chips.getByRole('link', { name: `${MARK}: دستهٔ خالی` })).toHaveCount(0);
  await expect(list.getByRole('link', { name: `${MARK}: پیش‌نویس` })).toHaveCount(0);
  const pagination = page.getByRole('navigation', { name: 'صفحه‌بندی' });
  await expect(pagination.getByRole('link', { name: 'صفحهٔ ۲' })).toHaveAttribute(
    'href',
    `${HUB}?page=2`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${APP_ORIGIN}${encodeURI(HUB)}`,
  );
  expect(await crumbNames(page)).toEqual(['خانه', 'مقالات']);
  const [items] = ofType(await jsonLd(page), 'ItemList');
  expect(items?.itemListElement).toHaveLength(12);
  // No booking block or dialog on the article lists (conversion.md T-articles).
  await expect(page.locator('main [data-booking-form], dialog[data-booking-dialog]')).toHaveCount(
    0,
  );
});

test('T-AR2 pagination: ?page=2 in any digits is self-canonical; ?page=1 and junk 308, past the end 307', async ({
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const query of ['?page=2', `?page=${encodeURIComponent('۲')}`]) {
    const response = await get(request, HUB, query);
    expect(response.status(), query).toBe(200);
    const head = headOf(await response.text());
    expect(head.canonical, query).toBe(`${APP_ORIGIN}${encodeURI(HUB)}?page=2`);
    expect(head.title, query).toContain('صفحهٔ ۲');
  }
  // The featured card is page 1 only.
  expect(await (await get(request, HUB, '?page=2')).text()).not.toContain('data-featured');
  for (const query of ['?page=1', '?page=abc', '?page=-2', '?page=2.5']) {
    const response = await get(request, HUB, query);
    expect(response.status(), query).toBe(308);
    expect(target(response.headers().location), query).toBe(HUB);
  }
  const past = await get(request, HUB, '?page=999');
  expect(past.status()).toBe(307);
  expect(target(past.headers().location)).toBe(HUB);
  // Category A and the tag have 13 posts each: their page 2 exists and keeps its query.
  for (const path of [CATEGORY_A, TAG]) {
    const response = await get(request, path, '?page=2');
    expect(response.status(), path).toBe(200);
    expect(headOf(await response.text()).canonical, path).toBe(
      `${APP_ORIGIN}${encodeURI(path)}?page=2`,
    );
    const end = await get(request, path, '?page=99');
    expect(end.status(), path).toBe(307);
    expect(target(end.headers().location), path).toBe(path);
  }
});

test('T-AR3 post: breadcrumb, eager cover, Jalali dates, TOC, FAQ, sources, people, tags, share, one CTA, related', async ({
  page,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, POST);
  await expect(page.locator('[data-page-type="article"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${MARK}: مقالهٔ کامل`);
  expect(await crumbNames(page)).toEqual([
    'خانه',
    'مقالات',
    `${MARK}: دستهٔ الف`,
    `${MARK}: مقالهٔ کامل`,
  ]);
  // C22: the cover is the LCP: eager, high priority, with its alt and a srcset.
  const cover = page.locator('main header picture img');
  await expect(cover).toHaveAttribute('alt', `${MARK}: جای تصویر شاخص مقاله`);
  await expect(cover).toHaveAttribute('loading', 'eager');
  await expect(cover).toHaveAttribute('fetchpriority', 'high');
  await expect(page.locator('main header picture source').first()).toHaveAttribute('srcset', /w/);
  // The updated date in Jalali with Persian digits; it is the JSON-LD dateModified (C17).
  const updated = page.locator('main header time').first();
  await expect(updated).toHaveAttribute('datetime', '2026-10-16T06:00:00.000Z');
  await expect(updated).toContainText('۲۴ مهر ۱۴۰۵');
  await expect(page.locator('main header')).toContainText('زمان مطالعه:');
  const [article] = ofType(await jsonLd(page), 'Article');
  expect(article?.dateModified).toBe('2026-10-16T06:00:00.000Z');
  expect(article?.author).toMatchObject({ name: 'دکتر نمونهٔ آزمایشی' });
  const reading = page.locator('[data-section="reading"]');
  await expect(reading.getByRole('heading', { level: 2, name: 'پرسش‌های پرتکرار' })).toBeVisible();
  await expect(reading.locator('details')).toHaveCount(2);
  await expect(reading.getByRole('heading', { level: 2, name: 'منابع' })).toBeVisible();
  // Author and reviewer boxes (H23): the sample dentist both times, the review date in Jalali.
  await expect(reading.getByRole('link', { name: 'دکتر نمونهٔ آزمایشی' })).toHaveCount(2);
  await expect(reading.getByText('بازبین پزشکی')).toBeVisible();
  // The review day in Jalali (the fixture's 2026-10-12, Tehran: 20 Mehr 1405).
  await expect(reading.locator('time').filter({ hasText: '۲۰ مهر ۱۴۰۵' })).toHaveCount(1);
  await expect(reading.getByRole('link', { name: `${MARK}: برچسب` })).toHaveAttribute('href', TAG);
  // H22: plain share anchors with the encoded canonical URL.
  const canonical = `${APP_ORIGIN}${encodeURI(POST)}`;
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  const telegram = await reading.getByRole('link', { name: 'در تلگرام' }).getAttribute('href');
  expect(new URL(telegram ?? '').searchParams.get('url')).toBe(canonical);
  const whatsapp = await reading.getByRole('link', { name: 'در واتساپ' }).getAttribute('href');
  expect(new URL(whatsapp ?? '').searchParams.get('text')).toContain(canonical);
  // H21: exactly one booking CTA in the page body, for the primary service.
  const booking = page.locator('main a[href^="/رزرو-نوبت"]');
  await expect(booking).toHaveCount(1);
  await expect(booking).toHaveAttribute('href', '/رزرو-نوبت?service=restoration');
  await expect(page.locator('main [data-booking-form], dialog[data-booking-dialog]')).toHaveCount(
    0,
  );
  // H24: two related posts, each a live page.
  const related = page.locator('[data-section="related"] article a');
  await expect(related).toHaveCount(2);
  for (const href of await related.evaluateAll((links) =>
    links.map((a) => a.getAttribute('href') ?? ''),
  )) {
    expect(href).not.toBe(POST);
    expect((await request.get(encodeURI(href))).status(), href).toBe(200);
  }
});

test('T-AR3 TOC on desktop: every entry resolves to a heading on the page, FAQ and sources included', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  /** The TOC's targets after each entry resolved to exactly one element. */
  const tocOf = async (path: string) => {
    await open(page, path);
    const toc = page.getByRole('navigation', { name: 'در این صفحه' });
    await expect(toc, path).toBeVisible();
    const ids = await toc
      .locator('a')
      .evaluateAll((links) => links.map((a) => decodeURIComponent(a.getAttribute('href') ?? '')));
    for (const id of ids) {
      await expect(page.locator(`[id="${id.slice(1)}"]`), id).toHaveCount(1);
    }
    return ids;
  };
  const full = await tocOf(POST);
  expect(full.length).toBeGreaterThanOrEqual(4);
  expect(full).toEqual(expect.arrayContaining(['#faq', '#sources']));
  // C3: a short post (two H2s, no FAQ) still has its TOC.
  const short = await tocOf('/مقالات/نمونه-آزمایشی-مقاله-۱');
  expect(short.length).toBeGreaterThanOrEqual(2);
  expect(short).toContain('#sources');
  expect(short).not.toContain('#faq');
});

test('T-AR3 blocks: callout, table with th scope, lazy video poster, figure with caption', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  test.fixme(
    true,
    'TEMPLATES step 2 adds the block converters (H8); the blocks render nothing yet',
  );
  await open(page, POST);
  const reading = page.locator('[data-section="reading"]');
  await expect(reading.getByText(`${MARK}: نکتهٔ کوتاه داخل مقاله.`)).toBeVisible();
  await expect(reading.locator('table th[scope="col"]')).toHaveCount(3);
  await expect(reading.locator('[role="region"] table')).toHaveCount(1);
  await expect(reading.locator('figure img[loading="lazy"]').first()).toBeVisible();
  await expect(reading.getByText(`${MARK}: خلاصهٔ گفته‌های ویدیوی نمونه.`)).toBeVisible();
  await expect(reading.locator('video')).toHaveCount(0);
  await expect(reading.locator('p table, p figure')).toHaveCount(0);
});

test('T-AR4 post: no video file request, no client marker, no em dash, no style attribute, no console error', async ({
  page,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const media: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (/\.(mp4|webm)(\?|$)/.test(r.url())) media.push(r.url());
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await open(page, POST);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(media).toEqual([]);
  const html = await (await request.get(encodeURI(POST))).text();
  const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
  expect(main).not.toContain('[[NEEDS_CLIENT');
  expect(main).not.toContain('—');
  expect(main).not.toMatch(/\sstyle="/);
  // A CSP violation logs a console error; so does a failed request.
  expect(errors).toEqual([]);
});

test('T-AR5 categories: A (13 posts) is indexable, B (1 post) is noindex,follow; the title pattern', async ({
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const a = headOf(await (await get(request, CATEGORY_A, '', INDEXING_ORIGIN)).text());
  expect(a.robots).toBe('index, follow');
  expect(a.title).toBe(`${MARK}: دستهٔ الف | مقالات کلینیک دندانپزشکی سفید`);
  const b = headOf(await (await get(request, CATEGORY_B, '', INDEXING_ORIGIN)).text());
  expect(b.robots).toBe('noindex, follow');
  expect(b.title).toBe(`${MARK}: دستهٔ ب | مقالات کلینیک دندانپزشکی سفید`);
});

test('T-AR6 tag: noindex,follow even with 13 posts; page 2 self-canonical with its own title', async ({
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const first = await get(request, TAG, '', INDEXING_ORIGIN);
  expect(first.status()).toBe(200);
  expect(headOf(await first.text()).robots).toBe('noindex, follow');
  const second = headOf(await (await get(request, TAG, '?page=2', INDEXING_ORIGIN)).text());
  expect(second.robots).toBe('noindex, follow');
  expect(second.canonical).toMatch(/\?page=2$/);
  expect(second.title).toContain('صفحهٔ ۲');
});

test('T-AR7 an empty category, a draft post and unknown slugs answer the branded 404', async ({
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const stamp = Date.now();
  for (const path of [
    CATEGORY_EMPTY,
    DRAFT,
    `/مقالات/no-such-post-${stamp}`,
    `/مقالات/دسته/no-such-category-${stamp}`,
    `/مقالات/برچسب/no-such-tag-${stamp}`,
  ]) {
    const response = await get(request, path);
    expect(response.status(), path).toBe(404);
    const html = await response.text();
    expect(html, path).toMatch(PERSIAN_DOCUMENT);
    expect(html, path).not.toContain('__next_error__');
  }
});

test('T-AR8 internal links: the restoration page lists 2 articles, the dentist page lists theirs with the role', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, RESTORATION);
  const related = page.locator('[data-section="related"]');
  const posts = related.locator('a[href^="/مقالات/"]');
  await expect(posts).toHaveCount(2);
  // The pricing link stays in section 10 (H24).
  await expect(related.locator('a[href="/هزینه-و-پرداخت"]')).toHaveCount(1);
  await open(page, DENTIST);
  const articles = page.locator('[data-section="articles"]');
  await expect(articles.getByRole('link', { name: `${MARK}: مقالهٔ کامل` })).toHaveAttribute(
    'href',
    POST,
  );
  await expect(articles.getByText('نویسنده و بازبین').first()).toBeVisible();
  await expect(articles.locator('li')).toHaveCount(6);
});
