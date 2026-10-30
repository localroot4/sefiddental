// The emergency page /اورژانس (phase 5 deliverable 2; docs/conversion.md 7; emergency spec 16;
// qa-budgets 2.3): the order the server picks per hours state (QA-CLOCK), the call button in the
// first screen at 360x640 during hours, triage refused on the server, the avulsion first aid, the
// second emergency from one phone, four from one address nobody blocked, the success with the
// safety box again, the no-JS post, calls and events, the entry links, and axe. Every submitting
// test is its own client with its own phone and waits out the 2 s time trap (freeze G18).
import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { t } from '@/i18n/fa';
import { toPersianDigits } from '@/lib/persianText';

import { expectNoA11yViolations } from '../helpers/axe';
import {
  formsHydrated,
  isolateClient,
  isolateClientAt,
  pastTimeTrap,
  recordBeacons,
  recordEvents,
  uniquePhone,
} from '../helpers/booking';
import { watchConsoleErrors } from '../helpers/console';

const EMERGENCY = '/اورژانس';
const BOOKING = '/رزرو-نوبت';
/**
 * The holiday override the QA fixture adds on a far date (tests/fixtures/qa-seed.ts, integrator
 * request): the clinic is closed all day.
 */
const QA_HOLIDAY = '2027-03-21';
// Tehran is UTC+3:30; the seeded hours are every day 10 to 20.
const CLOCK = {
  open: new Date('2026-10-21T08:00:00Z'), // 11:30
  'closing-soon': new Date('2026-10-21T16:15:00Z'), // 19:45
  'before-open': new Date('2026-10-21T05:00:00Z'), // 08:30
  closed: new Date('2026-10-21T17:00:00Z'), // 20:30
  holiday: new Date(`${QA_HOLIDAY}T08:00:00Z`), // 11:30 on the holiday
} as const;
type State = keyof typeof CLOCK;
const CALL_FIRST: readonly State[] = ['open', 'closing-soon'];

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

async function open(page: Page): Promise<number> {
  const response = await page.goto(encodeURI(EMERGENCY));
  expect(response?.status()).toBe(200);
  // The page renders its tokens: they are at least this old.
  return Date.now();
}

/** A context of its own (JS on or off) whose server-side hours clock reads `state`. */
async function clientAt(
  browser: Browser,
  state: State,
  options: Parameters<Browser['newContext']>[0] = {},
): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  await isolateClientAt(context, CLOCK[state]);
  return context;
}

const sections = (page: Page) =>
  page
    .locator('[data-page-type="emergency"] [data-section]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-section')));

/** 7.1 order; the self-care slot shows only with reviewed content (the QA fixture may add it). */
function expected(state: State, found: Array<string | null>): string[] {
  const order = ['hero', CALL_FIRST.includes(state) ? 'call' : 'call-115', 'safety', 'form'];
  return [...order, ...(found.includes('self-care') ? ['self-care'] : []), 'address'];
}

/**
 * With JavaScript: the island took over (noValidate). A press before that is the no-JS post, and
 * a header click a plain navigation.
 */
const hydrated = (page: Page) =>
  page.waitForFunction(
    () => document.querySelector<HTMLFormElement>('form[data-emergency-form]')?.noValidate === true,
  );

// Scoped: the booking dialog's closed form on this page has the same phone and name labels.
const emForm = (page: Page) => page.locator('form[data-emergency-form]');
const phoneField = (page: Page) => emForm(page).getByLabel(t('booking.phone'));
const nameField = (page: Page) => emForm(page).getByLabel(t('booking.name'));
const triageBox = (page: Page, key: string) =>
  emForm(page).getByLabel(t(key as never), { exact: true });
const submit = (page: Page) => emForm(page).getByRole('button', { name: t('emergency.submit') });

/** Ticks the boxes, types the phone and presses «ثبت درخواست فوری». */
async function fill(page: Page, phone: string, boxes = ['emergency.triage.severe_pain']) {
  for (const key of boxes) await triageBox(page, key).check();
  await phoneField(page).fill(phone);
  await submit(page).click();
}

const masked = (phone: string) => toPersianDigits(`${phone.slice(0, 4)} *** ${phone.slice(-4)}`);

