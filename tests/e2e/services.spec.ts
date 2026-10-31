// Services templates (phase 4 deliverable 4): the hub lists every published category and service,
// each category page lists its services, the restoration page renders every T-service section in
// docs/ia.md order with the tier anchor (the QA fixture links its case and testimonial to it), /vip
// lands on that anchor, breadcrumbs, canonical and JSON-LD match, empty sections stay hidden, and no
// template scrolls sideways at 320 px. The published set comes from the services sitemap of the
// ALLOW_INDEXING server, not from a list in this file.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { EMERGENCY_PATH } from '@/i18n/fa';

import { APP_ORIGIN, INDEXING_ORIGIN } from '../helpers/servers';
import { findAll, parseXml } from '../helpers/xml';

const HUB = '/خدمات';
const RESTORATION = '/خدمات/ترمیم-دندان';
const TIERS_ANCHOR = 'سطح-ترمیم';
// docs/ia.md T-service sections 2 to 11 as data-section ids (the hero is the page header).
const SERVICE_ORDER = [
  'facts',
  'tiers',
  'about',
  'steps',
  'cases',
  'dentists',
  'voice',
  'faq',
  'related',
  'booking',
];

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(encodeURI(path));
  expect(response?.status(), path).toBe(200);
  await page.waitForLoadState('load');
}

/** Decoded site paths of the links inside `scope`. */
async function linkPaths(page: Page, scope: string): Promise<string[]> {
  return page
    .locator(`${scope} a[href^="/"]`)
    .evaluateAll((links) =>
      links.map((a) => decodeURI(new URL((a as HTMLAnchorElement).href).pathname)),
    );
}

type Node = { '@type': string; [key: string]: unknown };

/** Every JSON-LD node of the page, the @graph arrays flattened. */
async function jsonLd(page: Page): Promise<Node[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => (JSON.parse(text) as { '@graph': Node[] })['@graph']);
}

const ofType = (nodes: Node[], type: string) => nodes.filter((n) => n['@type'] === type);

/** The page's data-section ids in document order. */
async function sections(page: Page): Promise<Array<string | null>> {
  return page
    .locator('[data-section]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')));
}

