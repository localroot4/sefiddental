// Scenes 10 and 11 and the «کیفیت» control (phase 7 report, plan section 4 step 8; lane
// BOOKING+FOOTER): the booking card completes its rise on focus, the INP of the block submit at
// 4x, the Draggable chunk only near the footer and once, drop, drag, throw and the way home,
// touch on a phone, «پخش دوباره» by keyboard, no Draggable after a relatch or a route change,
// the «کیفیت» radios. Rows that read `window.__sefid.snapshot()` open `?debug=1`.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { t } from '@/i18n/fa';

import { expectNoA11yViolations } from '../helpers/axe';
import { formsHydrated } from '../helpers/booking';
import { watchConsoleErrors } from '../helpers/console';
import { throttleCpu } from '../helpers/cpu';
import { sampleFrames } from '../helpers/frames';
import { skipIntro } from '../helpers/intro';

interface Snapshot {
  tier: number;
  labels: string[];
  scrollTriggers: number;
  tickSubscribers: number;
  draggables: number;
}
type Hook = { snapshot(): Snapshot; setUserOverride(o: number | 'auto'): void };

const STAGE = '[data-scene="footer"]';
const FIELD = `${STAGE} [data-playground-field]`;
const PARTS = `${STAGE} [data-playground-part]`;
const REPLAY = `${STAGE} [data-playground-replay]`;
const CARD = '[data-scene="booking"] [data-booking-card]';
const BOOKING = '/رزرو-نوبت';
/** Draggable + InertiaPlugin, gzip transfer (report, plan section 5). */
const DRAGGABLE_LIMIT_KIB = 16;
/** The parts go home this long after the last interaction, plus the brief's tolerance. */
const HOME_AFTER_MS = 6000;
const HOME_TOLERANCE_MS = 300;
/** The thresholds hold on the measurement host only (D19); CI records the numbers. */
const PERF_GATE = process.env.PERF_GATE === '1';

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

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

const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/** Scrolls the stage into view (the page bottom): the drop runs once the chunk is in. */
async function scrollToStage(page: Page): Promise<void> {
  await page
    .locator(STAGE)
    .evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await frames(page);
}

/** A part's translation from its home, from its computed transform. */
const translation = (page: Page, index: number) =>
  page
    .locator(PARTS)
    .nth(index)
    .evaluate((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return { x: m.e, y: m.f };
    });

const allHome = (page: Page) =>
  page.locator(PARTS).evaluateAll((els) =>
    els.every((el) => {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return Math.abs(m.e) < 0.5 && Math.abs(m.f) < 0.5;
    }),
  );

/** Draggable marks its targets with an inline `cursor: grab` (no debug overlay needed). */
const draggableParts = (page: Page) =>
  page.locator(PARTS).evaluateAll((els) => els.filter((el) => el.style.cursor === 'grab').length);

const anyDropping = (page: Page) =>
  page
    .locator(PARTS)
    .evaluateAll((els) =>
      els.some((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).f < -1),
    );

/** The drop ran and settled: a part was above its home, then every part is home. */
async function dropSettled(page: Page): Promise<void> {
  await expect.poll(() => anyDropping(page), { timeout: 8000 }).toBe(true);
  await expect.poll(() => allHome(page), { timeout: 8000 }).toBe(true);
}

/** True when `box` lies inside `field` (1 px of tolerance for subpixel rounding). */
function inside(
  box: { x: number; y: number; width: number; height: number },
  field: { x: number; y: number; width: number; height: number },
): boolean {
  return (
    box.x >= field.x - 1 &&
    box.y >= field.y - 1 &&
    box.x + box.width <= field.x + field.width + 1 &&
    box.y + box.height <= field.y + field.height + 1
  );
}

/** A part's box stays put for three 150 ms checks in a row: its throw and floor bounce are over. */
async function settled(page: Page, index: number): Promise<{ x: number; y: number }> {
  const deadline = Date.now() + 8000;
  let last = await translation(page, index);
  let stills = 0;
  while (stills < 3) {
    expect(Date.now(), 'the part never came to rest').toBeLessThan(deadline);
    await page.waitForTimeout(150);
    const now = await translation(page, index);
    stills = Math.abs(now.x - last.x) < 0.5 && Math.abs(now.y - last.y) < 0.5 ? stills + 1 : 0;
    last = now;
  }
  return last;
}

