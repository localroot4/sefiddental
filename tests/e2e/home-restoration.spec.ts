// Scene 4, the restoration levels (phase 7 report D16, C18; lane RESTORATION): at tiers 2 and 3
// from 1024 px the section is pinned for one viewport and the scroll selects the step (معمولی,
// VIP, CIP at thirds) without a `tier_select`; a user choice sends one and scrolls to its step;
// arrow keys move the step with the chip in view; on phones and at tier 1 the tap control
// crossfades the molar with no pin, and on phones the molar settles and the chip row and the panel
// rise as they enter (phone spec scene 4). Fast back-scroll and a resize mid-pin leave the layers
// where a fresh load puts them.
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { recordBeacons } from '../helpers/booking';
import { skipIntro } from '../helpers/intro';

const BOOK = 'رزرو نوبت';
const STEPS = ['standard', 'vip', 'cip'] as const;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

const scene = (page: Page) => page.locator('[data-scene="restoration"]');

/** Two animation frames: ScrollTrigger has seen the scroll. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await frames(page);
}

/**
 * The pin's scroll range once the engine scrubs it: the sticky section's top under the nav (the
 * room's top less the section); `distance` is the room after the section, the pin's own length
 * (D7: one viewport).
 */
async function pinRange(page: Page): Promise<{ start: number; end: number; distance: number }> {
  await page.waitForFunction(() => performance.getEntriesByName('sefid:engine-init').length > 0);
  const room = scene(page).locator(':scope > [data-pin-room]');
  await expect(room).toBeVisible();
  return room.evaluate((el) => {
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
    const section = (el.previousElementSibling as HTMLElement).offsetHeight;
    const start = el.getBoundingClientRect().top + window.scrollY - navH - section;
    return { start, end: start + window.innerHeight, distance: el.getBoundingClientRect().height };
  });
}

/** The middle of a step's third (the scene's stepScrollY). */
const stepY = (range: { start: number; end: number }, step: number) =>
  range.start + ((range.end - range.start) * (step + 0.5)) / STEPS.length;

const checkedKey = (page: Page) =>
  page.evaluate(
    () =>
      document.querySelector<HTMLInputElement>('[data-scene="restoration"] input:checked')?.value ??
      null,
  );

/** The one «رزرو نوبت» shown (other panels: display none, or invisible when pinned). */
async function visibleCtaHref(page: Page): Promise<string> {
  const cta = scene(page).getByRole('link', { name: BOOK, exact: true });
  await expect(cta).toHaveCount(1);
  return decodeURI((await cta.getAttribute('href')) ?? '');
}

interface LayerState {
  opacity: number[];
  /** matrix(a, b, c, d, e, f) entries per layer; [] for `none`. */
  transform: number[][];
  sectionTop: number;
}

const layerState = (page: Page): Promise<LayerState> =>
  page.evaluate(() => {
    const layers = [...document.querySelectorAll<SVGSVGElement>('[data-level]')];
    const parse = (value: string) =>
      value === 'none' ? [] : (value.match(/-?[\d.]+/g) ?? []).map(Number);
    return {
      opacity: layers.map((el) => Number(getComputedStyle(el).opacity)),
      transform: layers.map((el) => parse(getComputedStyle(el).transform)),
      sectionTop:
        document.querySelector('[data-scene="restoration"] > section')?.getBoundingClientRect()
          .top ?? Number.NaN,
    };
  });

function expectSameState(actual: LayerState, reference: LayerState): void {
  actual.opacity.forEach((o, i) =>
    expect(Math.abs(o - (reference.opacity[i] ?? -1))).toBeLessThanOrEqual(0.01),
  );
  actual.transform.forEach((m, i) => {
    const ref = reference.transform[i] ?? [];
    expect(m.length).toBe(ref.length);
    m.forEach((v, j) => expect(Math.abs(v - (ref[j] ?? -1))).toBeLessThanOrEqual(0.01));
  });
  expect(Math.abs(actual.sectionTop - reference.sectionTop)).toBeLessThanOrEqual(1);
}

/** The `location` of every tier_select beacon (the tier itself is a GA4-only param). */
const tierSelects = async (beacons: () => Promise<string[]>) =>
  (await beacons())
    .map((body) => JSON.parse(body) as { event: string; location?: string })
    .filter((b) => b.event === 'tier_select')
    .map((b) => b.location);

