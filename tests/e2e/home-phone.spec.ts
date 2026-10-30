// The phone scroll set and the light notice (phone spec sections 2, 3 and 5.2; step 4b) for the
// scenes landed so far: hero (Drift of the 4:5 band's img), trust (still) and services (Slide of
// the snap row, Settle of the mark). T-PH1 to T-PH9, T-PH11 and T-PH12 run in phone-light and
// phone-dark; T-PH10 in tablet-light. Rows that need a scene of a later step (the voices row, the
// replay box, the «کیفیت» control) wait for that step.
//
// Headless Chromium renders WebGL in software, so a phone without `?tier` is class W
// ('software-renderer') after the probe. Where a row needs a capable phone in auto mode it uses
// `?tier=1&monitor=1` (a query tier the monitor may lower). `?debug=1` loads no canvas on a phone
// (D5 in phase 7: a phone draws no WebGL), so those rows run the DOM frame monitor a visitor gets.
import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { t } from '@/i18n/fa';

import { expectNoA11yViolations } from '../helpers/axe';
import { scrollThrough } from '../helpers/frames';
import { showHeroBand } from '../helpers/heroBand';
import { skipIntro } from '../helpers/intro';
import { noWebgl2Launch } from '../helpers/launch';
import { VIEWPORTS } from '../helpers/screens';

const IMG = '[data-scene="hero"] [data-hero-photo] img';
const PHOTO = '[data-scene="hero"] [data-hero-photo]';
const TRACK = '[data-scene="services"] [data-track]';
const MARK = '[data-scene="services"] [data-mark]';
const NOTICE = '[data-light-notice]';
const STATUS = '#light-notice-text';
/** Scrub lag (0.32 s on coarse pointers) plus the settle window, with margin. */
const SCRUB_WAIT_MS = 700;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}
const phoneOnly = (testInfo: TestInfo): void => only(testInfo, 'phone-light', 'phone-dark');

test.beforeEach(({ page }) => skipIntro(page));

/** Phone spec 4.1 item 2: the context is a coarse pointer under 1024 px without Lenis. */
async function expectPhoneProfile(page: Page): Promise<void> {
  const profile = await page.evaluate(() => ({
    coarse: matchMedia('(pointer: coarse)').matches,
    wide: matchMedia('(min-width: 1024px)').matches,
    lenis: document.documentElement.classList.contains('lenis'),
  }));
  expect(profile, 'the phone profile is coarse and narrow').toEqual({
    coarse: true,
    wide: false,
    lenis: false,
  });
}

/** The engine was created (its creation measure) and the near scenes set up their scrubs. */
async function scrollSetReady(page: Page, selectors: string[] = [IMG, TRACK]): Promise<void> {
  await page.waitForLoadState('load');
  await expect
    .poll(() => page.evaluate(() => performance.getEntriesByName('sefid:engine-init').length), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0);
  for (const selector of selectors) {
    await expect(page.locator(`${selector}[data-scrub]`)).toHaveCount(1, { timeout: 10_000 });
  }
  // The settle window after creation (D25: --dur-3 plus 50 ms) is over.
  await page.waitForTimeout(500);
}

type DebugHook = {
  snapshot(): {
    tier: number;
    reason: string;
    layout: { latchedAtTier: number };
    scrollTriggers: number;
    tickSubscribers: number;
    monitor: { windows: number; frames: number };
    labels: string[];
  };
  stepDown(): void;
};

/** `?debug=1`: the hook is installed and the engine measured its labels. */
async function hookReady(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForFunction(
    () => {
      const hook = (window as unknown as { __sefid?: DebugHook }).__sefid;
      return hook !== undefined && hook.snapshot().labels.length > 0;
    },
    null,
    { timeout: 20_000 },
  );
}

const snapshot = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sefid: DebugHook }).__sefid.snapshot());

/** Script responses holding ScrollTrigger (the engine chunk) and detect-gpu benchmark requests. */
function watchRequests(page: Page): { engine: Set<string>; benchmark: Set<string> } {
  const seen = { engine: new Set<string>(), benchmark: new Set<string>() };
  page.on('request', (request) => {
    if (request.url().includes('/detect-gpu/')) seen.benchmark.add(request.url());
  });
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    const body = await response.text().catch(() => '');
    if (body.includes('ScrollTrigger')) seen.engine.add(response.url());
  });
  return seen;
}