test('T-EM1 the server picks the order from the hours state, in the HTML, no-store', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  for (const state of Object.keys(CLOCK) as State[]) {
    // JavaScript off: the order is the server's, not an island's.
    const context = await clientAt(browser, state, { javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(encodeURI(EMERGENCY));
    expect(response?.headers()['cache-control'], state).toContain('no-store');
    const found = await sections(page);
    expect(found, state).toEqual(expected(state, found));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('درد شدید دندان دارید؟');
    const lead = {
      open: 'emergency.lead.open',
      'closing-soon': 'emergency.lead.closingSoon',
      'before-open': 'emergency.lead.closed',
      closed: 'emergency.lead.closed',
      holiday: 'emergency.lead.closed',
    } as const;
    await expect(page.locator('[data-section="hero"] p'), state).toHaveText(t(lead[state]));
    const form = page.locator('[data-section="form"]');
    if (CALL_FIRST.includes(state)) {
      await expect(page.locator('[data-section="call"] a')).toHaveAttribute(
        'href',
        'tel:+982155101054',
      );
      await expect(form.getByText(t('emergency.form.intro'))).toBeVisible();
    } else {
      // In main: the header keeps its own call icon («تماس با کلینیک») below 1280 px.
      await expect(page.locator('main').getByRole('link', { name: t('call.label') })).toHaveCount(
        0,
      );
    }
    // qa-budgets T-EM8: 115 and the same-day line in every state; «هیچ‌کدام؟» to booking.
    const safety = page.locator('[data-section="safety"]');
    await expect(safety.locator('a[href="tel:115"]'), state).toBeVisible();
    await expect(safety.getByText(t('emergency.safety.sameDay')), state).toBeVisible();
    await expect(form.getByRole('link', { name: t('emergency.none.link') })).toHaveAttribute(
      'href',
      BOOKING,
    );
    // The line above the button: none while open, the callback day otherwise, and never the
    // unconfirmed priority promise (gap 19).
    const text = await form.innerText();
    expect(text).not.toContain('پیش از بقیهٔ');
    if (state === 'closing-soon' || state === 'closed')
      expect(text).toContain('پذیرش فردا از ساعت ۱۰');
    if (state === 'before-open') expect(text).toContain('پذیرش امروز از ساعت ۱۰');
    if (state === 'holiday') {
      expect(text, `holiday row ${QA_HOLIDAY} in tests/fixtures/qa-seed.ts`).toContain(
        'امروز تعطیل رسمی است.',
      );
    }
    // Copy that never promises a slot (7.5, EM-P1).
    const main = await page.locator('main').innerText();
    expect(main).not.toMatch(/تضمین|نوبت قطعی/);
    if (main.includes('همان روز')) expect(main).toContain('در صورت امکان');
    await context.close();
  }
});

test('T-EM2 during hours «تماس با کلینیک» is in the first screen at 360x640, no sticky bar', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light');
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const state of CALL_FIRST) {
      const context = await clientAt(browser, state, {
        viewport: { width: 360, height: 640 },
        isMobile: true,
        hasTouch: true,
        colorScheme,
      });
      const page = await context.newPage();
      await open(page);
      const call = page.locator('[data-section="call"] a');
      await expect(call).toHaveText(t('call.label'));
      const box = await call.boundingBox();
      expect(box, `${state} ${colorScheme}`).not.toBeNull();
      expect(box!.y + box!.height, `${state} ${colorScheme}`).toBeLessThanOrEqual(640);
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page.locator('[data-sticky-bar]')).toBeHidden();
      await context.close();
    }
  }
});