/** `rect` of a locator is inside the viewport. */
async function expectInView(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const height = page.viewportSize()?.height ?? 0;
  expect(box).not.toBeNull();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
}

test.beforeEach(({ page }) => skipIntro(page));

test('T-RS1 ?tier=2 at 1440: the pin selects معمولی, VIP, CIP in order with the CTA, sends no tier_select, and holds after a fast back-scroll and a resize (C18)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const beacons = await recordBeacons(page);
  await page.goto('/?tier=2');
  await page.evaluate(() => document.fonts.ready);
  const range = await pinRange(page);
  expect(Math.abs(range.distance - 900)).toBeLessThanOrEqual(1);

  expect(await checkedKey(page)).toBeNull();
  for (const [i, key] of STEPS.entries()) {
    await scrollTo(page, stepY(range, i));
    await expect.poll(() => checkedKey(page)).toBe(key);
    expect(await visibleCtaHref(page)).toBe(`/رزرو-نوبت?service=restoration&tier=${key}`);
  }
  // Back above the pin: no step preselected (F24 outside the pin).
  await scrollTo(page, range.start - 200);
  await expect.poll(() => checkedKey(page)).toBeNull();
  expect(await visibleCtaHref(page)).toBe('/رزرو-نوبت?service=restoration');
  expect(await tierSelects(beacons)).toEqual([]);

  // Mid-crossfade (a third): the layers are half way, the section pinned under the header.
  const mid = range.start + (range.end - range.start) / 3;
  await scrollTo(page, mid);
  const reference = await layerState(page);
  expect(reference.opacity[0]).toBeGreaterThan(0.3);
  expect(reference.opacity[0]).toBeLessThan(0.7);
  expect(reference.opacity[1]).toBeGreaterThan(0.3);
  await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
  await scrollTo(page, 0);
  await scrollTo(page, mid);
  expectSameState(await layerState(page), reference);

  // A resize at the midpoint, then the same scroll on a fresh load at the new width.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(async () => (await pinRange(page)).start).not.toBe(range.start);
  const resized = await pinRange(page);
  const resizedMid = resized.start + (resized.end - resized.start) / 3;
  await scrollTo(page, resizedMid);
  const afterResize = await layerState(page);

  await page.goto('/?tier=2');
  await page.evaluate(() => document.fonts.ready);
  const fresh = await pinRange(page);
  expect(Math.abs(fresh.start - resized.start)).toBeLessThanOrEqual(1);
  await scrollTo(page, resizedMid);
  expectSameState(afterResize, await layerState(page));
});

test('T-RS6 a chip checked before the engine keeps its layer until the scroll takes over; a chosen chip survives the layout relatch, a scrolled one is cleared', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // Hold the engine chunk (the script that carries ScrollTrigger) until a chip is checked.
  let release = (): void => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.js(\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (body.includes('ScrollTrigger')) await held;
    await route.fulfill({ response, body });
  });
  await page.goto('/?tier=2');
  await scene(page).getByRole('radio', { name: 'VIP' }).check();
  await scrollTo(page, 0);
  expect(await page.evaluate(() => performance.getEntriesByName('sefid:engine-init').length)).toBe(
    0,
  );
  release();
  const range = await pinRange(page);
  await page.unroute(/\.js(\?|$)/);
  // Above the pin the engine seeds the chosen layer; the first third hands the layers to the scroll.
  expect(await checkedKey(page)).toBe('vip');
  expect((await layerState(page)).opacity).toEqual([0, 1, 0]);
  await scrollTo(page, range.start + 10);
  await expect.poll(() => checkedKey(page)).toBe('standard');
  expect((await layerState(page)).opacity).toEqual([1, 0, 0]);

  // A choice, then the layout relatch under 1024 px (no pin): the chosen chip stays.
  await scene(page).getByRole('radio', { name: 'CIP' }).check();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(stepY(range, 2) - 2);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(scene(page).locator(':scope > [data-pin-room]')).toBeHidden();
  await expect(page.locator('[data-world-slot="molar"][data-motion]')).toHaveCount(1);
  expect(await checkedKey(page)).toBe('cip');

  // A chip the scroll checked is cleared by the same relatch (F24 without a pin).
  await page.setViewportSize({ width: 1440, height: 900 });
  const wide = await pinRange(page);
  await scrollTo(page, stepY(wide, 1));
  await expect.poll(() => checkedKey(page)).toBe('vip');
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(scene(page).locator(':scope > [data-pin-room]')).toBeHidden();
  await expect.poll(() => checkedKey(page)).toBeNull();
});