/**
 * Watches the mark from inside the page: the length of every rest longer than 4 s that ended
 * with a move (the way home after the last interaction; the test's own pauses are shorter).
 */
async function watchMark(page: Page): Promise<void> {
  await page
    .locator(PARTS)
    .first()
    .evaluate((el) => {
      const w = window as unknown as { __rests: number[] };
      w.__rests = [];
      let prev = getComputedStyle(el).transform;
      let lastMoveAt = performance.now();
      const tick = (): void => {
        const now = performance.now();
        const transform = getComputedStyle(el).transform;
        if (transform !== prev) {
          if (now - lastMoveAt > 4000) w.__rests.push(now - lastMoveAt);
          prev = transform;
          lastMoveAt = now;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
}
const rests = (page: Page) =>
  page.evaluate(() => (window as unknown as { __rests: number[] }).__rests);

/** Script responses whose body contains `needle`, with their transfer sizes. */
function watchScripts(
  page: Page,
  needle: string,
): { urls: Set<string>; sizes: Map<string, number> } {
  const urls = new Set<string>();
  const sizes = new Map<string, number>();
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    try {
      const body = await response.text();
      if (!body.includes(needle)) return;
      urls.add(response.url());
      const { responseBodySize } = await response.request().sizes();
      sizes.set(response.url(), responseBodySize);
    } catch {
      // A script aborted by a navigation has no body or sizes.
    }
  });
  return { urls, sizes };
}

/** What a relatch to tier 0 or a teardown must leave of the playground (T-EN3's list, here). */
async function expectStaticPlayground(page: Page): Promise<void> {
  await expect(page.locator(REPLAY)).toBeHidden();
  const leftovers = await page.locator(PARTS).evaluateAll((els) =>
    els.flatMap((el) => {
      const out: string[] = [];
      if (getComputedStyle(el).transform !== 'none')
        out.push(`transform on ${el.dataset.playgroundPart}`);
      if (el.style.willChange !== '') out.push(`will-change on ${el.dataset.playgroundPart}`);
      if (el.classList.contains('z-10')) out.push(`z-10 on ${el.dataset.playgroundPart}`);
      if (el.style.cursor !== '') out.push(`cursor on ${el.dataset.playgroundPart}`);
      return out;
    }),
  );
  expect(leftovers).toEqual([]);
}

test.beforeEach(({ page }) => skipIntro(page));

test('T-BF1 the block card is at opacity 1 and untransformed within 50 ms of a focus inside it at ?tier=1', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  await page.goto('/?tier=1');
  await formsHydrated(page);
  // One and a half screens above the card: near enough for a phone's deferred setup (phone spec
  // 1.4), and still below the screen, so the engine parks the card at the start of its rise.
  await page.evaluate(() => {
    const card = document.querySelector('[data-scene="booking"] [data-booking-card]')!;
    const top = card.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top - innerHeight * 1.5, behavior: 'instant' });
  });
  const card = page.locator(CARD);
  await expect(card).toHaveCSS('opacity', '0', { timeout: 15_000 });
  const ms = await page.evaluate(
    ([cardSel]) =>
      new Promise<number>((resolve) => {
        const el = document.querySelector<HTMLElement>(cardSel!)!;
        const input = el.querySelector<HTMLInputElement>('input[name="phone"]')!;
        const t0 = performance.now();
        input.focus();
        const check = (): void => {
          const style = getComputedStyle(el);
          const m = new DOMMatrixReadOnly(style.transform);
          const done = style.opacity === '1' && Math.abs(m.f) < 0.5 && Math.abs(m.e) < 0.5;
          if (done || performance.now() - t0 > 2000) resolve(performance.now() - t0);
          else requestAnimationFrame(check);
        };
        check();
      }),
    [CARD],
  );
  testInfo.annotations.push({ type: 'focus to opacity 1 ms', description: ms.toFixed(1) });
  expect(ms).toBeLessThanOrEqual(50);
  await expect(card.locator('input[name="phone"]')).toBeFocused();
  await expect(card).toHaveCSS('opacity', '1');
});