/** Every `layout-shift` entry, `hadRecentInput` included: a swipe start counts as input. */
async function recordClsAll(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __clsAll: number; __clsSources: string[] };
    w.__clsAll = 0;
    w.__clsSources = [];
    // The developer overlay (`?debug=1` only) grows as it fills; it is not page content.
    type Shift = { value: number; sources?: Array<{ node?: Node | null }> };
    const overlayOnly = (shift: Shift): boolean =>
      (shift.sources ?? []).length > 0 &&
      (shift.sources ?? []).every(
        ({ node }) => node instanceof Element && node.closest('[data-dev-overlay]') !== null,
      );
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Shift[]) {
        if (overlayOnly(entry)) continue;
        w.__clsAll += entry.value;
        for (const { node } of entry.sources ?? []) {
          w.__clsSources.push(
            node instanceof Element ? node.outerHTML.slice(0, 100) : String(node),
          );
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

/**
 * clsAll is 0 (phone spec section 4: target 0, gate 0.05). Below 0.001 counts as 0: a sub-pixel
 * shift under two parallel workers (1.8e-5 once) is rounding, not a moved box; the sources name
 * any shift.
 */
async function expectNoShift(page: Page): Promise<void> {
  const { value, sources } = await page.evaluate(() => {
    const w = window as unknown as { __clsAll: number; __clsSources: string[] };
    return { value: w.__clsAll, sources: w.__clsSources };
  });
  expect(value, `clsAll from ${sources.join(' | ') || 'nothing'}`).toBeLessThan(0.001);
}

/** The document top of an element, transforms ignored (the offset chain). */
const docTop = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    let y = 0;
    for (let e = el as HTMLElement | null; e; e = e.offsetParent as HTMLElement | null) {
      y += e.offsetTop;
    }
    return y;
  });

async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
  await page.waitForTimeout(SCRUB_WAIT_MS);
}

/** Computed opacity and whether the computed transform is the identity. */
const look = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    const matrix = style.transform === 'none' ? null : new DOMMatrixReadOnly(style.transform);
    return {
      opacity: Number(style.opacity),
      identity: matrix === null || matrix.isIdentity,
      transform: style.transform,
    };
  });

/** The parts that must never move on a phone: the H1, the hero card and the trust facts. */
const stillParts = (page: Page) =>
  page.evaluate(() => {
    const card = document.getElementById('bk-hero')?.parentElement;
    const facts = [
      ...document.querySelectorAll<HTMLElement>('[data-scene="trust"], [data-scene="trust"] *'),
    ];
    return [document.getElementById('hero-h1'), card, ...facts]
      .filter((el): el is HTMLElement => el instanceof HTMLElement && el.style.transform !== '')
      .map((el) => el.outerHTML.slice(0, 80));
  });

const viewportHeight = (page: Page): number => page.viewportSize()?.height ?? 844;
const barPx = (page: Page) =>
  page.evaluate(() => document.querySelector<HTMLElement>('[data-sticky-bar]')?.offsetHeight ?? 0);

/** One CDP finger swipe of `dy` px (positive scrolls down), held 100 ms by default so no fling follows. */
async function swipe(
  page: Page,
  cdp: CDPSession,
  dy: number,
  during?: () => Promise<void>,
  holdMs = 100,
): Promise<void> {
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  const x = Math.round(size.width / 2);
  const from = Math.round(dy > 0 ? size.height * 0.75 : size.height * 0.25);
  const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    });
  await touch('touchStart', from);
  for (let step = 1; step <= 10; step += 1) {
    await touch('touchMove', Math.round(from - (dy * step) / 10));
    if (step === 5 && during) await during();
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(holdMs);
  await touch('touchEnd', 0);
}

/** Scrolls by touch until the hero card's bottom is above the header's, then holds still. */
async function scrollPastHeroCard(page: Page): Promise<void> {
  const target = await page.evaluate(() => {
    const card = document.getElementById('bk-hero')?.parentElement as HTMLElement;
    const header = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    return Math.ceil(card.getBoundingClientRect().bottom + window.scrollY - header + 24);
  });
  expect(await scrollThrough(page, 1, { drive: 'touch', endY: target })).toBe(true);
}

/** Rects that the notice must never cover. */
const coveredParts = (page: Page) =>
  page.evaluate(() => {
    const box = document.querySelector('[data-light-notice]')?.getBoundingClientRect();
    if (!box) throw new Error('no notice');
    const parts = {
      h1: document.getElementById('hero-h1'),
      bar: document.querySelector('[data-sticky-bar]'),
      submit: document.querySelector('#bk-hero button[type="submit"]'),
    };
    return Object.entries(parts)
      .filter(([, el]) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top;
      })
      .map(([name]) => name);
  });

