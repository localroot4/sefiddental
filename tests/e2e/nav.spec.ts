// Site chrome (phase 4 deliverable 2, nav spec 1): the desktop bar on one line, the services mega
// menu, the phone drawer, the sticky bar and the closed-hours sheet. They run on /qa/not-found:
// the full chrome with status 200 (QA_ROUTES=1) and no page of a later phase in the way.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

const PAGE = '/qa/not-found';
const CLOSED_TEXT = 'کلینیک الان بسته است. ساعات کاری: هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.';

const isDesktop = (testInfo: TestInfo) => testInfo.project.name.startsWith('desktop');

/** The /api/form-session answer with the hours state of a closed (or open) clinic. */
async function mockHours(page: Page, closed: boolean): Promise<void> {
  const nextChangeAt = new Date(Date.now() + 3_600_000).toISOString();
  await page.route('**/api/form-session', (route) =>
    route.fulfill({
      json: {
        csrf: 'csrf',
        ts: 'ts',
        ttlSeconds: 1800,
        hours: {
          state: closed ? 'closed' : 'open',
          callsAllowed: !closed,
          showClosedSheet: closed,
          nextChangeAt,
          copy: {
            callback: '',
            closedSheet: closed ? CLOSED_TEXT : null,
            emergencyClosedLine: null,
          },
        },
      },
    }),
  );
}

/** Records whether the chrome canceled the next click (a canceled `tel:` click does not dial). */
async function recordClickDefault(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => {
    // Registered after the chrome's own listeners, so it sees their verdict, then stops dialing.
    document.addEventListener('click', (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href^="tel:"]')) return;
      Reflect.set(window, '__canceled', event.defaultPrevented);
      event.preventDefault();
    });
  });
  return () => page.evaluate(() => Reflect.get(window, '__canceled') === true);
}

/** The chrome island ran (it syncs aria-expanded): DOM added after this survives hydration. */
const hydrated = (page: Page) =>
  expect(page.locator('[popovertarget="mega-menu"]')).toHaveAttribute('aria-expanded', 'false');

/** Pushes the footer below the fold, so its contact block does not hide the sticky bar. */
const growMain = (page: Page) =>
  page.evaluate(() => {
    const filler = document.createElement('div');
    filler.style.minHeight = '200vh'; // CSSOM, not a style attribute: the CSP allows it
    document.querySelector('main')!.append(filler);
  });

const insideDialog = (page: Page, id: string) =>
  page.evaluate((dialogId) => Boolean(document.activeElement?.closest(`#${dialogId}`)), id);

test('T-NV1 the desktop bar is one line of at most 72 px from 1024 px', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'viewport rows run in desktop-light');
  for (const width of [1024, 1279, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(PAGE);
    const header = page.getByRole('banner');
    const bar = (await header.boundingBox())!;
    expect(bar.height, `${width}`).toBe(72);
    // Every visible control sits inside the bar, on one row (one vertical center).
    const centers = await header.locator('a:visible, button:visible').evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        return box.y + box.height / 2;
      }),
    );
    expect(Math.max(...centers) - Math.min(...centers), `${width}: one row`).toBeLessThanOrEqual(1);
    await expect(header.getByRole('navigation', { name: t('nav.primary') })).toBeVisible();
    await expect(header.getByRole('link', { name: t('nav.book') })).toBeVisible();
    await expect(header.getByRole('button', { name: t('theme.toggle') })).toBeVisible();
    // The number joins the bar from 1280 px; under it the call icon stays.
    await expect(header.getByRole('link', { name: '۰۲۱ ۵۵۱۰ ۱۰۵۴' })).toBeVisible({
      visible: width >= 1280,
    });
    await expect(header.getByRole('link', { name: t('call.label') })).toBeVisible({
      visible: width < 1280,
    });
    await expect(page.locator('[data-sticky-bar]')).toBeHidden();
  }
});

