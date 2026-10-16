// The home hero card and the home booking block against the real pipeline, with and without
// JavaScript, and a submit from a cached home (phase 5 deliverables 1 and 9; docs/conversion.md
// 5, 5.4 and 6). Each submitting test is its own client with its own phone (G18).
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import {
  countBookingPosts,
  formsHydrated,
  isolateClient,
  landsOn,
  maskedPhone,
  pastTimeTrap,
  recordBeacons,
  recordEvents,
  uniquePhone,
} from '../helpers/booking';
import { requireRoutes } from '../helpers/pending';
import { captureTemplate } from '../helpers/screens';
import { projectTheme } from '../helpers/theme';

const BOOKING = '/رزرو-نوبت';
const SUCCESS = '/رزرو-نوبت/ثبت-شد';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(() => requireRoutes('booking', 'bookingSuccess'));

const hero = (page: Page) => page.locator('#bk-hero');
const block = (page: Page) => page.locator('#bk-block');
const submitIn = (root: ReturnType<Page['locator']>) =>
  root.getByRole('button', { name: t('booking.submit') });
const path = (page: Page) => decodeURI(new URL(page.url()).pathname);

test('T-HB1 the hero card: compact success in place, items 1 to 4, the card does not move', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-dark', 'desktop-light');
  await isolateClient(context);
  const events = await recordEvents(page);
  const posts = countBookingPosts(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      type Shift = PerformanceEntry & { value: number; hadRecentInput: boolean };
      // As CLS: a shift within 500 ms of the press (its loading state) does not count.
      for (const e of list.getEntries() as Shift[]) if (!e.hadRecentInput) w.__shifts.push(e.value);
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const phone = uniquePhone(testInfo);
  await page.goto('/');
  await formsHydrated(page);
  const card = hero(page);
  const before = await card.boundingBox();
  await card.getByLabel(t('booking.phone')).fill(phone);
  const shiftsBefore = await page.evaluate(
    () => (window as unknown as { __shifts: number[] }).__shifts.length,
  );
  await submitIn(card).click();
  const done = card.getByRole('heading', { name: t('booking.done') });
  await expect(done).toBeFocused();
  await expect(card).toHaveAttribute('data-state', 'success');
  await expect(card.getByText(maskedPhone(phone))).toBeVisible();
  await expect(card.getByText(/پذیرش .*تماس می‌گیرد\./)).toBeVisible();
  await expect(card.getByRole('link', { name: t('booking.saveContact') })).toBeVisible();
  // Items 5 and 6 stay in the block and on the success page.
  await expect(card.getByText(t('booking.bringHeading'))).toBeHidden();
  await expect(card.getByRole('link', { name: t('call.label') })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  const after = await card.boundingBox();
  expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  expect(after?.width).toBeCloseTo(before?.width ?? 0, 0);
  expect(after?.y).toBeCloseTo(before?.y ?? 0, 0);
  const shifts = await page.evaluate(
    (from) => (window as unknown as { __shifts: number[] }).__shifts.slice(from),
    shiftsBefore,
  );
  expect(shifts.reduce((sum, value) => sum + value, 0)).toBe(0);
  // «رزرو نوبت» now routes to the block (the card left the route).
  await expect(page.locator('[data-booking-form="hero"]')).toHaveCount(0);
  expect(path(page)).toBe('/');
  expect(posts()).toBe(1);
  const submits = (await events()).filter(([name]) => name === 'booking_submit');
  expect(submits).toEqual([
    ['booking_submit', expect.objectContaining({ location: 'hero', has_name: false })],
  ]);
});

test('T-HB2 the home block: the full success in place with location block', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await isolateClient(context);
  const events = await recordEvents(page);
  const phone = uniquePhone(testInfo);
  await page.goto('/');
  await formsHydrated(page);
  const form = block(page);
  // No contextual emergency link on home (conversion.md 3, G10).
  await expect(form.getByRole('link', { name: t('urgent.label') })).toHaveCount(0);
  await form.getByLabel(t('booking.phone')).fill(phone);
  await form.getByLabel(t('booking.name')).fill('نمونهٔ آزمایشی');
  await submitIn(form).click();
  await expect(form.getByRole('heading', { name: t('booking.done') })).toBeFocused();
  await expect(form.getByText(maskedPhone(phone))).toBeVisible();
  await expect(form.getByRole('heading', { name: t('booking.bringHeading') })).toBeVisible();
  await expect(form.getByRole('link', { name: t('call.label') })).toHaveAttribute(
    'data-call-sheet',
    '',
  );
  await expect(form.getByRole('link', { name: t('booking.whatsapp') })).toHaveCount(0);
  const submits = (await events()).filter(([name]) => name === 'booking_submit');
  expect(submits).toEqual([
    ['booking_submit', expect.objectContaining({ location: 'block', has_name: true })],
  ]);
});

