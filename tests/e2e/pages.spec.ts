// Pages templates (phase 4 deliverables 5 and 6): the dentists hub and profile, about, address,
// patient guide hub and guide. Each renders its H1 and only the sections that have content, in
// docs/ia.md order, with breadcrumbs and JSON-LD; the e2e fixture (tests/fixtures/qa-seed.ts:
// one dentist, one guide, one case, one testimonial) fills the people sections. The empty states
// of the hubs (no dentist or guide published) are unit-tested (lists.test.tsx PL1, PL3): this
// database always has the fixture. The address page's hours state arrives after `load` without
// moving anything; its phones are LTR islands; no template scrolls sideways at 320 px.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const DENTISTS = '/پزشکان';
const DENTIST = '/پزشکان/دکتر-نمونه-آزمایشی';
const ABOUT = '/درباره-ما';
const ADDRESS = '/آدرس';
const GUIDES = '/راهنمای-بیمار';
const GUIDE = '/راهنمای-بیمار/اولین-مراجعه';
const ALL = [DENTISTS, DENTIST, ABOUT, ADDRESS, GUIDES, GUIDE];

// hoursBadgeLabels() (src/i18n/fa-ui.ts): today's state, never in the server HTML (CC-6).
// hoursSummary() (src/lib/hoursState.ts): the hours line with the holiday exception (freeze F14).
const HOURS_LINE = 'هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.';
// Under the hours table only the caveat: the rows already say «هر روز» and «۱۰ تا ۲۰».
const HOURS_CAVEAT = 'به\u200Cجز تعطیلات رسمی.';

const HOURS_STATES =
  /^(الان باز است|کمی بعد بسته می‌شود|هنوز باز نشده است|الان بسته است|امروز تعطیل رسمی است)$/;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(encodeURI(path));
  expect(response?.status(), path).toBe(200);
  await page.waitForLoadState('load');
}

/** The data-section ids of the page body, in document order. */
const sections = (page: Page) =>
  page
    .locator('main [data-section]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-section')));

type Node = { '@type': string; [key: string]: unknown };

async function jsonLd(page: Page): Promise<Node[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.flatMap((text) => (JSON.parse(text) as { '@graph': Node[] })['@graph']);
}

const ofType = (nodes: Node[], type: string) => nodes.filter((n) => n['@type'] === type);

/** Breadcrumb labels from the JSON-LD (the visible trail shows only the parent on phones). */
async function crumbNames(page: Page): Promise<string[]> {
  const [list] = ofType(await jsonLd(page), 'BreadcrumbList');
  return (list?.itemListElement as Array<{ name: string }>).map((item) => item.name);
}

async function expectCanonical(page: Page, path: string): Promise<void> {
  const href = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(new URL(href ?? '').pathname).toBe(encodeURI(path));
}

test('T-PG1 dentists hub: H1, the fixture dentist card, no empty state, ItemList JSON-LD', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, DENTISTS);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('پزشکان کلینیک دندانپزشکی سفید');
  // The team text (K) has no content in the seed, so it stays hidden.
  expect(await sections(page)).toEqual(['dentists', 'booking']);
  const card = page
    .locator('[data-section="dentists"]')
    .getByRole('link', { name: 'دکتر نمونهٔ آزمایشی' });
  await expect(card).toHaveAttribute('href', DENTIST);
  await expect(page.getByText(/معرفی دندانپزشکان کلینیک هنوز منتشر نشده است/)).toHaveCount(0);
  // The booking block (J) gives the hours table with its holiday exception next to the form,
  // without repeating the rows in a sentence.
  const booking = page.locator('[data-section="booking"]');
  await expect(booking.getByText(HOURS_CAVEAT, { exact: true })).toBeVisible();
  await expect(booking.getByText(HOURS_LINE)).toHaveCount(0);
  await expectCanonical(page, DENTISTS);
  expect(await crumbNames(page)).toEqual(['خانه', 'پزشکان']);
  const [list] = ofType(await jsonLd(page), 'ItemList');
  expect((list?.itemListElement as Array<{ name: string }>).map((i) => i.name)).toContain(
    'دکتر نمونهٔ آزمایشی',
  );
});

