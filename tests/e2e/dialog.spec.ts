// The booking dialog (phase 5 deliverable 1, prompt step 2; docs/conversion.md 5; freeze G7) on
// /qa/not-found: the 404 template with status 200 (QA_ROUTES=1), a page with no inline booking
// form. Keyboard: Enter opens it, Tab stays inside, Esc closes, focus returns to the opener; the
// page behind never scrolls; touch focuses the heading; the CTA's service and tier ride along.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import { expectNoA11yViolations } from '../helpers/axe';
import {
  formsHydrated,
  isolateClient,
  maskedPhone,
  recordBeacons,
  recordEvents,
  uniquePhone,
} from '../helpers/booking';
import { requireRoutes } from '../helpers/pending';
import { captureTemplate } from '../helpers/screens';
import { projectTheme } from '../helpers/theme';

const PAGE = '/qa/not-found';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(() => requireRoutes('bookingDialog'));

const isDesktop = (testInfo: TestInfo) => testInfo.project.name.startsWith('desktop');
const dialog = (page: Page) => page.getByRole('dialog', { name: t('booking.heading') });
/** The chrome's «رزرو نوبت»: the header pill from 1024 px, the sticky bar under it. */
const bookCta = (page: Page, testInfo: TestInfo) =>
  isDesktop(testInfo)
    ? page.getByRole('banner').getByRole('link', { name: t('nav.book') })
    : page.locator('[data-sticky-bar]').getByRole('link', { name: t('nav.book') });