/** The notice's buttons, each at least 44 x 44. */
async function expectTargets(page: Page): Promise<void> {
  const sizes = await page
    .locator(`${NOTICE} button`)
    .evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).map((r) => [r.width, r.height]),
    );
  expect(sizes).toHaveLength(2);
  for (const [width, height] of sizes) {
    expect(width).toBeGreaterThanOrEqual(44);
    expect(height).toBeGreaterThanOrEqual(44);
  }
}

/** A weak phone (phone mode with 2 GB, D23): the light version at hydration, no probe. */
async function weakPhone(target: Page | BrowserContext, memory = 2): Promise<void> {
  await target.addInitScript((gb) => {
    Object.defineProperty(Navigator.prototype, 'deviceMemory', {
      get: () => gb,
      configurable: true,
    });
  }, memory);
}

for (const [id, tier] of [
  ['T-PH1', 1],
  ['T-PH2', 2],
] as const) {
  test(`${id} ?tier=${tier} at 390 touch: no pin; Drift, Slide and Settle move inside their ranges, start at the bar top and rest at their reading lines; the H1, the card and the trust facts never move`, async ({
    page,
  }, testInfo) => {
    phoneOnly(testInfo);
    await showHeroBand(page);
    await page.goto(`/?tier=${tier}`);
    await scrollSetReady(page, [IMG, TRACK, MARK]);
    await expectPhoneProfile(page);
    await expect(page.locator('html[data-pins]')).toHaveCount(0);
    expect(await stillParts(page)).toEqual([]);
    const height = viewportHeight(page);
    const bar = await barPx(page);

    // Drift: the img moves inside its layer, which never moves.
    const frame = await docTop(page, PHOTO);
    await scrollToY(page, frame - height * 0.9);
    const early = await look(page, IMG);
    await scrollToY(page, frame - height * 0.3);
    const late = await look(page, IMG);
    expect(late.transform).not.toBe(early.transform);
    expect((await look(page, PHOTO)).identity).toBe(true);
    expect(await stillParts(page)).toEqual([]);

    // Slide (reading line 75 %) and Settle (60 %): dim at the bar top, at rest at the line.
    for (const [selector, line] of [
      [TRACK, 0.75],
      [MARK, 0.6],
    ] as const) {
      const top = await docTop(page, selector);
      const atBar = top - (height - bar);
      await scrollToY(page, atBar);
      const start = await look(page, selector);
      expect(start.opacity, `${selector} at the bar top`).toBeLessThanOrEqual(0.61);
      await scrollToY(page, atBar + (height - bar - height * line) / 2);
      const mid = await look(page, selector);
      expect(mid.opacity).toBeGreaterThan(start.opacity);
      await scrollToY(page, top - height * line + 4);
      const rest = await look(page, selector);
      expect(rest, `${selector} at its reading line`).toMatchObject({ opacity: 1, identity: true });
      expect(await stillParts(page)).toEqual([]);
    }
  });
}

test('T-PH3 ?tier=0: no engine chunk; after a full touch scroll nothing has an inline transform or opacity, every section is visible, and every scene box is where ?tier=1 puts it (D24)', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  const sceneBoxes = () =>
    page.locator('[data-scene], [data-home-section]').evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [
          el.getAttribute('data-scene') ?? el.getAttribute('data-home-section'),
          Math.round(r.left),
          Math.round(r.top + window.scrollY),
          Math.round(r.width),
          Math.round(r.height),
        ];
      }),
    );
  await page.goto('/?tier=1');
  await scrollSetReady(page);
  const atOne = await sceneBoxes();

  const seen = watchRequests(page);
  await page.goto('/?tier=0');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  await expectPhoneProfile(page);
  expect(await sceneBoxes()).toEqual(atOne);
  expect(await scrollThrough(page, 1, { drive: 'touch' })).toBe(true);
  await page.waitForTimeout(1000);
  expect([...seen.engine]).toEqual([]);
  const styled = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-experience-root] *')]
      .filter((el) => el.style.transform !== '' || el.style.opacity !== '')
      .map((el) => el.outerHTML.slice(0, 80)),
  );
  expect(styled).toEqual([]);
  const hidden = await page.locator('[data-home-section]').evaluateAll((els) =>
    els
      .filter((el) => {
        const style = getComputedStyle(el);
        return (
          el.getBoundingClientRect().height === 0 ||
          style.visibility !== 'visible' ||
          style.opacity !== '1'
        );
      })
      .map((el) => el.getAttribute('data-home-section')),
  );
  expect(hidden).toEqual([]);
});