test('T-NV2 the services menu opens from the keyboard, Tab enters it, Esc closes it and returns focus', async ({
  page,
}, testInfo) => {
  test.skip(!isDesktop(testInfo), 'the mega menu exists from 1024 px');
  await page.goto(PAGE);
  const button = page.getByRole('button', { name: t('nav.services') });
  const panel = page.locator('#mega-menu');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(panel).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(panel.getByRole('link', { name: t('nav.allServices') })).toBeVisible();
  await expect(panel.getByRole('link', { name: t('urgent.label') })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(panel.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');

  // Space opens it too; focus leaving the panel closes it.
  await page.keyboard.press('Space');
  await expect(panel).toBeVisible();
  const stops = await panel.locator('a').count();
  for (let i = 0; i <= stops; i++) await page.keyboard.press('Tab');
  await expect(panel).toBeHidden();
  await expect(
    page.getByRole('banner').getByRole('link', { name: t('nav.dentists') }),
  ).toBeFocused();

  // A click outside closes it (light dismiss).
  await button.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(10, 800);
  await expect(panel).toBeHidden();
});

test('T-NV2b hover intent opens the menu, a click keeps it open, leaving closes it', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'fine-pointer rows run in desktop-light');
  await page.goto(PAGE);
  const button = page.getByRole('button', { name: t('nav.services') });
  const panel = page.locator('#mega-menu');
  await button.hover();
  await expect(panel).toBeVisible();
  await button.click();
  await expect(panel).toBeVisible();
  await page.mouse.move(10, 800);
  // The click pinned it: leaving does not close a menu the visitor opened.
  await page.waitForTimeout(600);
  await expect(panel).toBeVisible();
  await button.click();
  await expect(panel).toBeHidden();
  await page.mouse.move(10, 800);
  await button.hover();
  await expect(panel).toBeVisible();
  await page.mouse.move(10, 800);
  await expect(panel).toBeHidden();
});

test('T-NV3 the drawer traps Tab, closes with Esc and returns focus to the menu button', async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), 'the drawer exists under 1024 px');
  await page.goto(PAGE);
  await hydrated(page); // the Tab wrap and the aria-expanded sync come from the island
  const open = page.getByRole('button', { name: t('nav.menuOpen') });
  await open.click();
  const drawer = page.getByRole('dialog', { name: t('nav.drawer') });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: t('nav.menuClose') })).toBeFocused();
  await expect(open).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('[data-sticky-bar]')).not.toBeInViewport();
  // Theme toggle in the drawer foot (none in the phone header).
  await expect(drawer.getByRole('button', { name: t('theme.toggle') })).toBeVisible();

  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await insideDialog(page, 'site-drawer'), `Tab ${i + 1}`).toBe(true);
  }
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('Shift+Tab');
    expect(await insideDialog(page, 'site-drawer'), `Shift+Tab ${i + 1}`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(open).toBeFocused();
  await expect(open).toHaveAttribute('aria-expanded', 'false');

  // The close button closes it too; a service group opens in place; rows are 48 px.
  await open.click();
  const group = drawer.locator('summary').first();
  await group.click();
  await expect(drawer.locator('details').first()).toHaveAttribute('open', '');
  const rows = await drawer
    .locator('nav ul a:visible, nav summary')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.min(...rows)).toBeGreaterThanOrEqual(48);
  await drawer.getByRole('button', { name: t('nav.menuClose') }).click();
  await expect(drawer).toBeHidden();
  await expect(open).toBeFocused();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('T-NV3b the drawer opens natively with focus on «بستن منو» and closes with Esc', async ({
    page,
  }, testInfo) => {
    test.skip(isDesktop(testInfo), 'the drawer exists under 1024 px');
    await page.goto(PAGE);
    await page.getByRole('button', { name: t('nav.menuOpen') }).click();
    const drawer = page.getByRole('dialog', { name: t('nav.drawer') });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: t('nav.menuClose') })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});

