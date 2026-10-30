// The home scroll engine (phase 7 report, plan section 3; lane ENGINE): one label per scene,
// teardown on a route change, keep-place across a relatch (reduced motion, «کیفیت», rotation),
// no pins or Lenis on touch phones, `scene_view` once per scene, the booking route through the
// engine while Lenis runs. Every row reads `window.__sefid.snapshot()` (`?debug=1`).
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import { formsHydrated, recordBeacons } from '../helpers/booking';
import { watchConsoleErrors } from '../helpers/console';
import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

interface Snapshot {
  tier: number;
  layout: { pinnedScenes: boolean; lenis: boolean; latchedAtTier: number };
  lenis: boolean;
  scrollTriggers: number;
  progress: number;
  scene: string | null;
  sceneProgress: number;
  labels: string[];
  engineInitMs: number | null;
  tickSubscribers: number;
  draggables: number;
}

type Hook = { snapshot(): Snapshot; setUserOverride(o: number | 'auto'): void };

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = (window as unknown as { __sefid?: Hook }).__sefid;
    if (!h) throw new Error('window.__sefid is not installed');
    return h.snapshot();
  });
}

/** The debug hook is installed and the engine has measured its labels. */
async function engineReady(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => {
    const h = (window as unknown as { __sefid?: Hook }).__sefid;
    return h !== undefined && h.snapshot().labels.length > 0;
  });
}

/** Document-order ids of the `[data-scene]` elements on the page. */
const sceneIds = (page: Page) =>
  page.locator('[data-scene]').evaluateAll((els) => els.map((el) => el.getAttribute('data-scene')));

/** Two animation frames: ScrollTrigger and the overlay have seen the scroll. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

async function scrollIntoScene(page: Page, id: string): Promise<void> {
  await page.evaluate((scene) => {
    const el = document.querySelector(`[data-scene="${scene}"]`);
    if (!el) throw new Error(`no [data-scene="${scene}"]`);
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY + 200,
      behavior: 'instant',
    });
  }, id);
  await frames(page);
}

/** The innermost `[data-home-section]` under the viewport's middle line. */
const sectionUnderMiddle = (page: Page) =>
  page.evaluate(() => {
    const y = window.innerHeight / 2;
    let found: string | null = null;
    for (const el of document.querySelectorAll('[data-home-section]')) {
      const r = el.getBoundingClientRect();
      if (r.top <= y && r.bottom > y) found = el.getAttribute('data-home-section');
    }
    return found;
  });

/** T-EN3's list: what a tier-0 page must look like after the engine went away. */
async function expectTierZeroPage(page: Page): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
  await expect.poll(async () => (await snapshot(page)).scrollTriggers).toBe(0);
  const snap = await snapshot(page);
  expect(snap.tickSubscribers).toBe(0);
  expect(snap.lenis).toBe(false);
  await expect(page.locator('html[data-pins]')).toHaveCount(0);
  await expect(page.locator('[data-reveal]')).toHaveCount(0);
  await expect(page.locator('html.lenis')).toHaveCount(0);
  const leftovers = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-experience-root] *')) {
      if (el.closest('[data-dev-overlay]')) continue;
      if (el.style.getPropertyValue('--warm') !== '') out.push(`--warm on ${el.tagName}`);
      if (el.style.willChange !== '') out.push(`will-change on ${el.tagName}`);
      const transform = getComputedStyle(el).transform;
      // The compare slider (the box around its range input) owns a transform of tier 0, and the
      // molar's hidden layers keep their CSS scale (MolarStepper.tsx); an inline one is a leftover.
      const restScale = el.matches('[data-level]') && el.style.transform === '';
      if (transform !== 'none' && !restScale && !el.closest('div:has(> input[type="range"])'))
        out.push(`${el.tagName}.${el.className} transform ${transform}`);
    }
    return out;
  });
  expect(leftovers).toEqual([]);
}

/** clsAll of a reload or a deep link at desktop tier 2 (gate 0.05, target 0). */
const CLS_TARGET = 0.001;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(({ page }) => skipIntro(page));