/** The canonical is the absolute, percent-encoded path (code-conventions 2.1 step 6). */
async function expectCanonical(page: Page, path: string): Promise<void> {
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${APP_ORIGIN}${encodeURI(path)}`,
  );
}

/** Visible breadcrumb labels (from 744 px every item shows). */
async function crumbs(page: Page): Promise<string[]> {
  return (
    await page.getByRole('navigation', { name: 'مسیر صفحه' }).locator('li').allTextContents()
  ).map((s) => s.trim());
}

test('T-SV1 the hub lists every published category and service, with breadcrumbs and JSON-LD', async ({
  page,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const sitemap = await request.get(`${INDEXING_ORIGIN}/sitemaps/services.xml`);
  expect(sitemap.status()).toBe(200);
  const published = findAll(parseXml(await sitemap.text()), 'loc').map((loc) =>
    decodeURI(new URL(loc.text.trim()).pathname),
  );
  expect(published).toContain(RESTORATION);

  await open(page, HUB);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('خدمات دندانپزشکی کلینیک سفید');
  await expect(page).toHaveTitle('خدمات دندانپزشکی | کلینیک دندانپزشکی سفید');
  await expectCanonical(page, HUB);
  const links = new Set(await linkPaths(page, 'main'));
  for (const path of published) expect(links, path).toContain(path);
  // Five groups in the bento: the three category pages and the two standalone services.
  await expect(page.locator('[data-section="groups"] article')).toHaveCount(5);
  expect(await crumbs(page)).toEqual(['خانه', 'خدمات']);

  const nodes = await jsonLd(page);
  const list = ofType(nodes, 'ItemList')[0] as { itemListElement: unknown[] } | undefined;
  // The list holds the services; the sitemap also holds the three category pages.
  expect(list?.itemListElement).toHaveLength(published.length - 3);
  expect(ofType(nodes, 'BreadcrumbList')).toHaveLength(1);
});

test('T-SV2 each category page lists its services as the hub groups them', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, HUB);
  const categories = await page.locator('[data-section="groups"] article a').evaluateAll((links) =>
    links.map((a) => ({
      title: (a.textContent ?? '').trim(),
      path: decodeURI(new URL((a as HTMLAnchorElement).href).pathname),
    })),
  );
  // A group's own list in the hub's full list, keyed by its heading.
  const groups = await page
    .locator('[data-section="list"] section[aria-labelledby^="hub-group-"]')
    .evaluateAll((sections) =>
      sections.map((s) => ({
        title: (s.querySelector('h3')?.textContent ?? '').trim(),
        paths: [...s.querySelectorAll('a')].map((a) => decodeURI(new URL(a.href).pathname)),
      })),
    );
  // A tile is a category page unless it links a service (the standalone groups).
  const servicePaths = new Set(groups.flatMap((g) => g.paths));
  const pages = categories.filter((c) => !servicePaths.has(c.path));
  expect(pages).toHaveLength(3);
  for (const category of pages) {
    await open(page, category.path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const expected = groups.find((g) => g.title === category.title)?.paths ?? [];
    expect(expected.length, category.path).toBeGreaterThan(0);
    expect(await linkPaths(page, '[data-section="services"]'), category.path).toEqual(expected);
    expect(await crumbs(page), category.path).toEqual(['خانه', 'خدمات', category.title]);
    const nodes = await jsonLd(page);
    expect(ofType(nodes, 'BreadcrumbList'), category.path).toHaveLength(1);
    const list = ofType(nodes, 'ItemList')[0] as { itemListElement: unknown[] } | undefined;
    expect(list?.itemListElement, category.path).toHaveLength(expected.length);
    const faqs = await page.locator('[data-section="faq"] details').count();
    expect(ofType(nodes, 'FAQPage'), category.path).toHaveLength(faqs ? 1 : 0);
  }
});

test('T-SV3 the restoration page renders every T-service section in order, the tiers and the anchor', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, RESTORATION);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'ترمیم دندان در سه سطح: معمولی، VIP و CIP',
  );
  // VIP and CIP are LTR islands in the H1 (wave 1 request R4).
  await expect(page.locator('h1 bdi[dir="ltr"]')).toHaveText(['VIP', 'CIP']);
  await expect(page).toHaveTitle('ترمیم دندان؛ معمولی، VIP و CIP | کلینیک دندانپزشکی سفید');
  await expectCanonical(page, RESTORATION);
  // Seeded copy, plus the QA fixture's dentist, case and testimonial (freeze F9).
  expect(await sections(page)).toEqual(SERVICE_ORDER);
  await expect(page.locator('[data-section="cases"] input[type="range"]')).toHaveCount(1);
  // No link to the cases page while it has no route (gap 6, findings R2).
  await expect(page.locator('[data-section="cases"] a[href="/قبل-و-بعد"]')).toHaveCount(0);

  const tiers = page.locator(`[id="${TIERS_ANCHOR}"]`);
  await expect(tiers.locator('article')).toHaveCount(3);
  await expect(tiers.locator('article h3')).toHaveText(['معمولی', 'VIP', 'CIP']);
  // Static comparison: no preselected (warm) tier, one «رزرو نوبت» for the section (freeze F24).
  await expect(tiers.locator('article.bg-warm-soft')).toHaveCount(0);
  const book = tiers.getByRole('link', { name: 'رزرو نوبت' });
  await expect(book).toHaveCount(1);
  await expect(book).toHaveAttribute('href', /\?service=restoration$/);
  // Steps go to section 5 and the rich text with its in-page nav to section 4.
  await expect(page.locator('[data-section="steps"] li')).toHaveCount(5);
  await expect(page.locator('[data-section="about"] h2').first()).toHaveText('ترمیم دندان چیست؟');
  // The booking block carries the service.
  const form = page.locator('[data-section="booking"] form');
  await expect(form.locator('input[name="service_key"]')).toHaveValue('restoration');

  expect(await crumbs(page)).toEqual(['خانه', 'خدمات', 'درمان و نگهداری دندان', 'ترمیم دندان']);
  const nodes = await jsonLd(page);
  const crumbList = ofType(nodes, 'BreadcrumbList')[0] as
    { itemListElement: unknown[] } | undefined;
  expect(crumbList?.itemListElement).toHaveLength(4);
  expect(ofType(nodes, 'Service')[0]).toMatchObject({
    name: 'ترمیم دندان در سه سطح: معمولی، VIP و CIP',
    serviceType: 'ترمیم دندان',
  });
  const faq = ofType(nodes, 'FAQPage')[0] as { mainEntity: unknown[] } | undefined;
  expect(faq?.mainEntity).toHaveLength(await page.locator('[data-section="faq"] details').count());
});

test('T-SV4 every service renders only its filled sections, in docs/ia.md order', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, HUB);
  const paths = await linkPaths(page, '[data-section="list"]');
  expect(paths.length).toBeGreaterThan(10);
  for (const path of paths) {
    await open(page, path);
    const found = await sections(page);
    expect(found, path).toEqual(SERVICE_ORDER.filter((s) => found.includes(s)));
    // Section 10 always renders: the pricing link needs no related item (H24).
    expect(found, path).toContain('related');
    expect(found, path).toContain('booking');
  }
});

test('T-SV5 /vip lands on the restoration tiers anchor', async ({ page }, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await page.goto('/vip');
  await page.waitForLoadState('load');
  expect(decodeURI(new URL(page.url()).pathname)).toBe(RESTORATION);
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe(`#${TIERS_ANCHOR}`);
  expect(await page.evaluate(() => document.querySelector(':target')?.id)).toBe(TIERS_ANCHOR);
  const box = await page.locator(`[id="${TIERS_ANCHOR}"]`).boundingBox();
  const header = await page.locator('header').first().boundingBox();
  // The section starts below the header, near the top of the viewport.
  expect(box?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0) - 1);
  expect(box?.y).toBeLessThan(page.viewportSize()!.height / 2);
});