test('T-RS2 a chip click inside the pin sends tier_select once and scrolls to that step', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const beacons = await recordBeacons(page);
  await page.goto('/?tier=2');
  const range = await pinRange(page);
  await scrollTo(page, range.start + 10);
  await expect.poll(() => checkedKey(page)).toBe('standard');
  expect(await tierSelects(beacons)).toEqual([]);

  await scene(page).getByRole('radio', { name: 'VIP' }).check();
  await expect.poll(() => tierSelects(beacons)).toEqual(['tier']);
  const target = stepY(range, 1);
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(target - 2);
  await page.waitForTimeout(300);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - target)).toBeLessThanOrEqual(2);
  expect(await checkedKey(page)).toBe('vip');
  expect(await visibleCtaHref(page)).toBe('/رزرو-نوبت?service=restoration&tier=vip');
  expect(await tierSelects(beacons)).toEqual(['tier']);
});

test('T-RS3 arrow keys move the step, scroll to it and keep the focused chip in view', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const beacons = await recordBeacons(page);
  await page.goto('/?tier=2');
  const range = await pinRange(page);
  await scrollTo(page, range.start + 10);
  await expect.poll(() => checkedKey(page)).toBe('standard');
  const radios = scene(page).getByRole('radio');
  await radios.nth(0).focus();

  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeChecked();
  await expect(radios.nth(1)).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(stepY(range, 1) - 2);
  await expectInView(page, radios.nth(1));
  expect(await checkedKey(page)).toBe('vip');

  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(2)).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(stepY(range, 2) - 2);
  await expectInView(page, radios.nth(2));

  await page.keyboard.press('ArrowUp');
  await expect(radios.nth(1)).toBeChecked();
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeLessThan(stepY(range, 1) + 2);
  await page.waitForTimeout(300);
  await expectInView(page, radios.nth(1));
  expect(await checkedKey(page)).toBe('vip');
  expect(await visibleCtaHref(page)).toBe('/رزرو-نوبت?service=restoration&tier=vip');
  expect(await tierSelects(beacons)).toEqual(['tier', 'tier', 'tier']);
});

test('T-RS8 arrow keys and then a fast Tab out of the pin keep every focused element in view', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const range = await pinRange(page);
  await scrollTo(page, range.start + 10);
  await scene(page).getByRole('radio').nth(0).focus();
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el) throw new Error('no focus');
      const r = el.getBoundingClientRect();
      return {
        inView: r.top >= 0 && r.bottom <= window.innerHeight,
        top: Math.round(r.top),
        scene: el.closest('[data-scene]')?.getAttribute('data-scene') ?? null,
      };
    });
  // 150 ms per key: the step's scroll from the choice before still runs at the next Tab.
  for (const key of ['ArrowDown', 'ArrowDown', 'Tab', 'Tab', 'Tab']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(150);
    const now = await focused();
    expect(now.inView, `${key} ${JSON.stringify(now)}`).toBe(true);
  }
  // The third Tab left the scene.
  expect((await focused()).scene).not.toBe('restoration');
  await page.waitForTimeout(1500);
  const settled = await focused();
  expect(settled.inView, JSON.stringify(settled)).toBe(true);
});

/** The scroll position and the checked chip have not changed for 500 ms. */
const calm = (page: Page) =>
  page.waitForFunction(
    () => {
      const w = window as unknown as { __calm?: { key: string; since: number } };
      const chips = [...document.querySelectorAll<HTMLInputElement>('input[name="home-tier"]')];
      const key = `${Math.round(window.scrollY)} ${chips.map((c) => Number(c.checked)).join('')}`;
      const now = performance.now();
      if (w.__calm?.key !== key) w.__calm = { key, since: now };
      return now - w.__calm.since >= 500;
    },
    null,
    { polling: 50 },
  );