test('T-EN1 one label per present scene in document order; progress is monotonic on a scroll', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  const snap = await snapshot(page);
  expect(snap.labels).toEqual(await sceneIds(page));
  expect(snap.engineInitMs).not.toBeNull();
  testInfo.annotations.push({ type: 'engineInitMs', description: String(snap.engineInitMs) });
  console.log(`T-EN1 engineInitMs: ${snap.engineInitMs}`);

  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let last = { progress: -1, scene: null as string | null, sceneProgress: -1 };
  const steps = Array.from({ length: 25 }, (_, i) => Math.round((max * i) / 24));
  for (const y of steps) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await frames(page);
    const s = await snapshot(page);
    expect(s.progress, `progress at ${y}`).toBeGreaterThanOrEqual(last.progress);
    if (s.scene === last.scene) {
      expect(s.sceneProgress, `scene progress at ${y}`).toBeGreaterThanOrEqual(last.sceneProgress);
    }
    expect(s.scene === null || snap.labels.includes(s.scene)).toBe(true);
    last = { progress: s.progress, scene: s.scene, sceneProgress: s.sceneProgress };
  }
  expect(last.progress).toBe(1);
});

test('T-EN2 a route change tears the engine down: a soft navigation away and back equals a fresh load', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  // Every site link is a document load except the header's home link (next/link): the soft
  // route changes of this site are content page -> home, back and forward. The tier comes from
  // the saved «کیفیت» choice and the debug flag from the session, so `/` matches `/?tier=2`.
  await page.addInitScript(() => {
    localStorage.setItem('sefid-quality', '2');
    sessionStorage.setItem('sefid-debug', '1');
  });
  const errors = watchConsoleErrors(page);
  await page.goto('/');
  await engineReady(page);
  await scrollIntoScene(page, 'services');
  // Steady state: Lenis (a fine pointer) has joined the ticker.
  await expect.poll(async () => (await snapshot(page)).lenis).toBe(true);
  await page.waitForTimeout(200);
  const fresh = await snapshot(page);
  expect(fresh.scrollTriggers).toBeGreaterThan(0);
  expect(fresh.tickSubscribers).toBeGreaterThan(0);

  await page.goto('/خدمات');
  await page.waitForLoadState('load');
  await page.locator('header a[href="/"]').first().click();
  await page.waitForURL((url) => url.pathname === '/');
  await engineReady(page);
  await scrollIntoScene(page, 'services');

  await page.goBack();
  await page.waitForURL((url) => url.pathname === encodeURI('/خدمات'));
  await expect(page.locator('html.lenis')).toHaveCount(0);
  await expect(page.locator('html[data-pins]')).toHaveCount(0);
  await expect(page.locator('[data-reveal]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => '__sefid' in window)).toBe(false);

  await page.goForward();
  await page.waitForURL((url) => url.pathname === '/');
  await engineReady(page);
  await scrollIntoScene(page, 'services');
  // Lenis and the ticker monitor join the engine a frame or two after it: the counts settle
  // upwards to the fresh load's; a leak from the first engine would keep them above it.
  await expect
    .poll(async () => {
      const after = await snapshot(page);
      return {
        scrollTriggers: after.scrollTriggers,
        tickSubscribers: after.tickSubscribers,
        draggables: after.draggables,
      };
    })
    .toEqual({
      scrollTriggers: fresh.scrollTriggers,
      tickSubscribers: fresh.tickSubscribers,
      draggables: fresh.draggables,
    });
  // The events counter allows 60 beacons a minute per client; the parallel specs share one
  // localhost client, so its 429 answers (a lost beacon is silent by design) are not engine errors.
  expect(errors().filter((line) => !line.includes('/api/events'))).toEqual([]);
});

test('T-EN3 reduced motion toggled mid-scene gives the tier-0 page and keeps the reader in place', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  await scrollIntoScene(page, 'services');
  const before = await sectionUnderMiddle(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expectTierZeroPage(page);
  expect(await sectionUnderMiddle(page)).toBe(before);
});

test('T-EN4 a «کیفیت» change mid-scroll keeps the reader at the footer; 0 gives the tier-0 page', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  // A `?tier=` query outranks the saved «کیفیت» choice (qualityTier precedence), so the tier
  // comes from the saved choice here, as it does for a real reader.
  await page.addInitScript(() => localStorage.setItem('sefid-quality', '2'));
  await page.goto('/?debug=1');
  await engineReady(page);
  await expect(page.locator('html')).toHaveAttribute('data-tier', '2');
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await frames(page);
  const before = await sectionUnderMiddle(page);
  await page.evaluate(() => (window as unknown as { __sefid?: Hook }).__sefid?.setUserOverride(0));
  await expectTierZeroPage(page);
  expect(await sectionUnderMiddle(page)).toBe(before);
  expect(await page.evaluate(() => localStorage.getItem('sefid-quality'))).toBe('0');
});

