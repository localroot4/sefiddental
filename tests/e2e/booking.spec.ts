// The booking page /رزرو-نوبت and the success page /رزرو-نوبت/ثبت-شد against the real request
// pipeline (phase 5 deliverables 1 and 9; docs/conversion.md 5 and 6; freeze G3-G9). Every test
// that submits runs as its own client with its own phone (tests/helpers/booking.ts) and gets past
// the 2 s time trap: the island holds a JS submit itself (G5); no-JS tests wait.
import { readFile } from 'node:fs/promises';

import { expect, test, type Page, type Request, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';
import { toPersianDigits } from '@/lib/persianText';
import { PHONE_ERRORS } from '@/lib/phone';

import { expectNoA11yViolations, expectNoA11yViolationsWithoutJs } from '../helpers/axe';
import {
  countBookingPosts,
  formsHydrated,
  isolateClient,
  landsOn,
  maskedPhone,
  pastTimeTrap,
  postBooking,
  recordBeacons,
  recordEvents,
  uniquePhone,
} from '../helpers/booking';
import { watchConsoleErrors } from '../helpers/console';
import { requireRoutes } from '../helpers/pending';
import { captureTemplate } from '../helpers/screens';
import { projectTheme } from '../helpers/theme';

const BOOKING = '/رزرو-نوبت';
const SUCCESS = '/رزرو-نوبت/ثبت-شد';
const NOTE_TOO_LONG = t('booking.noteTooLong');

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(() => requireRoutes('booking', 'bookingSuccess'));

const form = (page: Page) => page.locator('#bk-page');
const submitButton = (page: Page) => form(page).getByRole('button', { name: t('booking.submit') });
const path = (page: Page) => decodeURI(new URL(page.url()).pathname);

/** Opens the booking page with JavaScript and waits for the island. */
async function openBooking(page: Page, query = ''): Promise<void> {
  await page.goto(`${BOOKING}${query}`);
  await formsHydrated(page);
}

/** The success items of conversion.md 5.4 (1-6, WhatsApp hidden while unverified) in `root`. */
async function expectFullSuccess(root: ReturnType<Page['locator']>, phone: string) {
  await expect(root.getByRole('heading', { name: t('booking.done') })).toBeFocused();
  await expect(root.locator('svg.text-success')).toBeVisible();
  await expect(root.getByText(/پذیرش .*تماس می‌گیرد\./).first()).toBeVisible();
  await expect(root.locator('bdi[dir="ltr"]', { hasText: maskedPhone(phone) })).toBeVisible();
  await expect(root.getByRole('link', { name: t('booking.saveContact') })).toBeVisible();
  await expect(root.getByRole('heading', { name: t('booking.bringHeading') })).toBeVisible();
  const call = root.getByRole('link', { name: t('call.label') });
  await expect(call).toHaveAttribute('href', /^tel:\+98/);
  await expect(call).toHaveAttribute('data-call-sheet', '');
  await expect(root.getByRole('link', { name: t('booking.whatsapp') })).toHaveCount(0);
}

test('T-BK1 happy path with JavaScript: one POST, the success in place, one event each', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await isolateClient(context);
  const beacons = await recordBeacons(page);
  const events = await recordEvents(page);
  const errors = watchConsoleErrors(page);
  const posts = countBookingPosts(page);
  const phone = uniquePhone(testInfo);
  const response = await page.goto(`${BOOKING}?service=ceramic-laminate&utm_source=e2e`);
  expect(response?.headers()['cache-control']).toContain('no-store');
  await formsHydrated(page);
  // Parameters canonicalize away (ia.md T-booking).
  const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
  expect(decodeURI(new URL(canonical ?? '').pathname)).toBe(BOOKING);
  expect(new URL(canonical ?? '').search).toBe('');
  // The known service: one line with «تغییر» (conversion.md 5.1 row 3).
  await expect(form(page).getByText(t('booking.serviceKnown'))).toBeVisible();
  await expect(form(page).getByText(t('booking.serviceChange'))).toBeVisible();
  await expect(form(page).locator('input[name="service_key"]')).toHaveValue('ceramic-laminate');
  // The emergency link sits in the full form's help text off home (G10).
  await expect(form(page).getByRole('link', { name: t('urgent.label') })).toBeVisible();

  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await submitButton(page).click();
  await expectFullSuccess(form(page), phone);
  await expect(form(page)).toHaveAttribute('data-state', 'success');
  expect(path(page)).toBe(BOOKING);
  expect(posts()).toBe(1);

  const sent = (await beacons()).map((body) => JSON.parse(body) as Record<string, string>);
  const of = (event: string) => sent.filter((b) => b.event === event);
  expect(of('booking_open')).toEqual([expect.objectContaining({ location: 'page' })]);
  expect(of('booking_submit')).toEqual([expect.objectContaining({ location: 'page' })]);
  expect(of('booking_success')).toEqual([expect.objectContaining({ location: 'page' })]);
  const success = (await events()).filter(([name]) => name === 'booking_success');
  expect(success).toEqual([['booking_success', expect.objectContaining({ duplicate: false })]]);
  // No event carries the person (conversion.md 9).
  const all = JSON.stringify([sent, await events()]);
  expect(all).not.toContain(phone.slice(4));
  expect(all).not.toContain(toPersianDigits(phone.slice(4)));
  expect(errors()).toEqual([]);
});

