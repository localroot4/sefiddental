// Pricing and payment page (phase 5 deliverable 5; pricing-tiers-measure 1.2): the T-pricing
// sections in docs/ia.md order, the five insurers by name and never «سایر بیمه» or «طرف قرارداد»
// (freeze G1, F31), the financing option the QA fixture enables (QA-FIN) with its surcharge note on
// screen whenever its title is (G14, C12), the disabled one absent, and no sideways scroll.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

const PRICING = '/هزینه-و-پرداخت';
const PRIVACY = '/حریم-خصوصی';
const RESTORATION = '/خدمات/ترمیم-دندان';
const INSURERS = ['بیمه ایران', 'بیمه کارآفرین', 'بیمه پاسارگاد', 'بیمه البرز', 'بیمه ما'];
// docs/ia.md T-pricing sections after the hero, as data-section ids; `financing` is there because
// the QA fixture enables the partner loan (QA-FIN).
const ORDER = ['how', 'tiers', 'insurers', 'financing', 'faq', 'booking'];

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page, path: string): Promise<void> {
  const response = await page.goto(encodeURI(path));
  expect(response?.status(), path).toBe(200);
  await page.waitForLoadState('load');
}

test('T-PR1 sections in order, one H1, insurers by name, no unconfirmed insurer claim', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await open(page, PRICING);
  await expect(page.locator('[data-page-type="pricing"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('هزینه‌ها، بیمه و شرایط پرداخت');
  await expect(page).toHaveTitle('هزینه دندانپزشکی و بیمه | کلینیک دندانپزشکی سفید');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    new RegExp(`${encodeURI(PRICING)}$`),
  );
  const sections = await page
    .locator('[data-page-type="pricing"] [data-section]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-section')));
  expect(sections).toEqual(ORDER);

  const insurers = page.locator('[data-section="insurers"]');
  await expect(insurers.getByRole('heading', { level: 2 })).toHaveText('همکاری با بیمه‌ها');
  for (const name of INSURERS)
    await expect(insurers.getByText(name, { exact: true })).toBeVisible();
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/سایر بیمه|طرف قرارداد/);
  // No price is seeded (gap 14): no «از … تومان» line (brief decision 4).
  expect(text).not.toMatch(/از [۰-۹٬]+ تومان/);
  // The seed keeps the free consultation on; the hero line (the booking block repeats it).
  await expect(page.locator('main header').getByText(t('content.freeConsultation'))).toBeVisible();
  // The disabled option never renders.
  expect(text).not.toContain('اعتبار دندانپزشکی');
  await expect(page.locator('[data-financing]')).toHaveCount(1);
  // The hero books; the booking block is the page's one form.
  await expect(
    page.locator('main header').getByRole('link', { name: t('pages.book') }),
  ).toBeVisible();
  await expect(page.locator('[data-section="booking"] form')).toHaveCount(1);

  const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .flatMap((json) => (JSON.parse(json) as { '@graph': Array<{ '@type': string }> })['@graph'])
    .map((node) => node['@type']);
  expect(nodes).toEqual(expect.arrayContaining(['BreadcrumbList', 'FAQPage']));
});

test('T-PR2 the surcharge note is on screen above the sticky bar when the option title is at the top', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light');
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    await open(page, PRICING);
    const card = page.locator('[data-financing="partner-loan"]');
    const title = card.getByRole('heading', { level: 3 });
    await expect(title).toHaveText('وام درمان');
    // Scroll the title to just under the header, as a reader scrolling down meets it.
    await title.evaluate((el) => {
      const header = document.querySelector('header')?.getBoundingClientRect().height ?? 0;
      window.scrollBy(0, el.getBoundingClientRect().top - header);
    });
    const note = card.getByText(t('pages.pricing.surcharge'));
    await expect(note).toContainText('حدود ۲۰ تا ۳۰ درصد بیشتر از پرداخت نقدی');
    const box = (await note.boundingBox())!;
    const bar = await page.locator('[data-sticky-bar]').boundingBox();
    const limit = bar && bar.height > 0 ? bar.y : viewport.height;
    expect(box.y, `${viewport.width}x${viewport.height}`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${viewport.width}x${viewport.height}`).toBeLessThanOrEqual(limit);
    // The cap in words and the legal line; WhatsApp stays hidden while unverified (F12).
    await expect(card).toContainText('تا ۲۰۰ میلیون تومان');
    await expect(card).toContainText(t('pages.pricing.finalDetails'));
    await expect(card.locator('a[href^="https://wa.me/"]')).toHaveCount(0);
    await context.close();
  }
});

test('T-PR3 pricing, privacy and restoration never scroll sideways from 320 to 1920 px', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const width of [320, 360, 390, 430, 744, 820, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [PRICING, PRIVACY, RESTORATION]) {
      await open(page, path);
      const [scroll, client] = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.clientWidth,
      ]);
      expect(scroll, `${path} at ${width} px`).toBeLessThanOrEqual(client);
    }
  }
});