test('T-EN4b a «کیفیت» change from 1 to 3 (the pins arrive) keeps the reader at the booking block', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.addInitScript(() => localStorage.setItem('sefid-quality', '1'));
  await page.goto('/?debug=1');
  await engineReady(page);
  expect((await snapshot(page)).layout).toMatchObject({ pinnedScenes: false, latchedAtTier: 1 });
  await scrollIntoScene(page, 'booking');
  const before = await sectionUnderMiddle(page);
  expect(before).toBe('booking');
  await page.evaluate(() => (window as unknown as { __sefid?: Hook }).__sefid?.setUserOverride(3));
  await expect
    .poll(async () => (await snapshot(page)).layout)
    .toMatchObject({
      pinnedScenes: true,
      latchedAtTier: 3,
    });
  // The new engine, then the refresh its pins queue, then the place it applies from the spacers.
  await engineReady(page);
  await frames(page);
  await frames(page);
  expect(await sectionUnderMiddle(page)).toBe(before);
});

/** The engine of this page load exists (every scene's pin and setup ran in its creation task). */
const engineCreated = (page: Page) =>
  page.waitForFunction(() => performance.getEntriesByName('sefid:engine-init').length > 0);

/** From the next navigation on: every layout shift of the page, input or not (clsAll). */
const recordShifts = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __shifts: number[] };
    w.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        w.__shifts.push((entry as PerformanceEntry & { value: number }).value);
    }).observe({ type: 'layout-shift', buffered: true });
  });
const shifts = (page: Page) =>
  page.evaluate(() => (window as unknown as { __shifts: number[] }).__shifts);
const clsAll = async (page: Page) => (await shifts(page)).reduce((sum, v) => sum + v, 0);

test('T-EN4c a reload at voices (tier 2, after every pin) keeps the reader there with no layout shift', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?tier=2');
  await engineCreated(page);
  // The voices top at the viewport top, where an in-page link or the engine's scrollTo puts it.
  const voicesTop = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-scene="voices"]');
      if (!el) throw new Error('no [data-scene="voices"]');
      return Math.round(el.getBoundingClientRect().top);
    });
  await page.evaluate((top) => window.scrollBy({ top, behavior: 'instant' }), await voicesTop());
  await frames(page);
  expect(Math.abs(await voicesTop())).toBe(0); // Math.round of a fraction above can read -0
  await recordShifts(page);
  await page.reload();
  await engineCreated(page);
  await frames(page);
  await frames(page);
  // The inline latch pinned the document Chrome restores the scroll into: nothing moves after.
  expect(await shifts(page)).toEqual([]);
  expect(Math.abs(await voicesTop())).toBeLessThanOrEqual(2);
});

/**
 * A pin's document range: the sticky stage's top under the nav (the room's top less the stage)
 * through its room (`PinRoom`, the stage's next sibling).
 */
const pinRange = (page: Page, scene: string) =>
  page.evaluate((id) => {
    const room = document.querySelector(`[data-scene="${id}"] [data-pin-room]`);
    const stage = room?.previousElementSibling;
    if (!room || !(stage instanceof HTMLElement)) throw new Error(`no pin in [data-scene="${id}"]`);
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
    const { top, height } = room.getBoundingClientRect();
    return { start: top + window.scrollY - navH - stage.offsetHeight, length: height };
  }, scene);

test('T-EN4d a reload inside each pin (tier 2) lands at the same progress of that pin', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  const pinPlace = async (scene: string) => {
    const { start, length } = await pinRange(page, scene);
    const y = await page.evaluate(() => window.scrollY);
    return { length, progress: (y - start) / length };
  };
  await page.goto('/?tier=2');
  await engineCreated(page);
  for (const scene of ['services', 'restoration', 'workflow']) {
    const range = await pinRange(page, scene);
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: 'instant' }),
      Math.round(range.start + 0.4 * range.length),
    );
    await frames(page);
    // A step switch in restoration moves the pins after it: the progress is read after the scroll.
    const before = await pinPlace(scene);
    await page.reload();
    await engineCreated(page);
    await frames(page);
    await frames(page);
    const after = await pinPlace(scene);
    expect(Math.abs(after.progress - before.progress) * after.length, scene).toBeLessThanOrEqual(2);
  }
});

/** 0.4 of the way through a scene's own box past one viewport: inside its pin (1440x900). */
const insideScene = (page: Page, scene: string) =>
  page.evaluate((id) => {
    const el = document.querySelector<HTMLElement>(`[data-scene="${id}"]`);
    if (!el) throw new Error(`no [data-scene="${id}"]`);
    const top = el.getBoundingClientRect().top + window.scrollY;
    return Math.round(top + 0.4 * (el.offsetHeight - window.innerHeight));
  }, scene);