test('T-BF2 INP of the block submit at 4x CPU through the Event Timing API (gate 200 ms with PERF_GATE=1)', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light', 'phone-light');
  const phone = testInfo.project.name === 'phone-light';
  // The `{ ok: true }` answer of tests/e2e/home.spec.ts: the success state, no stored booking.
  await page.route(
    (url) => decodeURI(url.pathname) === BOOKING,
    (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 200, json: { ok: true } })
        : route.continue(),
  );
  await page.addInitScript(() => {
    type Timing = PerformanceEntry & {
      interactionId: number;
      processingStart: number;
      processingEnd: number;
    };
    const w = window as unknown as { __eventTiming: Record<string, number | string>[] };
    w.__eventTiming = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as Timing[]) {
        if (!e.interactionId) continue;
        w.__eventTiming.push({
          name: e.name,
          start: e.startTime,
          duration: e.duration,
          processingStart: e.processingStart,
          processingEnd: e.processingEnd,
        });
      }
      // Event Timing: entries over 16 ms (the default is 104); not in the lib's init type.
    }).observe({ type: 'event', durationThreshold: 16, buffered: true } as PerformanceObserverInit);
  });
  await page.goto('/?tier=1');
  await formsHydrated(page);
  await page.evaluate(() => document.fonts.ready);
  const block = page.locator('#bk-block');
  await block.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  const press = (locator: ReturnType<Page['locator']>) => (phone ? locator.tap() : locator.click());
  const restore = await throttleCpu(page, 4);
  const input = block.locator('input[name="phone"]');
  await press(input);
  await input.pressSequentially('09123456789', { delay: 60 });
  const submitFrom = await page.evaluate(() => performance.now());
  await press(block.locator('button[type="submit"]'));
  await expect(block).toHaveAttribute('data-state', 'success', { timeout: 15_000 });
  await page.waitForTimeout(1000);
  await restore();
  const worst = await page.evaluate((since) => {
    const list = (
      window as unknown as {
        __eventTiming: { name: string; start: number; duration: number }[];
      }
    ).__eventTiming.filter((e) => e.start >= since);
    return list.reduce<{ name: string; duration: number } | null>(
      (w, e) => (w && w.duration >= e.duration ? w : e),
      null,
    );
  }, submitFrom);
  const note = worst ? `${worst.duration} ms (${worst.name})` : 'under 16 ms';
  testInfo.annotations.push({ type: 'block submit INP 4x', description: note });
  console.log(`T-BF2 ${testInfo.project.name} block submit INP at 4x: ${note}`);
  if (PERF_GATE) expect(worst?.duration ?? 0).toBeLessThanOrEqual(200);
});

test('T-BF3 the Draggable chunk loads only once the footer is within one viewport, once per page view, within 16 KiB', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // The plugin chunk alone names InertiaPlugin (the debug overlay chunk names Draggable).
  const scripts = watchScripts(page, 'InertiaPlugin');
  await page.goto('/?tier=1');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  expect([...scripts.urls]).toEqual([]);
  // Two screens above the stage: still farther than one viewport.
  await page.evaluate(() => {
    const stage = document.querySelector('[data-scene="footer"]')!;
    const top = stage.getBoundingClientRect().top + scrollY;
    window.scrollTo({ top: top - innerHeight * 2.5, behavior: 'instant' });
  });
  await page.waitForTimeout(1500);
  expect([...scripts.urls]).toEqual([]);

  await scrollToStage(page);
  await expect.poll(() => scripts.urls.size, { timeout: 10_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1000);
  const urls = [...scripts.urls];
  const bytes = urls.reduce((sum, url) => sum + (scripts.sizes.get(url) ?? 0), 0);
  const note = `${(bytes / 1024).toFixed(1)} (${urls.length} script${urls.length === 1 ? '' : 's'})`;
  testInfo.annotations.push({ type: 'Draggable chunk KiB', description: note });
  console.log(`T-BF3 Draggable chunk KiB: ${note}`);
  expect(urls.every((url) => scripts.sizes.has(url))).toBe(true);
  expect(bytes).toBeLessThanOrEqual(DRAGGABLE_LIMIT_KIB * 1024);

  // A reload inside the stage: the immediate check and the trigger's onEnter share one guard.
  await page.reload();
  await page.waitForLoadState('load');
  await scrollToStage(page);
  await dropSettled(page);
  const fetched = await page.evaluate(
    (list) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => list.includes(entry.name))
        .map((entry) => entry.name),
    urls,
  );
  expect(fetched.sort()).toEqual([...urls].sort());
});

