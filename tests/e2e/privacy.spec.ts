// Privacy page draft (phase 5 deliverable 8, freeze G17): it answers 200 with one H1 and the
// legal page type, is reached from the booking form's privacy line and from the footer, says what
// the booking form stores and who sees it, and gives the clinic phone. Hrefs hold the raw Persian
// path (React writes it as given).
import { expect, test, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

const PRIVACY = '/حریم-خصوصی';
const PRICING = '/هزینه-و-پرداخت';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test('T-PV1 the privacy page states what the form stores and who sees it', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  // Reached from the booking privacy line «حریم خصوصی» (pricing has the booking block).
  await page.goto(encodeURI(PRICING));
  const line = page
    .locator('[data-section="booking"]')
    .getByRole('link', { name: t('booking.privacyLink') });
  await expect(line).toHaveAttribute('href', PRIVACY);
  await line.click();
  await expect(page).toHaveURL(new RegExp(`${encodeURI(PRIVACY)}$`));
  expect((await page.reload())?.status()).toBe(200); // the click may navigate client-side
  await expect(page.locator('[data-page-type="legal"]')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('حریم خصوصی');
  await expect(page).toHaveTitle('حریم خصوصی | کلینیک دندانپزشکی سفید');
  const main = page.locator('main');
  for (const heading of ['فرم‌ها چه چیزهایی را نگه می‌دارند؟', 'چه کسانی آن را می‌بینند؟']) {
    await expect(main.getByRole('heading', { level: 2, name: heading })).toBeVisible();
  }
  await expect(main).toContainText('تا وقتی «مدیر» آن‌ها را حذف کند');
  // GA4 is off in the seed: no analytics paragraph.
  await expect(main).not.toContainText(t('pages.privacy.ga4Text'));
  // The closed booking dialog (freeze G7) holds its own call link and form.
  await expect(main.locator('a[href="tel:+982155101054"]:not(dialog a)')).toBeVisible();
  // T-legal has no booking form in the page itself; the sticky bar stays (phones).
  await expect(main.locator('form:not(dialog form)')).toHaveCount(0);
});

test('T-PV2 the footer links to the privacy page', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/');
  const link = page.locator(`footer a[href="${PRIVACY}"]`).first();
  await expect(link).toHaveCount(1);
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${encodeURI(PRIVACY)}$`));
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('حریم خصوصی');
});