for (const tier of [0, 1, 2] as const) {
  test(`T-PH4 ?tier=${tier}: clsAll is 0 for a load and a full touch scroll`, async ({
    page,
  }, testInfo) => {
    phoneOnly(testInfo);
    await recordClsAll(page);
    await page.goto(`/?tier=${tier}`);
    if (tier === 0) await page.waitForLoadState('load');
    else await scrollSetReady(page);
    expect(await scrollThrough(page, 1, { drive: 'touch' })).toBe(true);
    await page.waitForTimeout(1000);
    await expectNoShift(page);
  });
}

test('T-PH4 ?tier=1: clsAll is 0 for a reload with the scroll restored at the voices section', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await page.goto('/?tier=1');
  await scrollSetReady(page);
  const voices = await docTop(page, '[data-scene="voices"]');
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), voices);
  await page.waitForTimeout(300);
  await recordClsAll(page);
  await page.reload();
  await scrollSetReady(page, [IMG]);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(voices - 100);
  await expectNoShift(page);
});

test('T-PH5 a step-down mid-swipe: the engine waits for 1000 ms without scroll, the page holds still, the targets settle, and the stepped notice opens', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await recordClsAll(page);
  await page.goto('/?tier=1&monitor=1&debug=1');
  await hookReady(page);
  await scrollSetReady(page);
  const height = viewportHeight(page);
  const bar = await barPx(page);
  // The row 50 px under the bar top; the swipe ends inside its Slide range (147 px long).
  await scrollToY(page, (await docTop(page, TRACK)) - (height - bar) - 50);
  const cdp = await page.context().newCDPSession(page);
  await swipe(page, cdp, 150, () =>
    page.evaluate(() => (window as unknown as { __sefid: DebugHook }).__sefid.stepDown()),
  );
  await cdp.detach();
  const swipeEnd = Date.now();
  const place = () =>
    page.evaluate(() => {
      const y = window.innerHeight / 2;
      for (const el of [...document.querySelectorAll('[data-home-section]')].reverse()) {
        const r = el.getBoundingClientRect();
        if (r.top <= y && r.bottom > y)
          return { id: el.getAttribute('data-home-section'), top: r.top };
      }
      return null;
    });
  const before = await place();
  await page.waitForTimeout(Math.max(0, swipeEnd + 500 - Date.now()));
  const waiting = await snapshot(page);
  expect(waiting.tier).toBe(0);
  expect(waiting.layout.latchedAtTier, 'the engine still runs 500 ms after the swipe').toBe(1);
  expect(waiting.scrollTriggers).toBeGreaterThan(0);
  await expect
    .poll(async () => (await snapshot(page)).layout.latchedAtTier, { timeout: 2500 })
    .toBe(0);
  expect(Date.now() - swipeEnd).toBeGreaterThanOrEqual(1000);
  const after = await place();
  expect(after?.id).toBe(before?.id);
  expect(Math.abs((after?.top ?? 0) - (before?.top ?? 0))).toBeLessThanOrEqual(1);
  await page.waitForTimeout(400);
  const styled = await page
    .locator('[data-scrub]')
    .evaluateAll((els) =>
      els.filter((el) => (el as HTMLElement).style.transform !== '').map((el) => el.tagName),
    );
  expect(styled).toEqual([]);
  await expectNoShift(page);
  expect(await page.evaluate(() => sessionStorage.getItem('sefid-tier-cap'))).toBe('0');
  const floor = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sefid-light') ?? 'null'),
  );
  expect(floor?.n).toBe(1);
  await expect(page.locator(STATUS)).toHaveText(t('home.light.stepped'), { timeout: 3000 });
});

