// The states the site CSS styled with `:has()` until phase 7 (scripts/check-has.mjs). In Chromium
// one active `:has()` rule makes every DOM insertion restyle the whole page, so with JavaScript
// they follow attributes the chrome sets (html `data-modal`, `aria-expanded`, `data-choice`,
// `data-checked`) or sibling and pseudo-element selectors; without JavaScript the `:has()` rules
// exist only under `@media (scripting: none)`. Tiers, the home tier step and the avulsion first
// aid: tiers.spec.ts (T-TR3, T-TR4), home.spec.ts (T-HOME15), emergency.spec.ts (T-EM4). With
// JavaScript on but the app chunks never running (a blocked or failed download), the
// attribute-driven states stay in their server HTML state: T-NH8 to T-NH10 pin what that means.
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

/** The `:has()` selectors of the page's stylesheets that apply now. */
const activeHas = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSMediaRule) {
          if (matchMedia(rule.conditionText).matches) walk(rule.cssRules);
        } else if (rule instanceof CSSStyleRule) {
          if (rule.selectorText.includes(':has(')) out.push(rule.selectorText);
          walk(rule.cssRules);
        } else if (rule instanceof CSSGroupingRule) {
          walk(rule.cssRules);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) walk(sheet.cssRules);
    return out;
  });

const style = (page: Page, selector: string, property: string, pseudo?: string) =>
  page.evaluate(
    ([s, p, ps]) => getComputedStyle(document.querySelector(s)!, ps).getPropertyValue(p),
    [selector, property, pseudo ?? null] as const,
  );

/**
 * A keyboard focus (:focus-visible): Shift+Tab off the element and Tab back, as a reader does. A
 * script focus followed by a key press is not enough in WebKit and Firefox after a click (CI run
 * 85, T-NH5 and T-NH7): their heuristics look at the input that moved the focus.
 */
async function keyboardFocus(page: Page, selector: string): Promise<void> {
  await page.locator(selector).first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator(selector).first()).toBeFocused();
  expect(
    await page
      .locator(selector)
      .first()
      .evaluate((el) => el.matches(':focus-visible')),
  ).toBe(true);
}

/** A page of the project's device and theme without JavaScript. */
async function noScript(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ javaScriptEnabled: false });
  return context.newPage();
}

/**
 * JavaScript on, every app chunk aborted (a blocked or failed download): the inline scripts run,
 * no island or chrome script ever does. Returns the count of aborted chunks.
 */
async function abortAppChunks(page: Page): Promise<() => number> {
  let aborted = 0;
  await page.route(
    (url) => url.pathname.startsWith('/_next/static/chunks/') && url.pathname.endsWith('.js'),
    (route) => {
      aborted += 1;
      return route.abort();
    },
  );
  return () => aborted;
}

const PAGES = ['/qa/not-found', '/?tier=0', '/qa/components', encodeURI('/اورژانس')];

test('T-NH1 no :has() rule applies with JavaScript; without it the no-JS rules do', async ({
  page,
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  for (const url of PAGES) {
    await page.goto(url);
    expect(await activeHas(page), url).toEqual([]);
  }
  const plain = await noScript(browser);
  await plain.goto(PAGES[0]!);
  expect((await activeHas(plain)).length).toBeGreaterThan(0);
  await plain.context().close();
});

test('T-NH2 an open drawer locks the page scroll and hides the sticky bar, with JavaScript and without', async ({
  page,
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-dark');
  const plain = await noScript(browser);
  for (const [p, js] of [
    [page, true],
    [plain, false],
  ] as const) {
    await p.goto('/qa/not-found');
    const html = p.locator('html');
    await p.getByRole('button', { name: t('nav.menuOpen') }).click();
    await expect(p.getByRole('dialog', { name: t('nav.drawer') })).toBeVisible();
    // data-modal comes from ChromeScripts; without JavaScript the no-JS :has() rule locks.
    if (js) await expect(html).toHaveAttribute('data-modal', '');
    else await expect(html).not.toHaveAttribute('data-modal');
    await expect(html).toHaveCSS('overflow-y', 'hidden');
    await expect(p.locator('[data-sticky-bar]')).toHaveCSS('translate', '0px 120%');
    await p.keyboard.press('Escape');
    await expect(p.getByRole('dialog', { name: t('nav.drawer') })).toBeHidden();
    await expect(html).not.toHaveAttribute('data-modal');
    await expect(html).toHaveCSS('overflow-y', 'visible');
  }
  await plain.context().close();
});

test('T-NH3 the intro hides the sticky bar while it plays (html data-intro)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'playing');
  await expect(page.locator('[data-sticky-bar]')).toHaveCSS('translate', '0px 120%');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'playing');
  await expect(page.locator('html')).toHaveAttribute('data-intro', 'done');
  await expect(page.locator('[data-sticky-bar]')).toHaveCSS('translate', 'none');
});