test('T-RS9 the chips are one Tab stop at tiers 0, 1 and 2, whatever the scroll checks while one has the focus (F5)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const tier of [0, 1, 2]) {
    await page.goto(`/?tier=${tier}`);
    await page.waitForLoadState('load');
    if (tier > 0) {
      await page.waitForFunction(
        () => performance.getEntriesByName('sefid:engine-init').length > 0,
      );
    }
    // From «همهٔ خدمات», the stop before the scene: Tab walks into the chips and out again.
    await page.locator('[data-scene="services"] a').last().focus();
    await calm(page);
    const stops: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      await page.keyboard.press('Tab');
      // The focus scroll and the scrub it moves settle before the next Tab (the close probe found
      // the second stop, standard then VIP, at a calm pace).
      await calm(page);
      stops.push(
        await page.evaluate(() => {
          const el = document.activeElement as HTMLInputElement | null;
          return el?.name === 'home-tier' ? `radio ${el.value}` : (el?.tagName ?? 'none');
        }),
      );
    }
    const radios = stops.filter((stop) => stop.startsWith('radio'));
    expect(radios, `tier ${tier}: ${stops.join(' → ')}`).toHaveLength(1);
  }
});

/** The scrub lag on a coarse pointer (0.32 s) and the settle window, with margin (home-phone). */
const SCRUB_WAIT_MS = 700;

/** Document top (the offset chain, transforms ignored), opacity, and an identity transform. */
const look = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    let top = 0;
    for (let e = el as HTMLElement | null; e; e = e.offsetParent as HTMLElement | null) {
      top += e.offsetTop;
    }
    const style = getComputedStyle(el);
    return {
      top,
      opacity: Number(style.opacity),
      identity: style.transform === 'none' || new DOMMatrixReadOnly(style.transform).isIdentity,
    };
  });