test('T-BF4 drop on enter, mouse drag and throw inside the field, home 6 s after the last interaction', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const errors = watchConsoleErrors(page);
  // No `?debug=1`: the overlay sits over the field's start corner, where the mark rests.
  await page.goto('/?tier=1');
  await page.waitForLoadState('load');
  await scrollToStage(page);
  await dropSettled(page);
  await expect.poll(() => draggableParts(page)).toBe(6);
  const field = (await page.locator(FIELD).boundingBox())!;
  const mark = page.locator(PARTS).first();
  const before = (await mark.boundingBox())!;
  const at = { x: before.x + before.width / 2, y: before.y + before.height / 2 };

  // Frames while dragging at 4x (annotation; the threshold holds with PERF_GATE=1, D19).
  const restore = await throttleCpu(page, 4);
  const sampling = sampleFrames(page, { warmupMs: 0, durationMs: 1800 });
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i += 1) {
    await page.mouse.move(at.x - 10 * i, at.y - 8 * i);
    await page.waitForTimeout(40);
  }
  await page.mouse.move(at.x - 120, at.y - 100, { steps: 4 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  const stats = await sampling;
  await restore();
  testInfo.annotations.push({
    type: 'drag frames 4x',
    description: `median ${stats.medianFps.toFixed(1)} fps, slowest window ${stats.minWindowFps.toFixed(1)}, worst frame ${stats.worstFrameMs.toFixed(1)} ms, long tasks over 100 ms ${stats.longTasksOver100ms}`,
  });
  console.log(
    `T-BF4 drag frames at 4x: median ${stats.medianFps.toFixed(1)} fps, slowest window ${stats.minWindowFps.toFixed(1)}, worst ${stats.worstFrameMs.toFixed(1)} ms`,
  );
  if (PERF_GATE) {
    expect(stats.medianFps).toBeGreaterThanOrEqual(59);
    expect(stats.longTasksOver100ms).toBe(0);
  }
  await settled(page, 0);
  const dragged = (await mark.boundingBox())!;
  expect(Math.hypot(dragged.x - before.x, dragged.y - before.y)).toBeGreaterThan(60);
  expect(inside(dragged, field)).toBe(true);
  // The pressed part rose by its class, once; the drag never wrote z-index itself.
  expect(await mark.evaluate((el) => el.classList.contains('z-10'))).toBe(true);

  // A throw: a fast move and a release; inertia carries the part, the bounds hold it.
  await watchMark(page);
  const from = { x: dragged.x + dragged.width / 2, y: dragged.y + dragged.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 60, from.y - 30, { steps: 2 });
  await page.mouse.move(from.x - 140, from.y - 70, { steps: 2 });
  await page.mouse.up();
  await settled(page, 0);
  const thrown = (await mark.boundingBox())!;
  expect(inside(thrown, field)).toBe(true);
  expect(Math.hypot(thrown.x - dragged.x, thrown.y - dragged.y)).toBeGreaterThan(20);
  expect(await mark.evaluate((el) => el.style.willChange)).toBe('');

  // The way home starts 6000 ms after the last movement (the floor bounce's end), measured in
  // the page's own frames; every part is home soon after.
  await expect.poll(() => allHome(page), { timeout: HOME_AFTER_MS + 4000 }).toBe(true);
  const [restMs] = await rests(page);
  testInfo.annotations.push({
    type: 'home after ms',
    description: String(Math.round(restMs ?? -1)),
  });
  expect(restMs).toBeGreaterThanOrEqual(HOME_AFTER_MS - 100);
  expect(restMs).toBeLessThanOrEqual(HOME_AFTER_MS + HOME_TOLERANCE_MS);
  expect(errors().filter((line) => !line.includes('/api/events'))).toEqual([]);
});