test('T-NH4 the services caret turns while the panel is open, with JavaScript and without', async ({
  page,
  browser,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'desktop-dark');
  const plain = await noScript(browser);
  for (const p of [page, plain]) {
    await p.goto('/qa/not-found');
    const caret = '[popovertarget="mega-menu"] > svg';
    expect(await style(p, caret, 'rotate')).toBe('none');
    await p.getByRole('button', { name: t('nav.services') }).click();
    await expect(p.locator('#mega-menu')).toBeVisible();
    await expect(p.locator(caret)).toHaveCSS('rotate', '180deg');
    await p.keyboard.press('Escape');
    await expect(p.locator('#mega-menu')).toBeHidden();
    await expect(p.locator(caret)).toHaveCSS('rotate', 'none');
  }
  await plain.context().close();
});

test('T-NH5 a chip turns brand when checked and rings on keyboard focus only, with JavaScript and without', async ({
  page,
  browser,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  const plain = await noScript(browser);
  for (const p of [page, plain]) {
    await p.goto(encodeURI('/رزرو-نوبت'));
    const chip = p.locator('main label:has(> input[type="radio"])').nth(1);
    const pill = chip.locator('xpath=./span');
    const brand = await p.evaluate(() => {
      const probe = document.createElement('i');
      document.body.append(probe);
      const color = (token: string) => {
        probe.style.color = `var(${token})`;
        return getComputedStyle(probe).color;
      };
      const out = [
        color('--color-brand'),
        color('--color-brand-soft'),
        color('--color-brand-strong'),
      ];
      probe.remove();
      return out;
    });
    await chip.click();
    await expect(chip.locator('input')).toBeChecked();
    await expect(pill).toHaveCSS('border-top-color', brand[0]!);
    await expect(pill).toHaveCSS('background-color', brand[1]!);
    await expect(pill).toHaveCSS('color', brand[2]!);
    // A pointer focus draws no ring; the keyboard does.
    await expect(pill).toHaveCSS('outline-style', 'none');
    await chip.locator('input').blur();
    await keyboardFocus(p, 'main label:has(> input[type="radio"]) >> nth=1 >> input');
    await expect(pill).toHaveCSS('outline-width', '2px');
  }
  await plain.context().close();
});

test("T-NH6 a link card rings on the link's ::after at the card's box, on keyboard focus only", async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-dark');
  await page.goto('/qa/components');
  const link = 'article.isolate h3 > a';
  const card = await page
    .locator(link)
    .first()
    .evaluate((a) => {
      const box = a.closest('article')!.getBoundingClientRect();
      return { width: box.width, height: box.height };
    });
  expect(await style(page, link, 'outline-style', '::after')).toBe('none');
  await keyboardFocus(page, link);
  expect(await style(page, link, 'outline-width', '::after')).toBe('2px');
  expect(await style(page, link, 'outline-offset', '::after')).toBe('2px');
  expect(Number.parseFloat(await style(page, link, 'width', '::after'))).toBeCloseTo(card.width, 1);
  expect(Number.parseFloat(await style(page, link, 'height', '::after'))).toBeCloseTo(
    card.height,
    1,
  );
  expect(await style(page, 'article.isolate', 'outline-style')).toBe('none');
});