test('T-PG2 dentist profile: portrait split, council number LTR, filled sections only, Physician JSON-LD', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, DENTIST);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('دکتر نمونهٔ آزمایشی');
  // The fixture has a degree, a bio, two services and a case; articles arrive in phase 6.
  expect(await sections(page)).toEqual(['facts', 'bio', 'services', 'cases', 'booking']);
  // Stored as 0000000; shown in Persian digits inside the LTR island.
  const council = page.locator('main header bdi', { hasText: '۰۰۰۰۰۰۰' });
  await expect(council).toHaveAttribute('dir', 'ltr');
  const book = page.locator('main header').getByRole('link', { name: 'رزرو نوبت' });
  await expect(book).toHaveAttribute('data-booking-cta', '');
  const call = page.locator('main header').getByRole('link', { name: 'تماس با کلینیک' });
  await expect(call).toHaveAttribute('href', 'tel:+982155101054');
  await expect(call).toHaveAttribute('data-call-sheet', '');
  await expect(page.locator('[data-section="services"] a').first()).toHaveAttribute('href', /^\//);
  // The booking block carries the profile's dentist.
  await expect(page.locator('[data-section="booking"] input[name="dentist"]')).toHaveValue(
    DENTIST.split('/')[2]!,
  );
  await expectCanonical(page, DENTIST);
  expect(await crumbNames(page)).toEqual(['خانه', 'پزشکان', 'دکتر نمونهٔ آزمایشی']);
  const [physician] = ofType(await jsonLd(page), 'Physician');
  expect(physician).toMatchObject({
    name: 'دکتر نمونهٔ آزمایشی',
    medicalSpecialty: 'https://schema.org/Dentistry',
    identifier: { value: '0000000' },
  });
  expect(physician).toHaveProperty('memberOf');
  expect(physician).not.toHaveProperty('worksFor');
});

test('T-PG3 about: story with VIP and CIP as LTR islands, unverified numbers hidden, team and voices', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, ABOUT);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('درباره کلینیک دندانپزشکی سفید');
  // clinic.stats are all unverified (gap 15) and no steps block is seeded: both hide.
  expect(await sections(page)).toEqual(['story', 'team', 'voices', 'booking']);
  for (const word of ['VIP', 'CIP']) {
    await expect(page.locator('[data-section="story"] bdi', { hasText: word })).toHaveAttribute(
      'dir',
      'ltr',
    );
  }
  await expect(
    page.locator('main header').getByRole('link', { name: 'رزرو نوبت' }),
  ).toHaveAttribute('data-booking-cta', '');
  await expectCanonical(page, ABOUT);
  expect(await crumbNames(page)).toEqual(['خانه', 'درباره کلینیک دندانپزشکی سفید']);
});

test('T-PG4 address: NAP with phones as LTR islands, hours table, WhatsApp hidden until verified, J-form without a map', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, ADDRESS);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'آدرس و ساعات کاری کلینیک دندانپزشکی سفید',
  );
  expect(await sections(page)).toEqual(['contact', 'access', 'booking']);
  const contact = page.locator('[data-section="contact"]');
  for (const [href, text] of [
    ['tel:+982155101054', '۰۲۱ ۵۵۱۰ ۱۰۵۴'],
    ['tel:+989205451054', '۰۹۲۰ ۵۴۵ ۱۰۵۴'],
  ]) {
    const phone = contact.locator(`a[href="${href}"]`);
    await expect(phone).toHaveAttribute('dir', 'ltr');
    await expect(phone).toHaveText(text!);
  }
  await expect(contact.getByRole('rowheader', { name: 'هر روز' })).toBeVisible();
  const call = page.locator('main header').getByRole('link', { name: 'تماس با کلینیک' });
  await expect(call).toHaveAttribute('data-call-sheet', '');
  // whatsappVerified is false in the seed (gap 16, freeze F12).
  await expect(page.locator('main a[href^="https://wa.me/"]')).toHaveCount(0);
  await expect(page.locator('[data-section="booking"]')).toHaveAttribute('data-family', 'J-form');
  await expect(page.locator('[data-section="booking"]').getByText(/جای عکس/)).toHaveCount(0);
  await expect(
    page.locator('[data-section="booking"]').getByText(HOURS_CAVEAT, { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-section="booking"]').getByText(HOURS_LINE)).toHaveCount(0);
  await expectCanonical(page, ADDRESS);
});