test('T-EN4e a reload inside each pin (tier 2) paints the pinned frame from the first frame: no layout shift, the reader stays (F2)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await recordShifts(page);
  for (const scene of ['services', 'restoration', 'workflow']) {
    await page.goto('/?tier=2');
    await engineCreated(page);
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: 'instant' }),
      await insideScene(page, scene),
    );
    await frames(page);
    const before = await page.evaluate(() => window.scrollY);
    await page.reload();
    await engineCreated(page);
    await frames(page);
    await frames(page);
    // Before the fix the frames before the engine showed the document without pins: services
    // 0.74, restoration and workflow 1.0.
    expect(await clsAll(page), scene).toBeLessThanOrEqual(CLS_TARGET);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - before),
      scene,
    ).toBeLessThanOrEqual(8);
  }
});

test('T-EN4f a deep link into or after a pin (tier 2) lands in the pinned geometry: no layout shift (F3)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await recordShifts(page);
  for (const hash of ['home-restoration-title', 'home-workflow-title']) {
    // A new document each time: a hash change alone would be a same-document navigation.
    await page.goto('about:blank');
    await page.goto(`/?tier=2#${hash}`);
    await engineCreated(page);
    await frames(page);
    await frames(page);
    // Before the fix: 1.0 for both.
    expect(await clsAll(page), hash).toBeLessThanOrEqual(CLS_TARGET);
    const top = await page.evaluate(
      (id) => document.getElementById(id)?.getBoundingClientRect().top,
      hash,
    );
    expect(top, hash).toBeGreaterThanOrEqual(0);
    expect(top, hash).toBeLessThan(900);
  }
});

const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

/**
 * Auto mode on a capable desktop. Headless Chromium renders WebGL in software, which the probe
 * reads as tier 0; here it reads a hardware renderer from a main-thread context (no
 * OffscreenCanvas: no worker probe). With `cachedTier` a returning visitor's `sefid-gpu`.
 */
const hardwareGpu = (page: Page, cachedTier: number | null) =>
  page.addInitScript(
    ([renderer, tier]) => {
      Object.defineProperty(window, 'OffscreenCanvas', { value: undefined, configurable: true });
      const read = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (this: WebGL2RenderingContext, p) {
        // UNMASKED_RENDERER_WEBGL and RENDERER
        return p === 0x9246 || p === 0x1f01 ? renderer : read.call(this, p);
      };
      if (tier === null) localStorage.removeItem('sefid-gpu');
      else {
        localStorage.setItem(
          'sefid-gpu',
          JSON.stringify({ v: '5.0.70', renderer, tier, type: 'BENCHMARK', fps: 120 }),
        );
      }
    },
    [RTX, cachedTier] as const,
  );

test('T-EN4g auto mode with a cached GPU answer (a returning visitor): a reload inside each pin shifts nothing and the reader stays (F2)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await hardwareGpu(page, 2);
  await recordShifts(page);
  for (const scene of ['services', 'restoration', 'workflow']) {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-tier', '2');
    await engineCreated(page);
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: 'instant' }),
      await insideScene(page, scene),
    );
    await frames(page);
    const before = await page.evaluate(() => window.scrollY);
    await page.reload();
    await engineCreated(page);
    await frames(page);
    await frames(page);
    // The latch pinned from the first paint: the cache decided it before the probe.
    await expect(page.locator('html[data-pins]')).toHaveCount(1);
    expect(await clsAll(page), scene).toBeLessThanOrEqual(CLS_TARGET);
    expect(
      Math.abs((await page.evaluate(() => window.scrollY)) - before),
      scene,
    ).toBeLessThanOrEqual(8);
  }
});

test('T-EN4h a first visit in auto mode whose probe answers before the engine chunk: the pins arrive under a deep link and the reader stays at voices', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await hardwareGpu(page, null);
  await recordShifts(page);
  // Hold the engine chunk (the script that carries ScrollTrigger) until the probe has answered.
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
  await page.goto('/#home-voices-title');
  const voicesTop = () =>
    page.evaluate(() =>
      Math.round(document.getElementById('home-voices-title')!.getBoundingClientRect().top),
    );
  const landed = await voicesTop();
  // No pins before the probe: the first visit has no cached answer.
  expect(await page.locator('html[data-pins]').count()).toBe(0);
  await expect(page.locator('html')).toHaveAttribute('data-tier', /[23]/, { timeout: 15_000 });
  release();
  await engineCreated(page);
  await frames(page);
  await frames(page);
  await page.unroute(/\.js(\?|$)/);
  // The pins arrived with the engine; the place was read in the document without them.
  await expect(page.locator('html[data-pins]')).toHaveCount(1);
  expect(Math.abs((await voicesTop()) - landed)).toBeLessThanOrEqual(2);
  expect(await clsAll(page)).toBeLessThanOrEqual(CLS_TARGET);
});