test('T-BK2 client validation: the four messages, aria wiring, focus, values kept, no POST', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  const events = await recordEvents(page);
  const posts = countBookingPosts(page);
  await openBooking(page);
  const field = form(page).getByLabel(t('booking.phone'));
  const error = form(page).locator('#bk-page-phone-error');
  await submitButton(page).click();
  await expect(error).toHaveText(PHONE_ERRORS.empty);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAttribute('aria-describedby', 'bk-page-phone-help bk-page-phone-error');
  await expect(field).toBeFocused();
  await field.fill('0912 345');
  await field.blur();
  await expect(error).toHaveText(PHONE_ERRORS.invalid);
  await field.fill('021 5510 1054');
  await field.blur();
  await expect(error).toHaveText(PHONE_ERRORS.landline);
  // A press on the submit does not validate on blur first; the submit does (conversion.md 5.2).
  await field.fill('09123456789');
  await form(page).getByText(t('booking.noteSummary')).click();
  const note = form(page).getByLabel(t('booking.note'));
  await note.fill('ا'.repeat(501));
  await submitButton(page).click();
  await expect(form(page).locator('#bk-page-note-error')).toHaveText(NOTE_TOO_LONG);
  await expect(note).toHaveAttribute('aria-invalid', 'true');
  await expect(note).toBeFocused();
  await expect(field).toHaveValue('09123456789');
  expect(posts()).toBe(0);
  const types = (await events())
    .filter(([name]) => name === 'booking_error')
    .map(([, params]) => params.error_type);
  expect(types).toEqual(['phone_empty', 'phone_invalid', 'phone_landline', 'note_too_long']);
  await expectNoA11yViolations(page);
});

test('T-BK3 without JavaScript the server validates: landline, then a long note, values kept', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(context);
  const page = await context.newPage();
  await page.goto(BOOKING);
  const field = form(page).getByLabel(t('booking.phone'));
  await field.fill('021 5510 1054');
  await form(page).getByLabel(t('booking.name')).fill('نمونهٔ آزمایشی');
  await landsOn(page, BOOKING, () => submitButton(page).click());
  await expect(form(page).locator('#bk-page-phone-error')).toHaveText(PHONE_ERRORS.landline);
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await expect(field).toHaveAttribute('aria-describedby', 'bk-page-phone-help bk-page-phone-error');
  await expect(field).toHaveValue('021 5510 1054');
  await expect(form(page).getByLabel(t('booking.name'))).toHaveValue('نمونهٔ آزمایشی');

  await field.fill(uniquePhone(testInfo));
  await form(page).getByText(t('booking.noteSummary')).click();
  await form(page).getByLabel(t('booking.note')).fill('ا'.repeat(501));
  await landsOn(page, BOOKING, () => submitButton(page).click());
  await expect(form(page).locator('#bk-page-note-error')).toHaveText(NOTE_TOO_LONG);
  await expect(form(page).getByLabel(t('booking.note'))).toHaveAttribute('aria-invalid', 'true');
  await expect(form(page).locator('#bk-page-phone-error')).toHaveCount(0);
  await expectNoA11yViolationsWithoutJs(page, browser);
  await context.close();
});