test('T-PH6 a weak phone at load (2 GB, no ?tier): no engine, no benchmark; the loaded notice after the hero, its switch, «بستن» and the records that keep it closed', async ({
  page,
  browser,
  baseURL,
  colorScheme,
}, testInfo) => {
  phoneOnly(testInfo);
  test.setTimeout(120_000);
  await weakPhone(page);
  await showHeroBand(page);
  const seen = watchRequests(page);
  const workers: string[] = [];
  page.on('worker', (worker) => workers.push(worker.url()));
  await page.goto('/');
  await page.waitForLoadState('load');
  await expectPhoneProfile(page);
  await page.waitForTimeout(2500);
  // The first screen: closed, nothing announced.
  await expect(page.locator(NOTICE)).toHaveAttribute('data-light-notice', 'closed');
  await expect(page.locator(STATUS)).toHaveText('');
  expect(await page.evaluate(() => document.documentElement.dataset.tierReason)).toBe(
    'device-memory',
  );
  await scrollPastHeroCard(page);
  await expect(page.locator(STATUS)).toHaveText(t('home.light.loaded'), { timeout: 5000 });
  expect([...seen.engine]).toEqual([]);
  expect([...seen.benchmark]).toEqual([]);
  expect(workers).toEqual([]);
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
  expect(await coveredParts(page)).toEqual([]);
  await expectTargets(page);
  await expectNoA11yViolations(page, { include: NOTICE });

  // A link Tab reaches under the notice's band is scrolled below the notice: the scroll padding
  // takes the band out of the area focus scrolling treats as visible (WCAG 2.4.11).
  const all = page.locator('[data-scene="services"] a', { hasText: t('home.services.all') });
  const allTop = await docTop(
    page,
    `[data-scene="services"] a[href="${await all.getAttribute('href')}"]`,
  );
  const band = await page.locator(NOTICE).evaluate((el) => el.getBoundingClientRect().top);
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), allTop - band - 10);
  expect(await all.evaluate((el) => el.getBoundingClientRect().top)).toBeLessThan(
    await page.locator(NOTICE).evaluate((el) => el.getBoundingClientRect().bottom),
  );
  await page
    .locator(`${TRACK} a`)
    .last()
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await page.keyboard.press('Tab');
  await expect(all).toBeFocused();
  const noticeBottom = await page
    .locator(NOTICE)
    .evaluate((el) => el.getBoundingClientRect().bottom);
  expect(await all.evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
    noticeBottom,
  );

  // The switch: one button, focus kept, the saved choice, the engine and the scroll set.
  const toggle = page.locator(`${NOTICE} button`).first();
  await toggle.focus();
  await expect(toggle).toHaveText(t('home.light.turnOn'));
  await page.keyboard.press('Enter');
  await expect(page.locator(STATUS)).toHaveText(t('home.light.on'));
  await expect(toggle).toHaveText(t('home.light.turnOff'));
  await expect(toggle).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('sefid-quality'))).toBe('1');
  // The «کیفیت» control in the footer follows the same saved choice (step 8).
  await expect(page.getByRole('radio', { name: t('home.quality.tier1') })).toBeChecked();
  await expect.poll(() => seen.engine.size, { timeout: 15_000 }).toBeGreaterThan(0);
  const frame = await docTop(page, PHOTO);
  const height = viewportHeight(page);
  await scrollToY(page, frame - height * 0.9);
  await expect(page.locator(`${IMG}[data-scrub]`)).toHaveCount(1, { timeout: 10_000 });
  await page.waitForTimeout(SCRUB_WAIT_MS);
  const early = await look(page, IMG);
  await scrollToY(page, frame - height * 0.3);
  expect((await look(page, IMG)).transform).not.toBe(early.transform);
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(STATUS)).toHaveText(t('home.light.off'));
  await expect(toggle).toHaveText(t('home.light.turnOn'));
  await expect(toggle).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('sefid-quality'))).toBe('0');
  await expect(page.getByRole('radio', { name: t('home.quality.tier0') })).toBeChecked();

  // «بستن» by keyboard: focus goes to main; the notice closes.
  await page.keyboard.press('Tab');
  await expect(page.locator(`${NOTICE} button`).last()).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator(NOTICE)).toHaveAttribute('data-light-notice', 'closed');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('main');
  const record = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('sefid-light-notice') ?? 'null'),
  );
  expect(record?.variant).toBe('loaded');

  // The same session (a reload), a new context with the dismiss record, one with a saved choice.
  const stillClosed = async (target: Page): Promise<void> => {
    await target.waitForLoadState('load');
    await target.waitForTimeout(1500);
    await scrollPastHeroCard(target);
    await target.waitForTimeout(1800);
    await expect(target.locator(NOTICE)).toHaveAttribute('data-light-notice', 'closed');
    await expect(target.locator(STATUS)).toHaveText('');
  };
  await page.evaluate(() => localStorage.removeItem('sefid-quality'));
  await page.reload();
  await stillClosed(page);
  for (const [key, value] of [
    ['sefid-light-notice', JSON.stringify({ variant: 'loaded', until: Date.now() + 86_400_000 })],
    ['sefid-quality', '0'],
  ] as const) {
    const fresh = await phoneContext(browser, { baseURL, colorScheme });
    await weakPhone(fresh);
    await fresh.addInitScript(([k, v]) => localStorage.setItem(k, v), [key, value] as const);
    const other = await fresh.newPage();
    await other.goto('/');
    await stillClosed(other);
    await fresh.close();
  }
});