test('T-HB3 without JavaScript the hero card lands on the booking page; the second submit succeeds', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(context);
  const page = await context.newPage();
  const phone = uniquePhone(testInfo);
  await page.goto('/');
  await hero(page).getByLabel(t('booking.phone')).fill(phone);
  const post = page.waitForRequest((request) => request.method() === 'POST');
  const landed = await landsOn(page, BOOKING, () => submitIn(hero(page)).click());
  const fields = new URLSearchParams((await post).postData() ?? '');
  expect(fields.get('location')).toBe('hero');
  expect(fields.get('csrf') ?? '').toBe('');
  expect(fields.get('ts') ?? '').toBe('');
  expect(landed.status()).toBe(200);
  const answered = Date.now();
  const form = page.locator('#bk-page');
  await expect(form.getByLabel(t('booking.phone'))).toHaveValue(phone);
  await expect(form.getByRole('status')).toHaveText(t('booking.retry'));
  await expect(form.locator('input[name="location"]')).toHaveValue('hero');
  await pastTimeTrap(answered);
  await landsOn(page, SUCCESS, () => submitIn(form).click());
  await expect(page.getByRole('heading', { level: 1, name: t('booking.done') })).toBeVisible();
  await expect(page.getByText(maskedPhone(phone))).toBeVisible();
  await context.close();
});

test('T-HB4 without JavaScript the home block keeps every value on the booking page', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await browser.newContext({ javaScriptEnabled: false });
  await isolateClient(context);
  const page = await context.newPage();
  const phone = uniquePhone(testInfo);
  await page.goto('/');
  const form = block(page);
  await form.getByLabel(t('booking.phone')).fill(phone);
  await form.getByLabel(t('booking.name')).fill('نمونهٔ آزمایشی');
  await form.getByRole('radio', { name: t('booking.group.implant') }).check();
  await form.getByRole('radio', { name: t('booking.time.evening') }).check();
  await form.getByText(t('booking.noteSummary')).click();
  await form.getByLabel(t('booking.note')).fill('نمونهٔ آزمایشی: درد دارم');
  await landsOn(page, BOOKING, () => submitIn(form).click());
  const kept = page.locator('#bk-page');
  const answered = Date.now();
  await expect(kept.getByRole('status')).toHaveText(t('booking.retry'));
  await expect(kept.getByLabel(t('booking.phone'))).toHaveValue(phone);
  await expect(kept.getByLabel(t('booking.name'))).toHaveValue('نمونهٔ آزمایشی');
  await expect(kept.getByRole('radio', { name: t('booking.group.implant') })).toBeChecked();
  await expect(kept.getByRole('radio', { name: t('booking.time.evening') })).toBeChecked();
  await expect(kept.getByLabel(t('booking.note'))).toHaveValue('نمونهٔ آزمایشی: درد دارم');
  await expect(kept.locator('input[name="location"]')).toHaveValue('block');
  await pastTimeTrap(answered);
  await landsOn(page, SUCCESS, () => submitIn(kept).click());
  await expect(page.getByRole('heading', { level: 1, name: t('booking.done') })).toBeVisible();
  await context.close();
});