test('T-NV4 the sticky bar never covers content at 390x844', async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('phone'),
    'the 390x844 check runs in the phone projects',
  );
  await page.goto(PAGE);
  const bar = page.locator('[data-sticky-bar]');
  await expect(bar).toBeInViewport();
  expect((await bar.boundingBox())!.height).toBe(64);
  // The last element of main, brought to the bottom edge, ends above the bar's top.
  const lastOfMain = await page.evaluate(() => {
    let el = document.querySelector('main') as Element;
    while (el.lastElementChild) el = el.lastElementChild;
    el.scrollIntoView({ block: 'end' });
    return el.getBoundingClientRect().bottom;
  });
  expect(lastOfMain).toBeLessThanOrEqual(844 - 64);
  // At the end of the page the last footer line also ends above it, hidden bar or not.
  const lastOfPage = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    let el = document.querySelector('footer') as Element;
    while (el.lastElementChild) el = el.lastElementChild;
    return el.getBoundingClientRect().bottom;
  });
  expect(lastOfPage).toBeLessThanOrEqual(844 - 64);
  // The footer contact block is in view down here: the bar has stepped aside and is inert.
  await expect(bar).toHaveAttribute('data-hidden', '');
  expect(await bar.evaluate((el) => (el as HTMLElement).inert)).toBe(true);
});

test('T-NV5 the sticky bar hides while a text field has focus and returns after a press ends', async ({
  page,
}, testInfo) => {
  test.skip(isDesktop(testInfo), 'the sticky bar exists under 1024 px');
  await page.goto(PAGE);
  await hydrated(page);
  await growMain(page);
  // A form at the top of main, away from the footer contact block.
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML =
      '<label>tel <input id="nv-field" type="tel"></label> <button id="nv-submit" type="button">ok</button> <label><input id="nv-radio" type="radio"> r</label>';
    document.querySelector('main')!.prepend(form);
  });
  const bar = page.locator('[data-sticky-bar]');
  await expect(bar).not.toHaveAttribute('data-hidden');
  await page.locator('#nv-field').focus();
  await expect(bar).toHaveAttribute('data-hidden', '');
  await expect(bar).not.toBeInViewport();
  // A press on the button takes focus from the field; the bar waits for the press to end.
  const box = (await page.locator('#nv-submit').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('#nv-submit')).toBeFocused();
  await page.waitForTimeout(100);
  await expect(bar).toHaveAttribute('data-hidden', '');
  await page.mouse.up();
  await expect(bar).not.toHaveAttribute('data-hidden');
  await expect(bar).toBeInViewport();
  // A radio brings up no keyboard: the bar stays.
  await page.locator('#nv-radio').focus();
  await expect(bar).not.toHaveAttribute('data-hidden');
});

test('T-NV6 no horizontal scroll from 320 px, with the drawer open too', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'viewport rows run in desktop-light');
  const overflow = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      const drawer = document.querySelector('#site-drawer nav');
      return Math.max(
        root.scrollWidth - root.clientWidth,
        drawer && drawer.checkVisibility() ? drawer.scrollWidth - drawer.clientWidth : 0,
      );
    });
  for (const width of [320, 360, 390, 430, 744, 820, 1023, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(PAGE);
    expect(await overflow(), `${width}`).toBe(0);
    if (width < 1024) {
      await page.getByRole('button', { name: t('nav.menuOpen') }).click();
      for (const summary of await page.locator('#site-drawer summary').all()) await summary.click();
      expect(await overflow(), `${width} drawer`).toBe(0);
    }
  }
});