test.describe('390 px touch', () => {
  test('T-RS4 ?tier=3 on a phone: no pin and no step from the scroll; the molar settles and the chip row and the panel rise to rest at their reading lines; a tap on a 44 px chip crossfades the molar, tier_select once', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light');
    const beacons = await recordBeacons(page);
    await page.goto('/?tier=3');
    await expect(page.locator('html')).toHaveAttribute('data-tier', '3');
    // Under 1024 px the scene sets up when it comes within two viewports (phone spec 1.4).
    const height = page.viewportSize()?.height ?? 844;
    const top = await scene(page).evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
    await scrollTo(page, top - height * 1.5);
    // The scene ran (no pin on a phone): it switched the CSS crossfade on.
    await expect(page.locator('[data-world-slot="molar"][data-motion]')).toHaveCount(1);
    await expect(scene(page).locator(':scope > [data-pin-room]')).toBeHidden();

    // Settle on the molar (reading line 60 %), Rise on the chip row and the shown panel (80 %),
    // one trigger each (phone spec 2.1): dim at the bar top, at rest at the reading line.
    const bar = await page.evaluate(
      () => document.querySelector<HTMLElement>('[data-sticky-bar]')?.offsetHeight ?? 0,
    );
    const scrub = async (y: number) => {
      await scrollTo(page, Math.round(y));
      await page.waitForTimeout(SCRUB_WAIT_MS);
    };
    for (const [selector, line] of [
      ['[data-world-slot="molar"]', 0.6],
      ['[data-scene="restoration"] fieldset', 0.8],
      ['[data-scene="restoration"] [data-tier-panel=""]', 0.8],
    ] as const) {
      await expect(page.locator(`${selector}[data-scrub]`)).toHaveCount(1);
      const atBar = (await look(page, selector)).top - (height - bar);
      await scrub(atBar);
      const start = await look(page, selector);
      expect(start.opacity, `${selector} at the bar top`).toBeLessThanOrEqual(0.61);
      await scrub(atBar + (height - bar - height * line) / 2);
      expect((await look(page, selector)).opacity).toBeGreaterThan(start.opacity);
      await scrub(start.top - height * line + 4);
      expect(await look(page, selector), `${selector} at its reading line`).toMatchObject({
        opacity: 1,
        identity: true,
      });
    }
    // The hidden panels got no entrance, and the scroll checked no step.
    await expect(scene(page).locator('[data-tier-panel][data-scrub]')).toHaveCount(1);
    expect(await checkedKey(page)).toBeNull();

    const section = scene(page);
    for (const chip of await section.locator('fieldset label').all()) {
      expect((await chip.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    await section.getByRole('radio', { name: 'VIP' }).tap();
    await expect(section.locator('[data-tier-panel="vip"]')).toBeVisible();
    expect(await visibleCtaHref(page)).toBe('/رزرو-نوبت?service=restoration&tier=vip');
    const opacity = (level: string) =>
      page.evaluate(
        (l) => Number(getComputedStyle(document.querySelector(`[data-level="${l}"]`)!).opacity),
        level,
      );
    await expect.poll(() => opacity('vip')).toBe(1);
    await expect.poll(() => opacity('plain')).toBe(0);
    await expect(section.locator('[data-level="vip"]')).toHaveCSS('transform', 'none');
    expect(await tierSelects(beacons)).toEqual(['tier']);
  });
});

test('T-RS5 ?tier=1 at 1440: no pin; a choice crossfades the molar through CSS', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=1');
  await expect(page.locator('[data-world-slot="molar"][data-motion]')).toHaveCount(1);
  await expect(scene(page).locator(':scope > [data-pin-room]')).toBeHidden();
  const cip = scene(page).locator('[data-level="cip"]');
  await expect(cip).toHaveCSS('opacity', '0');
  await scene(page).getByRole('radio', { name: 'CIP' }).check();
  await expect(cip).toHaveCSS('opacity', '1');
  await expect(cip).toHaveCSS('transform', 'none');
  expect(await visibleCtaHref(page)).toBe('/رزرو-نوبت?service=restoration&tier=cip');
});

test('T-RS7 ?tier=2 at 1024x768: the pinned stage fits the viewport (molar stacked at 8rem, chips on one row, CTA and compare link in view)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/?tier=2');
  await page.evaluate(() => document.fonts.ready);
  const range = await pinRange(page);
  // Every step: the stacked panels keep one stage height, so each fits under the nav.
  for (const [step, key] of STEPS.entries()) {
    await scrollTo(page, stepY(range, step));
    await expect.poll(() => checkedKey(page)).toBe(key);
    const slot = scene(page).locator('[data-world-slot="molar"]');
    expect((await slot.boundingBox())?.width).toBeCloseTo(128, 0);
    const chips = await scene(page).locator('fieldset label').all();
    const tops = await Promise.all(chips.map(async (c) => (await c.boundingBox())?.y ?? -1));
    expect(new Set(tops.map(Math.round)).size).toBe(1);
    await expectInView(page, scene(page).getByRole('link', { name: BOOK, exact: true }));
    // The compare link closes the section, and the sticky section ends inside the viewport.
    await expectInView(page, scene(page).getByRole('link').last());
    const stage = await scene(page).locator(':scope > section').boundingBox();
    expect((stage?.y ?? 0) + (stage?.height ?? Infinity), key).toBeLessThanOrEqual(768);
  }
});

test('T-RS11 ?tier=2 at 1440x900 and 1024x768: the «رزرو نوبت» keeps its own height before a choice and in every step (the stacked panels never stretch it)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/?tier=2');
    await page.evaluate(() => document.fonts.ready);
    const range = await pinRange(page);
    await expect(page.locator('html[data-pins]')).toHaveCount(1);
    const cta = scene(page).getByRole('link', { name: BOOK, exact: true });
    // Before a choice (above the pin), then each step's third.
    for (const [y, key] of [
      [range.start - 200, null],
      ...STEPS.map((k, step) => [stepY(range, step), k] as const),
    ] as const) {
      await scrollTo(page, y);
      await expect.poll(() => checkedKey(page)).toBe(key);
      const box = await cta.boundingBox();
      expect(box?.height, `${width}x${height} ${key ?? 'no choice'}`).toBeLessThan(60);
    }
  }
});

test("T-RS10 ?tier=2: Tab after the chosen chip lands on that step's visible «رزرو نوبت» (the stacked panels hide the rest from the keyboard)", async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const range = await pinRange(page);
  await scrollTo(page, stepY(range, 1));
  await expect.poll(() => checkedKey(page)).toBe('vip');
  await scene(page).getByRole('radio', { name: 'VIP' }).focus();
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('href', /tier=vip/);
  await expect(focused).toBeVisible();
  await expectInView(page, focused);
});