test('T-BK4 Persian digits with spaces and 10 digits without the leading zero both submit', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await isolateClient(context);
  const persian = uniquePhone(testInfo);
  const tenDigits = uniquePhone(testInfo);
  for (const [typed, phone] of [
    [toPersianDigits(`${persian.slice(0, 4)} ${persian.slice(4, 7)} ${persian.slice(7)}`), persian],
    [tenDigits.slice(1), tenDigits],
  ] as const) {
    await openBooking(page);
    await form(page).getByLabel(t('booking.phone')).fill(typed);
    await submitButton(page).click();
    await expect(form(page).getByRole('heading', { name: t('booking.done') })).toBeFocused();
    await expect(form(page).getByText(maskedPhone(phone))).toBeVisible();
  }
});

test('T-BK5 a second request within 10 minutes is the neutral info state, not an error', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await isolateClient(context);
  const events = await recordEvents(page);
  const phone = uniquePhone(testInfo);
  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await submitButton(page).click();
  await expect(form(page)).toHaveAttribute('data-state', 'success');

  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await form(page).getByLabel(t('booking.name')).fill('نمونهٔ آزمایشی');
  await submitButton(page).click();
  const status = form(page)
    .getByRole('status')
    .filter({ hasText: t('booking.neutral') });
  await expect(status).toBeVisible();
  await expect(form(page).getByRole('alert')).toHaveCount(0);
  await expect(form(page)).toHaveAttribute('data-state', 'form');
  await expect(form(page).getByLabel(t('booking.phone'))).toHaveValue(phone);
  await expect(submitButton(page)).toBeEnabled();
  // The details went onto the first request as a note (admin T-AD10 and BH-DUP show the row).
  const success = (await events()).filter(([name]) => name === 'booking_success');
  expect(success).toEqual([['booking_success', expect.objectContaining({ duplicate: true })]]);
  await expectNoA11yViolations(page);
});

test('T-BK6 a 419 renews the token, keeps the values and the next press succeeds', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  await isolateClient(context);
  const phone = uniquePhone(testInfo);
  let posts = 0;
  let second: { request: Request; body: string } | null = null;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && decodeURI(new URL(request.url()).pathname) === BOOKING) {
      posts += 1;
      if (posts === 1) return route.fulfill({ status: 419, json: { ok: false, error: 'expired' } });
      second = { request, body: request.postData() ?? '' };
    }
    return route.continue();
  });
  await openBooking(page);
  const pageTs = await form(page).locator('input[name="ts"]').inputValue();
  expect(pageTs).toMatch(/^v1\./);
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await form(page).getByLabel(t('booking.name')).fill('نمونهٔ آزمایشی');
  const renewal = page.waitForResponse((response) =>
    response.url().includes('/api/form-session?renew='),
  );
  await submitButton(page).click();
  await expect(form(page).getByRole('alert')).toHaveText(t('booking.failed.expired'));
  const renewed = await renewal;
  expect(new URL(renewed.url()).searchParams.get('renew')).toBe(pageTs);
  const { ts: newTs } = (await renewed.json()) as { ts: string };
  await expect(form(page).getByLabel(t('booking.phone'))).toHaveValue(phone);
  await expect(form(page).getByLabel(t('booking.name'))).toHaveValue('نمونهٔ آزمایشی');
  await page.waitForTimeout(500);
  expect(posts).toBe(1); // never an automatic resubmit
  await submitButton(page).click();
  await expect(form(page)).toHaveAttribute('data-state', 'success');
  expect(posts).toBe(2);
  // The next press carries the renewed token and waits until it is 2 s old (G5), so the server
  // stores it clean, not «مشکوک» (E-BK13; the stored row: BH-FAST).
  const sent = second as { request: Request; body: string } | null;
  expect(sent?.body).toContain(newTs);
  // Both instants on the browser's network clock, the one the form's 2 s wait runs on: the test
  // process sees the renewal answer late on a loaded runner (1993 ms on CI run 61). The form
  // counts whole milliseconds (Date.now), so its 2000 can read 1999.x on this clock.
  const renewalTiming = renewed.request().timing();
  const renewedAt = renewalTiming.startTime + renewalTiming.responseEnd;
  expect(sent!.request.timing().startTime - renewedAt).toBeGreaterThanOrEqual(1999);
});

test('T-BK7 network and server failures show their message; nothing is posted again', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  let posts = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && decodeURI(new URL(request.url()).pathname) === BOOKING) {
      posts += 1;
      return posts === 1 ? route.abort('internetdisconnected') : route.fulfill({ status: 500 });
    }
    return route.continue();
  });
  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill('09123456789');
  await submitButton(page).click();
  await expect(form(page).getByRole('alert')).toContainText(
    t('booking.failed.network').slice(0, 20),
  );
  await expect(submitButton(page)).toBeEnabled();
  await submitButton(page).click();
  await expect(form(page).getByRole('alert')).toContainText(
    t('booking.failed.server').slice(0, 20),
  );
  await expect(form(page).getByLabel(t('booking.phone'))).toHaveValue('09123456789');
  await page.waitForTimeout(500);
  expect(posts).toBe(2);
  expect(path(page)).toBe(BOOKING);
  await expectNoA11yViolations(page);
});