test('T-HB5 two visitors of one cached home both book; the token comes after load', async ({
  browser,
  request,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const cached = await request.get('/');
  const html = await cached.text();
  // The cached HTML holds no token, timestamp or hours sentence (T-HOME6).
  expect(html).not.toMatch(/name="(csrf|ts)"[^>]*value="[^"]+"/);
  expect(html).not.toMatch(/v1\.[0-9a-z]{1,11}\.[A-Za-z0-9_-]{43}/);
  const headers = Object.fromEntries(
    Object.entries(cached.headers()).filter(
      ([name]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(name),
    ),
  );
  for (const visitor of [1, 2]) {
    const context = await browser.newContext();
    await isolateClient(context);
    const page = await context.newPage();
    // Serve the one captured document (its CSP nonce matches its own header).
    await page.route(
      (url) => url.pathname === '/',
      (route) =>
        route.request().method() === 'GET'
          ? route.fulfill({ status: 200, headers, body: html })
          : route.continue(),
    );
    const session = page.waitForResponse((r) => r.url().includes('/api/form-session'));
    await page.goto('/');
    await session;
    // One token request, and it starts after the load event (conversion.md 6).
    const [loadStart, sessionStarts] = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const starts = performance
        .getEntriesByType('resource')
        .filter((entry) => entry.name.includes('/api/form-session'))
        .map((entry) => entry.startTime);
      return [nav.loadEventStart, starts] as const;
    });
    expect(sessionStarts, `visitor ${visitor}`).toHaveLength(1);
    expect(sessionStarts[0], `visitor ${visitor}`).toBeGreaterThanOrEqual(loadStart);
    await formsHydrated(page);
    const phone = uniquePhone(testInfo);
    await hero(page).getByLabel(t('booking.phone')).fill(phone);
    await submitIn(hero(page)).click();
    await expect(hero(page)).toHaveAttribute('data-state', 'success');
    await expect(hero(page).getByText(maskedPhone(phone))).toBeVisible();
    await context.close();
  }
});

test('T-HB6 a submit before the token answer waits for it, then posts once', async ({
  page,
  context,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await isolateClient(context);
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/form-session', async (route) => {
    const response = await route.fetch();
    await held;
    await route.fulfill({ response });
  });
  const posts = countBookingPosts(page);
  await page.goto('/');
  await formsHydrated(page);
  await hero(page).getByLabel(t('booking.phone')).fill(uniquePhone(testInfo));
  await submitIn(hero(page)).click();
  const loading = hero(page).getByRole('button', { name: t('booking.submitting') });
  await expect(loading).toHaveAttribute('aria-busy', 'true');
  await page.waitForTimeout(1000);
  expect(posts()).toBe(0);
  release();
  await expect(hero(page)).toHaveAttribute('data-state', 'success');
  expect(posts()).toBe(1);
});

test('T-HB7 booking_open: the hero field once, a chrome CTA once with its own location', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  const beacons = await recordBeacons(page);
  await page.goto('/');
  await formsHydrated(page);
  const opens = async () =>
    (await beacons())
      .map((body) => JSON.parse(body) as Record<string, string>)
      .filter((b) => b.event === 'booking_open')
      .map((b) => b.location);
  const desktop = testInfo.project.name.startsWith('desktop');
  const cta = desktop
    ? page.getByRole('banner').getByRole('link', { name: t('nav.book') })
    : page.locator('[data-sticky-bar]').getByRole('link', { name: t('nav.book') });
  await (desktop ? cta.click() : cta.tap());
  await expect(hero(page).getByLabel(t('booking.phone'))).toBeFocused();
  await expect.poll(opens).toEqual([desktop ? 'header' : 'sticky']);
  // The CTA marked the card: its field's focus sends none of its own, now or later.
  await hero(page).getByLabel(t('booking.phone')).blur();
  await hero(page).getByLabel(t('booking.phone')).focus();
  await page.waitForTimeout(300);
  expect(await opens()).toEqual([desktop ? 'header' : 'sticky']);

  await page.reload();
  await formsHydrated(page);
  await hero(page).getByLabel(t('booking.phone')).focus();
  await hero(page).getByLabel(t('booking.phone')).blur();
  await hero(page).getByLabel(t('booking.phone')).focus();
  await expect.poll(opens).toEqual(['hero']);
});

test('T-HB8 screenshot: the home hero card in its success state', async ({
  page,
  context,
}, testInfo) => {
  await isolateClient(context);
  await page.goto('/');
  await formsHydrated(page);
  const card = hero(page);
  await card.getByLabel(t('booking.phone')).fill(uniquePhone(testInfo));
  await submitIn(card).click();
  await expect(card.getByRole('heading', { name: t('booking.done') })).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await captureTemplate(page, testInfo, 'home-hero-success', projectTheme(testInfo), {
    fullPage: false,
  });
});