test('T-PG5 address: the live hours state arrives after load, never in the server HTML, without a layout shift', async ({
  page,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  // The labels travel to the island as props; a rendered state would be element text.
  const html = await (await request.get(encodeURI(ADDRESS))).text();
  for (const label of HOURS_STATES.source.slice(2, -2).split('|')) {
    expect(html).not.toContain(`>${label}<`);
  }

  // Hold the form session until the page is measured, then let it answer.
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/form-session', async (route) => {
    await gate;
    await route.continue();
  });
  await open(page, ADDRESS);
  const contact = page.locator('[data-section="contact"]');
  const table = contact.locator('table');
  await expect(contact.locator('.animate-pulse')).toHaveCount(1);
  const before = await table.boundingBox();
  release();
  await expect(contact.getByText(HOURS_STATES)).toBeVisible();
  await expect(contact.locator('.animate-pulse')).toHaveCount(0);
  expect(await table.boundingBox()).toEqual(before);
});

test('T-PG6 guide hub: H1, the published guide card, no empty state, ItemList JSON-LD', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page, GUIDES);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('راهنمای بیمار');
  expect(await sections(page)).toEqual(['guides', 'booking']);
  const card = page.locator('[data-section="guides"]').getByRole('link', {
    name: 'نمونهٔ آزمایشی: اولین مراجعه به کلینیک',
  });
  await expect(card).toHaveAttribute('href', GUIDE);
  await expect(page.getByText(/راهنماها پس از بازبینی دندانپزشک/)).toHaveCount(0);
  await expectCanonical(page, GUIDES);
  const [list] = ofType(await jsonLd(page), 'ItemList');
  expect(list?.itemListElement).toHaveLength(1);
});

test('T-PG7 guide: reviewer and sources shown, TOC on desktop only, MedicalWebPage and FAQPage JSON-LD', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, GUIDE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'نمونهٔ آزمایشی: اولین مراجعه به کلینیک',
  );
  expect(await sections(page)).toEqual(['reading', 'booking']);
  const reviewer = page.locator('main header').getByRole('link', { name: 'دکتر نمونهٔ آزمایشی' });
  await expect(reviewer).toHaveAttribute('href', DENTIST);
  await expect(page.locator('main header time')).toHaveCount(2);
  await expect(page.getByRole('heading', { level: 2, name: 'منابع' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'نمونهٔ آزمایشی: منبع نمونه' })).toHaveAttribute(
    'href',
    'https://example.org/qa-fixture',
  );
  // The one service link of the CTA map, whatever the body links to.
  await expect(
    page.locator('[data-section="reading"]').getByRole('link', { name: 'همهٔ خدمات' }),
  ).toHaveAttribute('href', '/خدمات');
  const toc = page.getByRole('navigation', { name: 'در این صفحه' });
  if (testInfo.project.name === 'desktop-light') await expect(toc).toBeVisible();
  else await expect(toc).toBeHidden();
  await expectCanonical(page, GUIDE);
  expect(await crumbNames(page)).toEqual([
    'خانه',
    'راهنمای بیمار',
    'نمونهٔ آزمایشی: اولین مراجعه به کلینیک',
  ]);
  const nodes = await jsonLd(page);
  const [webpage] = ofType(nodes, 'MedicalWebPage');
  expect(webpage).toMatchObject({ reviewedBy: { '@type': 'Person', name: 'دکتر نمونهٔ آزمایشی' } });
  expect(webpage?.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(ofType(nodes, 'FAQPage')).toHaveLength(1);
  expect(ofType(nodes, 'Article')).toHaveLength(0);
});

test('T-PG8 no template scrolls sideways from 320 px', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const width of [320, 744]) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ALL) {
      await open(page, path);
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, `${path} at ${width} px`).toBeLessThanOrEqual(client);
    }
  }
});

test('T-PG9 no two landmarks share a name (axe landmark-unique, outside the WCAG tag set)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  for (const path of ALL) {
    await open(page, path);
    const { violations } = await new AxeBuilder({ page })
      .withRules(['landmark-unique'])
      .exclude('[data-dev-overlay]')
      .analyze();
    const nodes = violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')));
    expect(nodes, path).toEqual([]);
  }
});