test('T-BK8 a filled honeypot and a sub-2-second post both look like a success', async ({
  page,
  context,
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // Honeypot (conversion.md 5.3): stored as «مشکوک», answered like a real request.
  await isolateClient(context);
  await openBooking(page);
  await page.locator('input[name="extra_7"]').evaluate((input: HTMLInputElement) => {
    input.value = 'bot';
  });
  await form(page).getByLabel(t('booking.phone')).fill(uniquePhone(testInfo));
  await submitButton(page).click();
  await expect(form(page)).toHaveAttribute('data-state', 'success');

  // Too fast: the island always waits (G5), so the page's own tokens go straight back as a no-JS
  // post. GET to answer under 2 s bounds the token's age at the server: the trap fired, and the
  // answer is the same 303 to the success page (the «مشکوک» row: BH-FAST, admin T-AD13).
  const fast = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(fast);
  const quick = await fast.newPage();
  const started = Date.now();
  await quick.goto(BOOKING);
  const tokens = {
    csrf: await form(quick).locator('input[name="csrf"]').inputValue(),
    ts: await form(quick).locator('input[name="ts"]').inputValue(),
  };
  const posted = await postBooking(quick, { phone: uniquePhone(testInfo), ...tokens });
  expect(Date.now() - started, 'the post must answer within 2 s of the page').toBeLessThan(2000);
  expect(posted.status()).toBe(303);
  expect(decodeURI(new URL(posted.headers().location ?? '', quick.url()).pathname)).toBe(SUCCESS);
  await quick.goto(SUCCESS);
  await expect(quick.getByRole('heading', { level: 1, name: t('booking.done') })).toBeVisible();
  await fast.close();
});

test('T-BK9 without JavaScript the booking page reaches the one-time success page', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(context);
  const page = await context.newPage();
  const phone = uniquePhone(testInfo);
  await page.goto(BOOKING);
  const answered = Date.now();
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await pastTimeTrap(answered);
  const response = await landsOn(page, SUCCESS, () => submitButton(page).click());
  expect(response.headers()['cache-control']).toContain('no-store');
  const heading = page.getByRole('heading', { level: 1, name: t('booking.done') });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveAttribute('autofocus', '');
  await expectFullSuccess(page.locator('main'), phone);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('[data-sticky-bar]')).toHaveCount(0);
  await expectNoA11yViolationsWithoutJs(page, browser);
  // The flash is read once: a reload, and a fresh visitor, land on the booking page.
  await page.reload();
  expect(path(page)).toBe(BOOKING);
  const other = await browser.newContext({ javaScriptEnabled: false });
  const direct = await other.newPage();
  await direct.goto(SUCCESS);
  expect(path(direct)).toBe(BOOKING);
  await other.close();
  await context.close();
});

test('T-BK10 «ذخیرهٔ شمارهٔ کلینیک» downloads the clinic vCard, never the visitor', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await isolateClient(context);
  const beacons = await recordBeacons(page);
  const phone = uniquePhone(testInfo);
  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await submitButton(page).click();
  const save = form(page).getByRole('link', { name: t('booking.saveContact') });
  await expect(save).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), save.click()]);
  expect(download.suggestedFilename()).toBe('sefid-dental.vcf');
  const card = await readFile((await download.path()) ?? '', 'utf8');
  expect(card).toContain('BEGIN:VCARD');
  expect(card).toContain('+982155101054');
  expect(card).not.toContain(phone.slice(1));
  await expect
    .poll(async () => (await beacons()).filter((b) => b.includes('"save_contact"')).length)
    .toBe(1);
});