type ContextOptions = NonNullable<Parameters<Browser['newContext']>[0]>;

/** The project's own options a new context repeats: the server and the theme. */
type Project = Pick<ContextOptions, 'baseURL' | 'colorScheme'>;

/** The intro already played in this session (the spec skips it for every page it opens). */
async function skipIntroIn(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('sefid-intro', '1');
    } catch {
      // An opaque origin has no storage; the first real navigation runs this again.
    }
  });
}

/** A new phone context like the project's, the intro skipped. */
async function phoneContext(
  browser: Browser,
  project: Project,
  over: ContextOptions = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...VIEWPORTS.phone,
    locale: 'fa-IR',
    timezoneId: 'Asia/Tehran',
    ...project,
    ...over,
  });
  await skipIntroIn(context);
  return context;
}

for (const [name, size, fontScale] of [
  ['360x640', { width: 360, height: 640 }, 1],
  ['844x390', { width: 844, height: 390 }, 1],
  ['390x844 at a 200 % root font', { width: 390, height: 844 }, 2],
] as const) {
  test(`T-PH6 ${name}: the notice opens after the hero card, covers neither the H1, the bar nor the submit, and its buttons are at least 44 px`, async ({
    browser,
    baseURL,
    colorScheme,
  }, testInfo) => {
    phoneOnly(testInfo);
    const context = await phoneContext(browser, { baseURL, colorScheme }, { viewport: size });
    await weakPhone(context);
    if (fontScale !== 1) {
      await context.addInitScript((scale) => {
        document.addEventListener('DOMContentLoaded', () => {
          document.documentElement.style.fontSize = `${scale * 100}%`;
        });
      }, fontScale);
    }
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    await expect(page.locator(NOTICE)).toHaveAttribute('data-light-notice', 'closed');
    await scrollPastHeroCard(page);
    await expect(page.locator(STATUS)).toHaveText(t('home.light.loaded'), { timeout: 5000 });
    expect(await coveredParts(page)).toEqual([]);
    await expectTargets(page);
    // The box is inside the screen and holds its buttons. The screen is clientWidth: at a 200 %
    // root font the header widens the page to 446 px, so innerWidth is wider than the screen.
    // In landscape the text line sits level with the buttons.
    const geometry = await page.locator(NOTICE).evaluate((box) => {
      const r = box.getBoundingClientRect();
      const p = box.querySelector('p');
      const text = p?.getBoundingClientRect();
      const range = document.createRange();
      if (p) range.selectNodeContents(p);
      const line = range.getBoundingClientRect();
      const buttons = [...box.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
      const button = buttons[0];
      return {
        fits:
          r.left >= 0 &&
          r.right <= document.documentElement.clientWidth &&
          buttons.every((b) => b.left >= r.left - 1 && b.right <= r.right + 1),
        oneRow: !!text && !!button && button.top < text.bottom && button.bottom > text.top,
        offset: button
          ? Math.abs(line.top + line.height / 2 - (button.top + button.height / 2))
          : -1,
      };
    });
    expect(geometry.fits).toBe(true);
    expect(geometry.oneRow).toBe(size.height <= 500);
    if (size.height <= 500) expect(geometry.offset).toBeLessThanOrEqual(2);
    await context.close();
  });
}

test('T-PH7 never shown: reduced motion, Save-Data, ?tier=0, a fine pointer with 2 GB, a phone without WebGL 2', async ({
  browser,
  baseURL,
  colorScheme,
}, testInfo) => {
  phoneOnly(testInfo);
  test.setTimeout(120_000);
  const project = { baseURL, colorScheme };
  const neverOpens = async (page: Page, path = '/'): Promise<void> => {
    await page.goto(path);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    const target = await page.evaluate(() => {
      const card = document.getElementById('bk-hero')?.parentElement as HTMLElement;
      return card.getBoundingClientRect().bottom + window.scrollY;
    });
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), target);
    await page.waitForTimeout(2000);
    await expect(page.locator(NOTICE)).toHaveAttribute('data-light-notice', 'closed');
    await expect(page.locator(STATUS)).toHaveText('');
  };
  const cases: Array<[string, () => Promise<BrowserContext>, string?]> = [
    ['reduced motion', () => phoneContext(browser, project, { reducedMotion: 'reduce' })],
    [
      'Save-Data',
      async () => {
        const context = await phoneContext(browser, project);
        await context.addInitScript(() =>
          Object.defineProperty(Navigator.prototype, 'connection', {
            get: () => ({ saveData: true }),
            configurable: true,
          }),
        );
        return context;
      },
    ],
    ['?tier=0', () => phoneContext(browser, project), '/?tier=0'],
    [
      'a fine pointer with 2 GB',
      async () => {
        const context = await phoneContext(browser, project, { ...VIEWPORTS.desktop });
        await weakPhone(context);
        return context;
      },
    ],
  ];
  for (const [label, make, path] of cases) {
    await test.step(label, async () => {
      const context = await make();
      await neverOpens(await context.newPage(), path);
      await context.close();
    });
  }
  await test.step('a phone without WebGL 2', async () => {
    const noWebgl2 = await chromium.launch(noWebgl2Launch());
    try {
      const context = await phoneContext(noWebgl2, project);
      // --disable-webgl2 leaves the probe worker's OffscreenCanvas a (software) WebGL 2 context in
      // this Chromium, which reads as 'software-renderer'; a phone without WebGL 2 has none, and
      // without OffscreenCanvas the probe asks the main thread.
      await context.addInitScript(() => Reflect.deleteProperty(window, 'OffscreenCanvas'));
      const page = await context.newPage();
      await neverOpens(page);
      expect(await page.evaluate(() => document.documentElement.dataset.tierReason)).toBe(
        'no-webgl2',
      );
    } finally {
      await noWebgl2.close();
    }
  });
});