test('T-NV7 while the clinic is closed a call press opens the sheet instead of dialing', async ({
  page,
}, testInfo) => {
  await mockHours(page, true);
  const session = page.waitForResponse('**/api/form-session');
  await page.goto(PAGE);
  await session;
  await hydrated(page);
  await growMain(page);
  const canceled = await recordClickDefault(page);
  const call = page.getByRole('banner').locator('a[href^="tel:"]:visible');
  await call.click();
  expect(await canceled()).toBe(true);
  const sheet = page.getByRole('dialog', { name: CLOSED_TEXT });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('link', { name: t('nav.book') })).toBeVisible();
  await expect(sheet.getByRole('link', { name: t('call.label') })).toHaveAttribute(
    'href',
    'tel:+982155101054',
  );
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(call).toBeFocused();

  if (!isDesktop(testInfo)) {
    // The sticky bar cell and the drawer's call button go through the sheet too.
    await page.locator('[data-sticky-bar] a[href^="tel:"]').click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: t('nav.sheetClose') }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: t('nav.menuOpen') }).click();
    const drawerCall = page.locator('#site-drawer').getByRole('link', { name: t('call.label') });
    await drawerCall.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(drawerCall).toBeFocused();
  }
});

test('T-NV8 while the clinic is open a call press dials, and no hours sentence is in the HTML', async ({
  page,
  request,
}) => {
  await mockHours(page, false);
  const session = page.waitForResponse('**/api/form-session');
  await page.goto(PAGE);
  await session;
  const canceled = await recordClickDefault(page);
  await page.getByRole('banner').locator('a[href^="tel:"]:visible').click();
  expect(await canceled()).toBe(false);
  await expect(page.locator('#closed-sheet')).toBeHidden();
  const html = await (await request.get(PAGE)).text();
  expect(html).not.toContain('کلینیک الان بسته است');
});

test('T-NV9 «رزرو نوبت» focuses the hero phone field in view, else goes to the booking block', async ({
  page,
}, testInfo) => {
  const desktop = isDesktop(testInfo);
  await page.goto(PAGE);
  await hydrated(page);
  // The booking form contract (BookingForm instances `hero` and `block`), without the home page.
  await page.evaluate(() => {
    const main = document.querySelector('main')!;
    const hero = document.createElement('form');
    hero.dataset.bookingForm = 'hero';
    hero.innerHTML = '<label>hero <input id="nv-hero" type="tel"></label>';
    main.prepend(hero);
    const filler = document.createElement('div');
    filler.style.minHeight = '200vh';
    const block = document.createElement('form');
    block.dataset.bookingForm = 'block';
    block.innerHTML = '<h2>block</h2><label>block <input id="nv-block" type="tel"></label>';
    main.append(filler, block);
  });
  const cta = desktop
    ? page.getByRole('banner').getByRole('link', { name: t('nav.book') })
    : page.locator('[data-sticky-bar]').getByRole('link', { name: t('nav.book') });
  const press = () => (desktop ? cta.click() : cta.tap());

  await press();
  await expect(page.locator('#nv-hero')).toBeFocused();
  await expect(page.locator('[data-booking-form="hero"]')).toHaveAttribute(
    'data-booking-opened',
    '',
  );
  expect(new URL(page.url()).pathname).toBe(PAGE);

  // The hero card out of view: the block scrolls in; the phone field (fine pointer) or the
  // heading (touch, no keyboard over the form) takes focus.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, window.innerHeight * 1.5);
  });
  await press();
  const block = page.locator('[data-booking-form="block"]');
  await expect(block).toBeInViewport();
  await expect(desktop ? page.locator('#nv-block') : block.getByRole('heading')).toBeFocused();

  if (!desktop) {
    // The drawer's «رزرو نوبت» closes the drawer first; focus does not return to the menu button.
    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
    await page.getByRole('button', { name: t('nav.menuOpen') }).click();
    await page
      .locator('#site-drawer')
      .getByRole('link', { name: t('nav.book') })
      .tap();
    await expect(page.locator('#site-drawer')).toBeHidden();
    await expect(block.getByRole('heading')).toBeFocused();
  }
});
