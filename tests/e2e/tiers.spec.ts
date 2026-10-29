// Restoration tiers finalized (phase 5 deliverable 6, freeze G13 and F24): swipeable cards on
// phones and three columns from 1024 px; nothing chosen on load; choosing a tier warms only its card
// (CSS from data-choice and data-checked, ChromeScripts; without JavaScript from :has() rules that
// exist only then) and the one «رزرو نوبت» under the cards carries the tier;
// with JavaScript the booking block gets the tier and tier_select is sent once. T-SV3 in
// services.spec.ts keeps its phase 4 assertions: one visible «رزرو نوبت», `?service=restoration`.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

const RESTORATION = '/خدمات/ترمیم-دندان';
const TIERS = '[id="سطح-ترمیم"]';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page): Promise<void> {
  const response = await page.goto(encodeURI(`${RESTORATION}#سطح-ترمیم`));
  expect(response?.status()).toBe(200);
  await page.waitForLoadState('load');
}

/**
 * The bodies the page hands to navigator.sendBeacon: Playwright reports a beacon request without
 * its body, so a wrapper installed before any page script records them.
 */
async function recordBeacons(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { __beacons: string[] }).__beacons = sent;
    const send = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob) void data.text().then((text) => sent.push(text));
      else sent.push(String(data));
      return send(url, data);
    };
  });
  return () => page.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons);
}

/** The computed background of the token, resolved by a probe element. */
async function tokenColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

const backgrounds = (page: Page) =>
  page
    .locator(`${TIERS} article`)
    .evaluateAll((cards) => cards.map((card) => getComputedStyle(card).backgroundColor));

test('T-TR1 phones: a snap scroller, nothing chosen and no warm card on load', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light');
  await open(page);
  const scroller = page.locator(`${TIERS} [role="region"]`);
  await expect(scroller).toHaveCSS('scroll-snap-type', 'x mandatory');
  await expect(scroller).toHaveCSS('overflow-x', 'auto');
  await expect(page.locator(`${TIERS} input[type="radio"]:checked`)).toHaveCount(0);
  const warm = await tokenColor(page, '--color-warm-soft');
  expect(await backgrounds(page)).not.toContain(warm);
});

test('T-TR2 desktop: three columns side by side', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page);
  const tops = await page
    .locator(`${TIERS} article`)
    .evaluateAll((cards) => cards.map((card) => Math.round(card.getBoundingClientRect().top)));
  expect(tops).toHaveLength(3);
  expect(new Set(tops).size).toBe(1);
});

test('T-TR3 choosing VIP warms its card, the CTA carries the tier, the block gets it', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  const beacons = await recordBeacons(page);
  await open(page);
  const tiers = page.locator(TIERS);
  await tiers.getByRole('radio', { name: 'VIP' }).check();
  const warm = await tokenColor(page, '--color-warm-soft');
  const vip = tiers.locator('article').nth(1); // VIP is the second card
  // Retried: the card fades to the warm token (transition-colors).
  await expect(vip).toHaveCSS('background-color', warm);
  expect((await backgrounds(page)).filter((c) => c === warm)).toHaveLength(1);
  // Every card carries the badge, hidden until its radio is checked.
  await expect(vip.getByText(t('pages.tiers.chosen'))).toBeVisible();
  await expect(tiers.getByText(t('pages.tiers.chosen')).filter({ visible: true })).toHaveCount(1);

  const book = tiers.getByRole('link', { name: t('services.book') });
  await expect(book).toHaveCount(1); // one visible primary for the section
  await expect(book).toHaveAttribute('href', /\?service=restoration&tier=vip$/);
  await expect
    .poll(async () => (await beacons()).filter((b) => b.includes('"tier_select"')).length)
    .toBe(1);

  await book.click();
  const form = page.locator('[data-section="booking"] form');
  await expect(form.locator('input[name="tier"]')).toHaveValue('vip');
  await expect(form.locator('input[name="service_key"]')).toHaveValue('restoration');
  expect((await beacons()).join('\n')).not.toMatch(/09\d{9}|\+98/); // no phone in any beacon
});

test('T-TR4 without JavaScript the choice still swaps the CTA, which opens the booking page', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await open(page);
  const tiers = page.locator(TIERS);
  const book = tiers.getByRole('link', { name: t('services.book') });
  await expect(book).toHaveAttribute('href', /\?service=restoration$/);
  // A tap on the card: the label's ::after covers it, so the label takes the click.
  await tiers.locator('article').nth(1).click();
  await expect(tiers.getByRole('radio', { name: 'VIP' })).toBeChecked();
  // The card turns warm with its badge, through the no-JS :has() rules.
  const warm = await tokenColor(page, '--color-warm-soft');
  await expect(tiers.locator('article').nth(1)).toHaveCSS('background-color', warm);
  expect((await backgrounds(page)).filter((c) => c === warm)).toHaveLength(1);
  await expect(tiers.getByText(t('pages.tiers.chosen')).filter({ visible: true })).toHaveCount(1);
  await expect(book).toHaveCount(1);
  await expect(book).toHaveAttribute('href', /\?service=restoration&tier=vip$/);
  await book.click();
  await page.waitForURL(/tier=vip/);
  const url = new URL(page.url());
  expect(decodeURIComponent(url.pathname)).toBe('/رزرو-نوبت');
  expect(url.search).toBe('?service=restoration&tier=vip');
  await context.close();
});