test('T-PH8 the light floor: the second stepped-down page view in 14 days makes the third start light, with the loaded notice', async ({
  context,
}, testInfo) => {
  phoneOnly(testInfo);
  test.setTimeout(120_000);
  await skipIntroIn(context);
  await weakPhone(context, 8);
  for (const n of [1, 2]) {
    // Each tab is a new session (its own sessionStorage, no tier cap); localStorage is shared.
    const page = await context.newPage();
    await page.goto('/?tier=1&monitor=1&debug=1');
    await hookReady(page);
    await scrollSetReady(page);
    await scrollToY(page, (await docTop(page, TRACK)) - viewportHeight(page));
    const cdp = await context.newCDPSession(page);
    await swipe(page, cdp, 200, () =>
      page.evaluate(() => (window as unknown as { __sefid: DebugHook }).__sefid.stepDown()),
    );
    await cdp.detach();
    await expect.poll(async () => (await snapshot(page)).layout.latchedAtTier).toBe(0);
    const floor = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('sefid-light') ?? 'null'),
    );
    expect(floor?.n).toBe(n);
    await page.close();
  }
  const page = await context.newPage();
  const seen = watchRequests(page);
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  expect(
    await page.evaluate(() => [
      document.documentElement.dataset.tier,
      document.documentElement.dataset.tierReason,
    ]),
  ).toEqual(['0', 'light-floor']);
  await scrollPastHeroCard(page);
  await expect(page.locator(STATUS)).toHaveText(t('home.light.loaded'), { timeout: 5000 });
  expect([...seen.engine]).toEqual([]);
  expect([...seen.benchmark]).toEqual([]);
});