test.describe('390 px touch', () => {
  test('T-BF5 a touch drag moves a part; the parts rest on the inline-end half and a swipe on the inline-start half scrolls the page', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light');
    await page.goto('/?tier=1');
    await page.waitForLoadState('load');
    await scrollToStage(page);
    await dropSettled(page);
    await expect.poll(() => draggableParts(page)).toBe(6);
    const cdp = await page.context().newCDPSession(page);
    const mark = page.locator(PARTS).first();
    const before = (await mark.boundingBox())!;
    const start = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }],
      });
    await touch('touchStart', start.x, start.y);
    for (let i = 1; i <= 8; i += 1) {
      await touch('touchMove', start.x - 8 * i, start.y - 10 * i);
      await page.waitForTimeout(30);
    }
    await touch('touchEnd', start.x - 64, start.y - 80);
    await settled(page, 0);
    const after = (await mark.boundingBox())!;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(30);
    expect(inside(after, (await page.locator(FIELD).boundingBox())!)).toBe(true);

    // The parts rest on the inline-end half (the left in RTL, phone spec scene 11); a finger
    // swipe down on the inline-start half, under the right thumb, scrolls the page up: the field
    // has no touch-action of its own.
    const field = (await page.locator(FIELD).boundingBox())!;
    await expect.poll(() => allHome(page), { timeout: 8000 }).toBe(true);
    const rights = await page
      .locator(PARTS)
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const right of rights) expect(right).toBeLessThanOrEqual(field.x + field.width / 2);
    const scrollBefore = await page.evaluate(() => window.scrollY);
    const free = { x: field.x + field.width - 24, y: field.y + 40 };
    await touch('touchStart', free.x, free.y);
    for (let i = 1; i <= 8; i += 1) {
      await touch('touchMove', free.x, free.y + 25 * i);
      await page.waitForTimeout(30);
    }
    await touch('touchEnd', free.x, free.y + 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(scrollBefore - 50);
    await cdp.detach();
  });

  // The bar's box is a third of its fluid width; under 367 px wide that is less than 44 px
  // without its min-height (360 px is the common Android width).
  test('T-BF5b every part is a 44 px touch target on a 360 px phone', async ({
    page,
  }, testInfo) => {
    only(testInfo, 'phone-light');
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/?tier=0');
    const boxes = await page.locator(PARTS).evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { part: el.getAttribute('data-playground-part'), w: r.width, h: r.height };
      }),
    );
    expect(boxes).toHaveLength(6);
    for (const box of boxes) {
      expect(box.w, box.part!).toBeGreaterThanOrEqual(44);
      expect(box.h, box.part!).toBeGreaterThanOrEqual(44);
    }
  });
});

test('T-BF9 390 touch: «پخش دوباره» keeps its box at every tier (D24): invisible and inert at ?tier=0, shown at ?tier=1 in the same place', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'phone-dark');
  const box = () =>
    page.locator(REPLAY).evaluate((el) => {
      let top = 0;
      for (let e = el as HTMLElement | null; e; e = e.offsetParent as HTMLElement | null) {
        top += e.offsetTop;
      }
      const r = el.getBoundingClientRect();
      return [top, Math.round(r.left), Math.round(r.width), Math.round(r.height)];
    });
  await page.goto('/?tier=0');
  await page.waitForLoadState('load');
  await expect(page.locator(REPLAY)).toHaveAttribute('inert', '');
  await expect(page.locator(REPLAY)).toBeHidden();
  const atZero = await box();
  expect(atZero[3]).toBeGreaterThan(0);
  await page.goto('/?tier=1');
  await page.waitForLoadState('load');
  await scrollToStage(page);
  await expect(page.locator(REPLAY)).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(REPLAY)).not.toHaveAttribute('inert');
  expect(await box()).toEqual(atZero);
});

test('T-BF6 «پخش دوباره» by keyboard replays the drop', async ({ page }, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?debug=1&tier=1');
  await engineReady(page);
  await scrollToStage(page);
  await dropSettled(page);
  const replay = page.getByRole('button', { name: t('home.playground.replay') });
  await expect(replay).toBeVisible();
  await replay.focus();
  await page.keyboard.press('Enter');
  await dropSettled(page);
  await expect(replay).toBeFocused();
});