test('T-EM3 a request without a triage item is refused by the server with the message', async ({
  browser,
  request,
  baseURL,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // The handler itself: fields are checked before tokens, so nothing is stored.
  const answer = await request.post(encodeURI(EMERGENCY), {
    headers: { accept: 'application/json', origin: new URL(baseURL!).origin },
    form: { phone: uniquePhone(testInfo), name: '', note: '' },
  });
  expect(answer.status()).toBe(422);
  expect((await answer.json()) as unknown).toEqual({ ok: false, errors: { triage: 'required' } });

  // Without JavaScript: the server re-renders the form with the message and the typed values.
  const context = await clientAt(browser, 'open', { javaScriptEnabled: false });
  const page = await context.newPage();
  await open(page);
  const phone = uniquePhone(testInfo);
  await phoneField(page).fill(phone);
  await nameField(page).fill('نمونهٔ آزمایشی');
  await submit(page).click();
  await expect(page.getByText(t('emergency.triage.required'))).toBeVisible();
  expect(decodeURI(new URL(page.url()).pathname)).toBe(EMERGENCY);
  await expect(phoneField(page)).toHaveValue(phone);
  await expect(nameField(page)).toHaveValue('نمونهٔ آزمایشی');
  await expect(page.locator('input[name="triage"]').first()).toBeFocused();
  await context.close();
});

test('T-EM3b with JavaScript the triage check runs first: message, focus, nothing posted', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  await isolateClientAt(page.context(), CLOCK.open);
  const posts: string[] = [];
  page.on(
    'request',
    (r) => r.method() === 'POST' && !r.url().includes('/api/events') && posts.push(r.url()),
  );
  await open(page);
  await hydrated(page);
  await phoneField(page).fill(uniquePhone(testInfo));
  await submit(page).click();
  await expect(page.locator('#em-triage-error')).toHaveText(t('emergency.triage.required'));
  await expect(page.locator('input[name="triage"]').first()).toBeFocused();
  expect(posts).toEqual([]);
});

test('T-EM4 the avulsion first aid shows with its box, with JavaScript and without', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light');
  for (const javaScriptEnabled of [true, false]) {
    for (const state of ['open', 'closed'] as const) {
      const context = await clientAt(browser, state, { javaScriptEnabled });
      const page = await context.newPage();
      await open(page);
      const text = page.getByText(t('emergency.avulsion.text'));
      await expect(text).toBeHidden();
      await triageBox(page, 'emergency.triage.avulsion').check();
      await expect(text).toBeVisible();
      const reveal = page.locator('[data-reveal]');
      if (state === 'open') {
        await expect(reveal.getByText(t('emergency.avulsion.open'))).toBeVisible();
        await expect(reveal.getByRole('link', { name: t('call.label') })).toHaveAttribute(
          'href',
          'tel:+982155101054',
        );
      } else {
        await expect(reveal.getByText(t('emergency.avulsion.closed'))).toBeVisible();
        await expect(reveal.getByRole('link')).toHaveCount(0);
      }
      await triageBox(page, 'emergency.triage.avulsion').uncheck();
      await expect(text).toBeHidden();
      await context.close();
    }
  }
});

test('T-EM5 a second emergency from one phone within 24 hours shows the 7.3 message', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await isolateClientAt(page.context(), CLOCK.open);
  const phone = uniquePhone(testInfo);
  await pastTimeTrap(await open(page));
  await hydrated(page);
  await fill(page, phone);
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toBeVisible();

  await pastTimeTrap(await open(page));
  await hydrated(page);
  await fill(page, phone, ['emergency.triage.swelling']);
  const info = page.getByRole('status').filter({ hasText: t('emergency.repeat.before') });
  await expect(info).toBeVisible();
  await expect(info).toContainText(`۰۲۱ ۵۵۱۰ ۱۰۵۴ ${t('emergency.repeat.after')}`);
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toHaveCount(0);
  await expect(phoneField(page)).toHaveValue(phone);
});

test('T-EM6 four emergencies from one address in a day: every visitor sees the success', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // One client for all four: nobody is blocked (7.5). That the fourth is stored with the
  // emergency_ip_rate flag is asserted in the admin suite (T-AD10 extension), which holds the
  // admin session; this test cannot fail on the flag.
  await isolateClientAt(page.context(), CLOCK.closed);
  for (let i = 0; i < 4; i += 1) {
    await pastTimeTrap(await open(page));
    await hydrated(page);
    await fill(page, uniquePhone(testInfo));
    await expect(
      page.getByRole('heading', { name: t('emergency.done') }),
      `request ${i + 1}`,
    ).toBeVisible();
  }
});