test('T-SV6 empty sections stay hidden; the emergency link only where the service asks for it', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // Bleaching has no tiers, and the QA fixture links no case, dentist or testimonial to it.
  await open(page, '/خدمات/بلیچینگ-دندان');
  for (const id of ['tiers', 'cases', 'dentists', 'voice']) {
    await expect(page.locator(`[data-section="${id}"]`), id).toHaveCount(0);
  }
  await expect(page.locator('[data-section="booking"]')).toHaveCount(1);
  // FAQPage only with the FAQ section, one question per visible item.
  const [faqPage] = ofType(await jsonLd(page), 'FAQPage');
  const questions = await page.locator('[data-section="faq"] details').count();
  expect((faqPage?.mainEntity as unknown[] | undefined)?.length ?? 0).toBe(questions);
  // The booking form's help text links the emergency page everywhere but home (freeze G10).
  await expect(
    page.locator(`main a[href="${EMERGENCY_PATH}"]:not([data-booking-form] a)`),
  ).toHaveCount(0);
  await open(page, '/خدمات/درمان-ریشه');
  await expect(page.locator('main header a', { hasText: 'درد شدید دارید؟' })).toHaveCount(1);
});

test('T-SV7 no horizontal scroll at 320 px on the hub, a category and the restoration page', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.setViewportSize({ width: 320, height: 700 });
  for (const path of [HUB, '/خدمات/زیبایی', RESTORATION]) {
    await open(page, path);
    await page.evaluate(() => document.fonts.ready);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBe(0);
  }
});