test.describe('375 px touch', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('T-EN5 ?tier=3 on a touch phone: no pin spacer, no Lenis, the hero photo layer untransformed', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light');
    await page.goto('/?debug=1&tier=3');
    await engineReady(page);
    const snap = await snapshot(page);
    expect(snap.tier).toBe(3);
    expect(snap.layout).toMatchObject({ pinnedScenes: false, lenis: false });
    expect(snap.lenis).toBe(false);
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    await frames(page);
    await expect(page.locator('html[data-pins]')).toHaveCount(0);
    await expect(page.locator('html.lenis')).toHaveCount(0);
    // Phone spec scene 1: the layer never moves; its img may drift inside it (phone.ts Drift).
    await expect(page.locator('[data-scene="hero"] [data-hero-photo]')).toHaveCSS(
      'transform',
      'none',
    );
  });
});

test('T-EN6 scene_view beacons: one per scene id, in order, at ?tier=0', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const beacons = await recordBeacons(page);
  await page.goto('/?tier=0');
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts.ready);
  // Expected: the scenes whose top can cross the viewport middle before the page ends.
  const expected = await page.evaluate(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    return [...document.querySelectorAll('[data-scene]')]
      .filter((el) => el.getBoundingClientRect().top + scrollY <= max + innerHeight / 2)
      .map((el) => el.getAttribute('data-scene'));
  });
  expect(expected.length).toBeGreaterThanOrEqual(8);
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  // Small steps, so no two scene tops cross the middle in one observer callback.
  for (let y = 0; y <= max + 120; y += 120) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(25);
  }
  const views = async () =>
    (await beacons())
      .map((body) => JSON.parse(body) as { event: string; location?: string })
      .filter((b) => b.event === 'scene_view')
      .map((b) => b.location);
  await expect.poll(views).toEqual(expected);
  // Back to the top and down again: nothing fires twice in one page view.
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
  );
  await page.waitForTimeout(200);
  expect(await views()).toEqual(expected);
});

test('T-EN7 the header «رزرو نوبت» lands on the booking block through the engine while Lenis runs', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  await formsHydrated(page);
  await expect.poll(async () => (await snapshot(page)).lenis).toBe(true);
  // Past the hero card, so the CTA routes to the block, not the hero field.
  await scrollIntoScene(page, 'services');
  await page
    .getByRole('banner')
    .getByRole('link', { name: t('nav.book') })
    .click();
  const block = page.locator(
    '[data-booking-form]:not([data-booking-form="hero"]):not([data-booking-form="dialog"])',
  );
  const padding = await page.evaluate(() => {
    const value = parseFloat(getComputedStyle(document.documentElement).scrollPaddingBlockStart);
    return Number.isNaN(value) ? 0 : value;
  });
  const distance = async () => Math.abs(((await block.boundingBox())?.y ?? Number.NaN) - padding);
  await expect.poll(distance, { timeout: 5000 }).toBeLessThanOrEqual(1);
  await page.waitForTimeout(300); // Lenis has settled: still there
  expect(await distance()).toBeLessThanOrEqual(1);
});

test.describe('tablet landscape touch', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });

  test('T-EN8 rotation mid-scene drops the pins and Lenis, keeps the place, and pins again when rotated back', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'tablet-light');
    await page.goto('/?debug=1&tier=2');
    await engineReady(page);
    expect((await snapshot(page)).layout).toMatchObject({ pinnedScenes: true, lenis: false });
    await scrollIntoScene(page, 'services');
    const before = await snapshot(page);
    const section = await sectionUnderMiddle(page);
    expect(section).toBe('services');

    await page.setViewportSize({ width: 820, height: 1180 });
    await expect.poll(async () => (await snapshot(page)).layout.pinnedScenes).toBe(false);
    await frames(page);
    await expect(page.locator('html[data-pins]')).toHaveCount(0);
    await expect(page.locator('html.lenis')).toHaveCount(0);
    await expect.poll(async () => (await snapshot(page)).scene).toBe(before.scene);
    expect(await sectionUnderMiddle(page)).toBe(section);

    await page.setViewportSize({ width: 1180, height: 820 });
    await expect.poll(async () => (await snapshot(page)).layout.pinnedScenes).toBe(true);
    await expect.poll(async () => (await snapshot(page)).scene).toBe(before.scene);
    // The pins are back and their spacers are in the bounds the place was applied from.
    await engineReady(page);
    await frames(page);
    await frames(page);
    expect(await sectionUnderMiddle(page)).toBe(section);
  });
});