test('T-PH9 a block that grows during a swipe refreshes the triggers only after the swipe (200 ms after touchEnd), and the page never jumps back', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  // ScrollTrigger measures with the window at 0 and scrolls back: every refresh calls scrollTo
  // with y 0 (a proxy for its `refresh` event, which is internal to the engine chunk).
  await page.addInitScript(() => {
    const w = window as unknown as {
      __refreshAt: number[];
      __scrolls: Array<[number, number]>;
    };
    w.__refreshAt = [];
    w.__scrolls = [];
    const scrollTo = window.scrollTo.bind(window) as (...args: unknown[]) => void;
    window.scrollTo = ((...args: unknown[]) => {
      const [a, b] = args;
      const y = typeof a === 'object' && a !== null ? (a as ScrollToOptions).top : b;
      if (y === 0 && window.scrollY > 0) w.__refreshAt.push(performance.now());
      scrollTo(...args);
    }) as typeof window.scrollTo;
    // scrollY once per frame (a forced refresh would also show as a step back).
    const sample = (now: number): void => {
      w.__scrolls.push([now, window.scrollY]);
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.goto('/?tier=1');
  await scrollSetReady(page);
  await scrollToY(page, 600);
  const cdp = await page.context().newCDPSession(page);
  const swipeStart = await page.evaluate(() => performance.now());
  // No hold: the finger lifts on its last move, so the scroll ends at `touchEnd` (or later, with
  // a fling) and ScrollTrigger's scrollEnd comes 200 ms after it at the earliest.
  await swipe(
    page,
    cdp,
    300,
    () =>
      page.evaluate(() => {
        const block = document.createElement('div');
        block.setAttribute('data-test-block', '');
        block.style.height = '200px';
        document.querySelector('[data-scene="services"]')?.before(block);
      }),
    0,
  );
  await cdp.detach();
  const touchEnd = await page.evaluate(() => performance.now());
  await page.waitForTimeout(1500);
  const { refreshAt, scrolls } = await page.evaluate(() => {
    const w = window as unknown as { __refreshAt: number[]; __scrolls: Array<[number, number]> };
    return { refreshAt: w.__refreshAt, scrolls: w.__scrolls };
  });
  const during = scrolls.filter(([at]) => at >= swipeStart && at <= touchEnd).map(([, y]) => y);
  for (let i = 1; i < during.length; i += 1) {
    expect(during[i], 'scrollY during the swipe').toBeGreaterThanOrEqual(during[i - 1] as number);
  }
  expect(
    refreshAt.filter((at) => at >= swipeStart),
    'a refresh followed the growth',
  ).not.toEqual([]);
  for (const at of refreshAt.filter((time) => time >= swipeStart)) {
    expect(at - touchEnd).toBeGreaterThanOrEqual(200);
  }
});

test('T-PH10 a touch tablet at ?tier=1 runs the scroll set; the full-bleed hero photo has no transform (Drift is 0 from 744 px)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'tablet-light');
  await page.goto('/?tier=1');
  await scrollSetReady(page, [IMG]);
  for (const y of [0, 300, 700]) {
    await scrollToY(page, y);
    expect((await look(page, IMG)).identity, `the img at ${y}`).toBe(true);
    expect((await look(page, PHOTO)).identity).toBe(true);
  }
});

test('T-PH11 the services row on card 3 keeps its scrollLeft while the page swipes through the Slide range', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  await page.goto('/?tier=1');
  await scrollSetReady(page);
  const height = viewportHeight(page);
  const bar = await barPx(page);
  const top = await docTop(page, TRACK);
  await scrollToY(page, top - height);
  const before = await page.locator(TRACK).evaluate(async (row) => {
    const card = row.children[2] as HTMLElement;
    const r = card.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    row.scrollBy({ left: r.left + r.width / 2 - (box.left + box.width / 2), behavior: 'instant' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    return row.scrollLeft;
  });
  expect(Math.abs(before)).toBeGreaterThan(0);
  expect(await scrollThrough(page, 1, { drive: 'touch', endY: top - height * 0.5 })).toBe(true);
  expect(await scrollThrough(page, -1, { drive: 'touch', endY: top - (height - bar) - 200 })).toBe(
    true,
  );
  const after = await page.locator(TRACK).evaluate((row) => row.scrollLeft);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

test('T-PH12 the idle ticker: with the debug flag a phone runs the DOM monitor, which samples only while the page scrolls; its frame loop and the tick subscribers are 0 at rest', async ({
  page,
}, testInfo) => {
  phoneOnly(testInfo);
  const canvas: string[] = [];
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    const body = await response.text().catch(() => '');
    if (body.includes('WebGLRenderer')) canvas.push(response.url());
  });
  await page.goto('/?tier=1&monitor=1&debug=1');
  await hookReady(page);
  await page.waitForTimeout(1500);
  expect(canvas, 'no canvas chunk on a phone, debug flag or not (D5)').toEqual([]);
  expect((await snapshot(page)).tickSubscribers).toBe(0);
  const before = (await snapshot(page)).monitor.windows;
  const cdp = await page.context().newCDPSession(page);
  await swipe(page, cdp, 300);
  await swipe(page, cdp, 300);
  await cdp.detach();
  expect(
    (await snapshot(page)).monitor.windows,
    'the monitor samples while the page scrolls (a canvas would have replaced it)',
  ).toBeGreaterThan(before);
  await page.waitForTimeout(1000);
  await expect.poll(async () => (await snapshot(page)).tickSubscribers, { timeout: 1000 }).toBe(0);
  // Its frame loop stops with the scroll: no frame runs and no window is sampled at rest. The
  // windows alone cannot see a loop that never stops (a still page samples nothing).
  const atRest = (await snapshot(page)).monitor;
  expect(atRest.frames).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  const later = (await snapshot(page)).monitor;
  expect(later.frames, 'no monitor frame at rest').toBe(atRest.frames);
  expect(later.windows).toBe(atRest.windows);
});