/** The page loaded and every island ran (DOM added later survives hydration). */
async function open(page: Page): Promise<void> {
  await page.goto(PAGE);
  await formsHydrated(page);
  await expect(page.locator('[popovertarget="mega-menu"]')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  // A page long enough to scroll, so the lock is observable.
  await page.evaluate(() => {
    const filler = document.createElement('div');
    filler.style.minHeight = '200vh'; // CSSOM, not a style attribute: the CSP allows it
    document.querySelector('main')!.append(filler);
  });
}

const insideDialog = (page: Page) =>
  page.evaluate(() => Boolean(document.activeElement?.closest('dialog[data-booking-dialog]')));

test('T-DLG1 keyboard: Enter opens it on the phone field, Tab stays inside, Esc returns focus', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'desktop-dark');
  await open(page);
  await page.evaluate(() => window.scrollTo(0, 200));
  const cta = bookCta(page, testInfo);
  await cta.focus();
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByLabel(t('booking.phone'))).toBeFocused();
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    expect(await insideDialog(page), `Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 10; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await insideDialog(page), `Shift+Tab ${i + 1}`).toBe(true);
  }
  // Scroll lock at every width (X7): the page behind stays where it was.
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.move(20, 20);
  await page.mouse.wheel(0, 800);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  // A token check: SiteShell's `max-lg:has-[dialog:modal]:overflow-hidden` is always there.
  await expect(page.locator('html')).toContainClass('overflow-hidden');
  await expectNoA11yViolations(page);

  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(cta).toBeFocused();
  await expect(page.locator('html')).not.toContainClass('overflow-hidden');
  // The close button closes it too.
  await page.keyboard.press('Enter');
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .getByRole('button', { name: t('booking.close') })
    .click();
  await expect(dialog(page)).toBeHidden();
  await expect(cta).toBeFocused();
});

test('T-DLG2 touch: a tap focuses the heading; the sticky bar steps aside while it is open', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-light');
  await open(page);
  const bar = page.locator('[data-sticky-bar]');
  await bar.getByRole('link', { name: t('nav.book') }).tap();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('heading', { name: t('booking.heading') })).toBeFocused();
  // The bar slides out below the screen while a dialog is open (conversion.md 4 c).
  const viewport = page.viewportSize()!;
  const top = async () => (await bar.boundingBox())?.y ?? 0;
  await expect.poll(top).toBeGreaterThanOrEqual(viewport.height);
  // A bottom sheet under 1024 px, never taller than the screen.
  await expect
    .poll(async () => {
      const box = await dialog(page).boundingBox();
      return box ? Math.round(box.y + box.height) : 0;
    })
    .toBe(viewport.height);
  expect((await dialog(page).boundingBox())!.height).toBeLessThanOrEqual(viewport.height);
  await expectNoA11yViolations(page);
  await dialog(page)
    .getByRole('button', { name: t('booking.close') })
    .tap();
  await expect(dialog(page)).toBeHidden();
  await expect.poll(top).toBeLessThan(viewport.height);
});

test('T-DLG3 a CTA with a service and a tier opens the dialog with both', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page);
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = '/رزرو-نوبت?service=implant&tier=vip';
    link.textContent = 'cta';
    link.id = 'dlg-cta';
    link.dataset.bookingCta = '';
    link.dataset.bookingGroup = 'implant';
    document.querySelector('main')!.prepend(link);
  });
  await page.locator('#dlg-cta').click();
  const form = dialog(page).locator('form');
  await expect(form.locator('input[name="service_key"]')).toHaveValue('implant');
  await expect(form.locator('input[name="tier"]')).toHaveValue('vip');
  await expect(form.getByRole('radio', { name: t('booking.group.implant') })).toBeChecked();
  await expect(form.locator('input[name="location"]')).toHaveValue('dialog');
  expect(decodeURI(new URL(page.url()).pathname)).toBe(PAGE);
});

test('T-DLG4 a request from the dialog: success in place, events with location dialog', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await isolateClient(context);
  const beacons = await recordBeacons(page);
  const events = await recordEvents(page);
  const phone = uniquePhone(testInfo);
  await open(page);
  const cta = bookCta(page, testInfo);
  await (isDesktop(testInfo) ? cta.click() : cta.tap());
  await dialog(page).getByLabel(t('booking.phone')).fill(phone);
  await dialog(page)
    .getByRole('button', { name: t('booking.submit') })
    .click();
  const done = dialog(page).getByRole('heading', { name: t('booking.done') });
  await expect(done).toBeFocused();
  await expect(dialog(page).getByText(maskedPhone(phone))).toBeVisible();
  await expect(
    dialog(page).getByRole('heading', { name: t('booking.bringHeading') }),
  ).toBeVisible();
  await expect(dialog(page).getByRole('link', { name: t('call.label') })).toBeVisible();
  await expectNoA11yViolations(page);
  const opens = (await beacons())
    .map((body) => JSON.parse(body) as Record<string, string>)
    .filter((b) => b.event === 'booking_open');
  expect(opens.map((b) => b.location)).toEqual([isDesktop(testInfo) ? 'header' : 'sticky']);
  const submits = (await events()).filter(([name]) => name === 'booking_submit');
  expect(submits).toEqual([['booking_submit', expect.objectContaining({ location: 'dialog' })]]);
  await dialog(page)
    .getByRole('button', { name: t('booking.close') })
    .click();
  await expect(dialog(page)).toBeHidden();
});

test('T-DLG5 without JavaScript the CTA is a real link to the booking page', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(PAGE);
  await page
    .getByRole('banner')
    .getByRole('link', { name: t('nav.book') })
    .click();
  await page.waitForURL((url) => decodeURI(url.pathname) === '/رزرو-نوبت');
  await expect(page.locator('#bk-page form')).toBeVisible();
  await context.close();
});

test('T-DLG6 one form instance: reopening keeps one dialog form and unique ids', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await open(page);
  const cta = bookCta(page, testInfo);
  await cta.click();
  await dialog(page).getByLabel(t('booking.phone')).fill('0912');
  await page.keyboard.press('Escape');
  await cta.click();
  // Typed values stay while the page lives (booking-pipeline 4.2).
  await expect(dialog(page).getByLabel(t('booking.phone'))).toHaveValue('0912');
  await expect(page.locator('[data-booking-form]')).toHaveCount(1);
  await expect(page.locator('[data-booking-dialog]')).toHaveCount(1);
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicates).toEqual([]);
  expect(await page.locator('[id^="bk-dialog-"]').count()).toBeGreaterThan(0);
});

test('T-DLG7 at 390, 820 and 1440 px the page behind stays put; the dialog open, error and done', async ({
  page,
  context,
}, testInfo) => {
  await isolateClient(context);
  const theme = projectTheme(testInfo);
  await open(page);
  const cta = bookCta(page, testInfo);
  await (isDesktop(testInfo) ? cta.click() : cta.tap());
  await expect(dialog(page)).toBeVisible();
  const html = page.locator('html');
  await expect(html).toContainClass('overflow-hidden');
  // A wheel over the backdrop, or over the sheet that fills a phone: the page never moves (X7).
  const scrollY = await page.evaluate(() => window.scrollY);
  await page.mouse.move(5, 5);
  await page.mouse.wheel(0, 800);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY);
  await captureTemplate(page, testInfo, 'dialog-open', theme, { fullPage: false });

  // An empty submit: the inline error inside the dialog (qa-budgets 4.2 dialog-error).
  await dialog(page)
    .getByRole('button', { name: t('booking.submit') })
    .click();
  await expect(dialog(page).getByLabel(t('booking.phone'))).toHaveAttribute('aria-invalid', 'true');
  await captureTemplate(page, testInfo, 'dialog-error', theme, { fullPage: false });

  await dialog(page).getByLabel(t('booking.phone')).fill(uniquePhone(testInfo));
  await dialog(page)
    .getByRole('button', { name: t('booking.submit') })
    .click();
  await expect(dialog(page).getByRole('heading', { name: t('booking.done') })).toBeFocused();
  await captureTemplate(page, testInfo, 'dialog-success', theme, { fullPage: false });
  await dialog(page)
    .getByRole('button', { name: t('booking.close') })
    .click();
  await expect(dialog(page)).toBeHidden();
  await expect(html).not.toContainClass('overflow-hidden');
});