test('T-BF7 a relatch to tier 0 and a route change leave no Draggable and no transform behind', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  // The saved choice decides the tier (a `?tier=` query would outrank the control).
  await page.addInitScript(() => {
    localStorage.setItem('sefid-quality', '1');
    sessionStorage.setItem('sefid-debug', '1');
  });
  const errors = watchConsoleErrors(page);
  await page.goto('/');
  await engineReady(page);
  await scrollToStage(page);
  await dropSettled(page);
  await expect.poll(async () => (await snapshot(page)).draggables).toBe(6);
  // Mid-drop: the relatch must kill the tween and reset the parts.
  await page.getByRole('button', { name: t('home.playground.replay') }).click();
  await expect.poll(() => anyDropping(page)).toBe(true);
  await page.evaluate(() => (window as unknown as { __sefid?: Hook }).__sefid?.setUserOverride(0));
  await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
  // The parts are still in the document, so the count would see a survivor.
  await expect.poll(async () => (await snapshot(page)).draggables).toBe(0);
  await expectStaticPlayground(page);

  await page.evaluate(() => (window as unknown as { __sefid?: Hook }).__sefid?.setUserOverride(1));
  await engineReady(page);
  await scrollToStage(page);
  await expect.poll(async () => (await snapshot(page)).draggables).toBe(6);
  const fresh = await snapshot(page);

  // The soft route changes of this site (T-EN2): a content page -> home, back and forward.
  await page.goto('/خدمات');
  await page.waitForLoadState('load');
  await page.locator('header a[href="/"]').first().click();
  await page.waitForURL((url) => url.pathname === '/');
  await engineReady(page);
  await scrollToStage(page);
  await expect.poll(async () => (await snapshot(page)).draggables).toBe(6);
  await page.goBack();
  await page.waitForURL((url) => url.pathname === encodeURI('/خدمات'));
  await expect.poll(() => page.evaluate(() => '__sefid' in window)).toBe(false);
  await page.goForward();
  await page.waitForURL((url) => url.pathname === '/');
  await engineReady(page);
  await scrollToStage(page);
  await expect.poll(async () => (await snapshot(page)).draggables).toBe(fresh.draggables);
  expect(errors().filter((line) => !line.includes('/api/events'))).toEqual([]);
});

test('T-BF8 the «کیفیت» radios move html[data-tier] at once, keep the footer in view, survive a reload, and pass axe', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?debug=1');
  await page.waitForLoadState('load');
  await scrollToStage(page);
  const radio = (name: string) => page.getByRole('radio', { name });
  await expect(radio(t('home.quality.auto'))).toBeChecked();
  await expect(radio(t('home.quality.tier1'))).toBeEnabled();
  await expectNoA11yViolations(page, { include: STAGE });

  await radio(t('home.quality.tier1')).check();
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-tier', '1');
  await expect(html).toHaveAttribute('data-tier-reason', 'user-override');
  expect(await page.evaluate(() => localStorage.getItem('sefid-quality'))).toBe('1');
  const line = page.locator(`${STAGE} fieldset p`);
  await expect(line).toHaveText(t('home.quality.tier1'));
  await engineReady(page);
  await frames(page);
  const stage = (await page.locator(STAGE).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(stage.y).toBeLessThan(viewport.height);
  expect(stage.y + stage.height).toBeGreaterThan(0);
  await expect(page.locator(REPLAY)).toBeVisible();

  await page.reload();
  await page.waitForLoadState('load');
  await expect(radio(t('home.quality.tier1'))).toBeChecked();
  await expect(html).toHaveAttribute('data-tier', '1');

  // Reduced motion wins over the choice; the line says so.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(html).toHaveAttribute('data-tier', '0');
  await expect(line).toHaveText(`${t('home.quality.tier0')} · ${t('home.quality.reducedMotion')}`);
  await expect(radio(t('home.quality.tier1'))).toBeChecked();
  await expectStaticPlayground(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await radio(t('home.quality.auto')).check();
  // The choice is saved after the next paint (QualityControl), so poll.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sefid-quality'))).toBeNull();
  await expect(radio(t('home.quality.auto'))).toBeChecked();
});