test('T-BK11 the button keeps its width while loading and a second press sends nothing', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  let posts = 0;
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.method() === 'POST' && decodeURI(new URL(request.url()).pathname) === BOOKING) {
      posts += 1;
      await held;
      return route.fulfill({ json: { ok: true, state: 'success', callback: null, masked: null } });
    }
    return route.continue();
  });
  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill('09123456789');
  const width = (await submitButton(page).boundingBox())?.width ?? 0;
  await submitButton(page).click();
  const loading = form(page).getByRole('button', { name: t('booking.submitting') });
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  expect((await loading.boundingBox())?.width).toBeCloseTo(width, 0);
  await loading.click({ force: true });
  await expect.poll(() => posts).toBe(1);
  release();
  await expect(form(page)).toHaveAttribute('data-state', 'success');
  // No callback from the server: the generic line (G6).
  await expect(form(page).getByText(t('booking.callbackGeneric'))).toBeVisible();
  expect(posts).toBe(1);
});

test('T-BK12 no layout shift when the session answer fills the call line', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Array<PerformanceEntry & { value: number }>) {
        w.__shifts.push(e.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/form-session', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.hours.callsAllowed = true;
    await held;
    await route.fulfill({ response, json });
  });
  await page.goto(BOOKING);
  await page.waitForLoadState('load');
  await submitButton(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const before = await page.evaluate(
    () => (window as unknown as { __shifts: number[] }).__shifts.length,
  );
  release();
  await expect(form(page).locator('form a[href^="tel:"]')).toBeVisible();
  await page.waitForTimeout(500);
  const shifts = await page.evaluate(
    (from) => (window as unknown as { __shifts: number[] }).__shifts.slice(from),
    before,
  );
  expect(shifts.reduce((sum, value) => sum + value, 0)).toBe(0);
});

test('T-BK13 the booking template: no sticky bar, one form, unique ids, axe clean', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'phone-dark', 'desktop-light', 'desktop-dark');
  await openBooking(page);
  await expect(page.locator('[data-sticky-bar]')).toHaveCount(0);
  await expect(page.locator('[data-booking-form]')).toHaveCount(1);
  await expect(page.locator('[data-booking-dialog]')).toHaveCount(0);
  await expect(page.locator('[data-page-type="booking"]')).toHaveCount(1);
  const duplicates = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    return ids.filter((id, i) => ids.indexOf(id) !== i);
  });
  expect(duplicates).toEqual([]);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('nav.book'));
  await expectNoA11yViolations(page);
});

test('T-BK14 no horizontal scroll on the booking page from 320 px', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const width of [320, 360, 390, 430, 744, 820, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(BOOKING);
    await page.waitForLoadState('load');
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scroll, `${width}`).toBeLessThanOrEqual(width);
  }
});

test('T-BK15 screenshots: the booking page, its error, unsent and neutral states, the success page', async ({
  page,
  context,
}, testInfo) => {
  await isolateClient(context);
  const theme = projectTheme(testInfo);
  await openBooking(page);
  await captureTemplate(page, testInfo, 'booking', theme);

  await submitButton(page).click();
  await form(page).getByText(t('booking.noteSummary')).click();
  await form(page).getByLabel(t('booking.note')).fill('ا'.repeat(501));
  await submitButton(page).click();
  await expect(form(page).locator('#bk-page-note-error')).toBeVisible();
  await captureTemplate(page, testInfo, 'booking-error', theme);

  // What a no-JS home card sends: no token. The page comes back with the value and the line.
  const phone = uniquePhone(testInfo);
  expect((await postBooking(page, { phone, location: 'hero' })).status()).toBe(303);
  await openBooking(page);
  await expect(form(page).getByRole('status')).toHaveText(t('booking.retry'));
  await captureTemplate(page, testInfo, 'booking-unsent', theme);

  // A real no-JS post with this page's tokens, past the trap: the one-time success page.
  const tokens = {
    csrf: await form(page).locator('input[name="csrf"]').inputValue(),
    ts: await form(page).locator('input[name="ts"]').inputValue(),
  };
  await pastTimeTrap(Date.now());
  const posted = await postBooking(page, { phone, name: 'نمونهٔ آزمایشی', ...tokens });
  expect(posted.status()).toBe(303);
  await page.goto(SUCCESS);
  await expect(page.getByRole('heading', { level: 1, name: t('booking.done') })).toBeVisible();
  await captureTemplate(page, testInfo, 'booking-success', theme);

  // The same number again within 10 minutes: the neutral info state (conversion.md 5.2).
  await openBooking(page);
  await form(page).getByLabel(t('booking.phone')).fill(phone);
  await submitButton(page).click();
  // The neutral line ends with the clinic number from the Clinic global.
  await expect(form(page).getByRole('status')).toContainText(t('booking.neutral'));
  await captureTemplate(page, testInfo, 'booking-neutral', theme);
});