test('T-EM7 success: heading, the callback line, the number, the safety box again, one event', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  const errors = watchConsoleErrors(page);
  const beacons = await recordBeacons(page);
  const events = await recordEvents(page);
  await isolateClientAt(page.context(), CLOCK.open);
  const phone = uniquePhone(testInfo);
  await pastTimeTrap(await open(page));
  await hydrated(page);
  await fill(page, phone, ['emergency.triage.severe_pain', 'emergency.triage.swelling']);
  const heading = page.getByRole('heading', { name: t('emergency.done') });
  await expect(heading).toBeFocused();
  const form = page.locator('[data-section="form"]');
  await expect(
    form.getByText('پذیرش معمولاً تا ۱۰ دقیقهٔ دیگر با شما تماس می‌گیرد.'),
  ).toBeVisible();
  await expect(form.locator('bdi[dir="ltr"]')).toHaveText(masked(phone));
  await expect(form.locator('a[href="tel:115"]')).toBeVisible();
  await expect(page.locator('a[href="tel:115"]:visible')).toHaveCount(2);
  await expectNoA11yViolations(page);

  await expect
    .poll(async () => (await beacons()).filter((b) => b.includes('"emergency_submit"')).length)
    .toBe(1);
  const sent = await beacons();
  expect(JSON.parse(sent.find((b) => b.includes('"emergency_submit"'))!)).toMatchObject({
    event: 'emergency_submit',
    pageType: 'emergency',
  });
  // The full parameters (GA4): the hours state the page was served in and the ticked boxes.
  expect((await events()).filter(([name]) => name === 'emergency_submit')).toEqual([
    ['emergency_submit', expect.objectContaining({ open_state: 'open', items_count: 2 })],
  ]);
  for (const body of sent) {
    expect(body).not.toContain(phone.slice(-7));
    expect(body).not.toContain(toPersianDigits(phone.slice(-4)));
  }
  expect(errors()).toEqual([]);
});

test('T-EM8 without JavaScript the form posts and the page shows the success once', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const context = await clientAt(browser, 'before-open', { javaScriptEnabled: false });
  const page = await context.newPage();
  const phone = uniquePhone(testInfo);
  await pastTimeTrap(await open(page));
  await fill(page, phone, ['emergency.triage.broken']);
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toBeVisible();
  expect(decodeURI(new URL(page.url()).pathname)).toBe(EMERGENCY);
  const form = page.locator('[data-section="form"]');
  await expect(form.getByText('پذیرش امروز از ساعت ۱۰ با شما تماس می‌گیرد.')).toBeVisible();
  await expect(form.locator('bdi[dir="ltr"]')).toHaveText(masked(phone));
  await expect(form.locator('form')).toHaveCount(0);
  // autofocus: the browser moves to the success below the hero and the safety box (EM-F14).
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toBeFocused();
  // The flash is read once: a reload (a direct GET) shows the form again (EM-F15).
  await page.reload();
  await expect(page.locator('[data-section="form"] form')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: t('emergency.done') })).toHaveCount(0);
  await context.close();
});

test('T-EM9 calls: the clinic call is tracked and dials while open; 115 is never intercepted', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  for (const state of ['open', 'closed'] as const) {
    const context = await clientAt(browser, state);
    const page = await context.newPage();
    const beacons = await recordBeacons(page);
    const events = await recordEvents(page);
    const session = page.waitForResponse('**/api/form-session');
    await open(page);
    await session;
    // Registered after the chrome's listeners: records their verdict, then stops any dialing.
    await page.evaluate(() => {
      document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element) || !event.target.closest('a[href^="tel:"]')) return;
        Reflect.set(window, '__canceled', event.defaultPrevented);
        event.preventDefault();
      });
    });
    const canceled = () => page.evaluate(() => Reflect.get(window, '__canceled') === true);

    await page.locator('[data-section="safety"] a[href="tel:115"]').click();
    expect(await canceled(), `${state} 115`).toBe(false);
    await expect(page.locator('#closed-sheet')).toBeHidden();
    if (state === 'open') {
      await page.locator('[data-section="call"] a').click();
      expect(await canceled()).toBe(false);
      await expect
        .poll(async () => (await beacons()).filter((b) => b.includes('"call_click"')))
        .toEqual([expect.stringContaining('"location":"hero"')]);
      // TrackListener adds the hours state (its value depends on the real clock vs QA-CLOCK).
      expect((await events()).filter(([name]) => name === 'call_click')).toEqual([
        [
          'call_click',
          expect.objectContaining({ location: 'hero', open_state: expect.any(String) }),
        ],
      ]);
    } else {
      // Only the clinic's own call goes through the closed-hours sheet; 115 sent no event.
      expect((await beacons()).filter((b) => b.includes('"call_click"'))).toEqual([]);
    }
    await context.close();
  }
});

