// The home scroll engine (phase 7 report, plan section 3; lane ENGINE): one label per scene,
// teardown on a route change, keep-place across a relatch (reduced motion, «کیفیت», rotation),
// no pins or Lenis on touch phones, `scene_view` once per scene, the booking route through the
// engine while Lenis runs. Every row reads `window.__sefid.snapshot()` (`?debug=1`).
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import { formsHydrated, recordBeacons } from '../helpers/booking';
import { watchConsoleErrors } from '../helpers/console';
import { skipIntro } from '../helpers/intro';

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
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
  await expect(page.locator('[data-reveal]')).toHaveCount(0);
  await expect(page.locator('html.lenis')).toHaveCount(0);
  const leftovers = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-experience-root] *')) {
      if (el.closest('[data-dev-overlay]')) continue;
      if (el.style.getPropertyValue('--warm') !== '') out.push(`--warm on ${el.tagName}`);
      if (el.style.willChange !== '') out.push(`will-change on ${el.tagName}`);
      const transform = getComputedStyle(el).transform;
      // The compare slider (the box around its range input) owns the one transform of tier 0.
      if (transform !== 'none' && !el.closest('div:has(> input[type="range"])'))
        out.push(`${el.tagName}.${el.className} transform ${transform}`);
    }
    return out;
  });
  expect(leftovers).toEqual([]);
}

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(({ page }) => skipIntro(page));

test('T-EN1 one label per present scene in document order; progress is monotonic on a scroll', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
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
  await expect(page.locator('.pin-spacer')).toHaveCount(0);
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
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
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
    await expect(page.locator('.pin-spacer')).toHaveCount(0);
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