test('T-NH7 the compare handle rings on keyboard focus of its range only', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-dark');
  await page.goto('/?tier=0');
  const range = page.locator('input[type="range"]').first();
  const knob = range.locator('xpath=following-sibling::span[1]/span');
  await range.scrollIntoViewIfNeeded();
  await range.click();
  await expect(knob).toHaveCSS('outline-style', 'none');
  await range.blur();
  await keyboardFocus(page, 'input[type="range"]');
  await expect(knob).toHaveCSS('outline-width', '2px');
  await expect(knob).toHaveCSS('outline-offset', '2px');
});

test('T-NH8 the avulsion first aid follows its box when the app scripts never run', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  const aborted = await abortAppChunks(page);
  await page.goto(encodeURI('/اورژانس'), { waitUntil: 'load' });
  expect(aborted()).toBeGreaterThan(0);
  const form = page.locator('form[data-emergency-form]');
  const box = form.getByLabel(t('emergency.triage.avulsion'), { exact: true });
  const text = page.getByText(t('emergency.avulsion.text'));
  await expect(text).toBeHidden();
  await box.check();
  await expect(text).toBeVisible();
  await box.uncheck();
  await expect(text).toBeHidden();
  // The island never ran (it sets noValidate on mount).
  expect(await form.evaluate((f) => (f as HTMLFormElement).noValidate)).toBe(false);
});

test('T-NH9 tiers when the app scripts never run: no warm card or badge, the plain CTA still books', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'desktop-light');
  const aborted = await abortAppChunks(page);
  await page.goto(encodeURI('/خدمات/ترمیم-دندان#سطح-ترمیم'), { waitUntil: 'load' });
  expect(aborted()).toBeGreaterThan(0);
  const tiers = page.locator('[id="سطح-ترمیم"]');
  await tiers.getByRole('radio', { name: 'VIP' }).check();
  // Neither data-choice nor data-checked without ChromeScripts, so the card stays cold and the
  // badge hidden: the documented trade-off of no :has() with JavaScript.
  await expect(tiers.locator('[data-choices]')).not.toHaveAttribute('data-choice');
  await expect(tiers.locator('article').nth(1)).not.toHaveAttribute('data-checked');
  await expect(tiers.getByText(t('pages.tiers.chosen')).filter({ visible: true })).toHaveCount(0);
  const book = tiers.getByRole('link', { name: t('services.book') });
  await expect(book).toHaveCount(1);
  await expect(book).toHaveAttribute('href', /\?service=restoration$/);
  await book.click();
  await page.waitForURL(/service=restoration/);
  const url = new URL(page.url());
  expect(decodeURIComponent(url.pathname)).toBe('/رزرو-نوبت');
  expect(url.search).toBe('?service=restoration');
});

test('T-NH10 the drawer when the app scripts never run: it opens natively, the page keeps its scroll and bar', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-dark');
  const aborted = await abortAppChunks(page);
  await page.goto('/qa/not-found', { waitUntil: 'load' });
  expect(aborted()).toBeGreaterThan(0);
  const html = page.locator('html');
  await page.getByRole('button', { name: t('nav.menuOpen') }).click();
  const drawer = page.getByRole('dialog', { name: t('nav.drawer') });
  await expect(drawer).toBeVisible();
  // No data-modal without ChromeScripts, so nothing locks the page or hides the bar: the
  // documented trade-off of no :has() with JavaScript.
  await expect(html).not.toHaveAttribute('data-modal');
  await expect(html).toHaveCSS('overflow-y', 'visible');
  await expect(page.locator('[data-sticky-bar]')).toHaveCSS('translate', 'none');
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});