test('T-EM10 axe in the call-first, closed, error and avulsion states; no sideways scroll', async ({
  browser,
}, testInfo) => {
  const use = testInfo.project.use;
  for (const state of ['open', 'closed'] as const) {
    const context = await clientAt(browser, state, {
      viewport: use.viewport,
      colorScheme: use.colorScheme,
      isMobile: use.isMobile,
      hasTouch: use.hasTouch,
    });
    const page = await context.newPage();
    await open(page);
    await expectNoA11yViolations(page);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
    ).toBeLessThanOrEqual(0);
    if (state === 'open') {
      // The avulsion text and a phone error together.
      await hydrated(page);
      await triageBox(page, 'emergency.triage.avulsion').check();
      await phoneField(page).fill('021 5510 1054');
      await submit(page).click();
      await expect(page.locator('#em-phone-error')).toBeVisible();
      await expectNoA11yViolations(page);
    }
    await context.close();
  }
});

test('T-EM11 the header «رزرو نوبت» opens the booking dialog here; «هیچ‌کدام؟» links to booking', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await isolateClient(page.context());
  await open(page);
  // The chrome's routing and the dialog's form ran: a click before that navigates away.
  await hydrated(page);
  await formsHydrated(page);
  await expect(page.locator('[popovertarget="mega-menu"]')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  // The dialog's own form is the only booking form here.
  await expect(page.locator('[data-booking-form]:not([data-booking-form="dialog"])')).toHaveCount(
    0,
  );
  await expect(
    page.locator('[data-section="form"]').getByRole('link', { name: t('emergency.none.link') }),
  ).toHaveAttribute('href', BOOKING);
  await page
    .getByRole('banner')
    .getByRole('link', { name: t('nav.book') })
    .click();
  const dialog = page.getByRole('dialog', { name: t('booking.heading') });
  await expect(dialog).toBeVisible();
  expect(decodeURI(new URL(page.url()).pathname)).toBe(EMERGENCY);
  // No link back to the page the visitor is on (BookingDialog emergencyLink={false}).
  await expect(dialog.locator(`a[href="${EMERGENCY}"]`)).toHaveCount(0);
});

test('T-EM12 the emergency link is in the footer, never a primary nav item or in the sticky bar', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light');
  await isolateClient(page.context());
  // qa-budgets T-EM8 (ia.md 3): one chrome for every template; home, booking and this page.
  for (const path of ['/', BOOKING, EMERGENCY]) {
    await page.goto(encodeURI(path));
    const to = `a[href="${EMERGENCY}"]`;
    await expect(page.locator(`footer ${to}`), path).not.toHaveCount(0);
    // The mega menu's urgent row sits deeper, inside its panel.
    await expect(page.locator(`header nav > ul > li > ${to}`), path).toHaveCount(0);
    await expect(page.locator(`[data-sticky-bar] ${to}`), path).toHaveCount(0);
  }
});

test('T-EM13 while closed a full-width «تماس با اورژانس ۱۱۵» button is in the first screen', async ({
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'phone-dark', 'desktop-light');
  for (const state of ['before-open', 'closed', 'holiday'] as const) {
    const context = await clientAt(browser, state, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await open(page);
    const call = page.locator('[data-section="call-115"]');
    await expect(call, state).toHaveText(t('emergency.call115'));
    await expect(call, state).toHaveAttribute('href', 'tel:115');
    const box = (await call.boundingBox())!;
    const width = await page.locator('[data-section="hero"]').evaluate((el) => el.clientWidth);
    expect(box.height, state).toBeGreaterThanOrEqual(44);
    expect(box.width, state).toBeGreaterThanOrEqual(width - 1);
    expect(box.y + box.height, state).toBeLessThanOrEqual(844);
    // Like the safety box's link: no closed-hours sheet and no event can hold the call back.
    expect(await call.evaluate((el) => el.closest('[data-call-sheet], [data-track]'))).toBeNull();
    await context.close();
  }
  // Open: the clinic's call takes the slot, and no 115 button.
  const context = await clientAt(browser, 'open');
  const page = await context.newPage();
  await open(page);
  await expect(page.locator('[data-section="call-115"]')).toHaveCount(0);
  await context.close();
});
