// Scene 3, services (phase 7 report, lane SERVICES; spec scene 3): the pinned horizontal track at
// tier 2 from 1024 px (geometry at the pin's start, end and midpoint, after a fast back-scroll,
// after a resize and after a theme switch), the MorphSVG chunk only there and once per page view,
// the native snap row on phones and tablets, and keyboard reachability in both layouts.
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { SERVICE_MARK_OUTLINE } from '@/brand/serviceIconPaths';
import { t } from '@/i18n/fa';

import { throttleCpu } from '../helpers/cpu';
import { skipIntro } from '../helpers/intro';

const SCENE = '[data-scene="services"]';
/** The pin's room: the scroll distance after the sticky stage, display none without pins. */
const ROOM = `${SCENE} [data-pin-room]`;
const TRACK = `${SCENE} [data-track]`;
/** The MorphSVG chunk: at most 10 KiB of plugin plus 2 KiB of paths (report, section 5). */
const MORPH_LIMIT_KIB = 12;
const LONG_TASK_MS = 100;

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

test.beforeEach(({ page }) => skipIntro(page));

/** Two animation frames: ScrollTrigger has seen the scroll. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

async function scrollTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);
  await frames(page);
}

/**
 * The pin's document range, once the engine's pin scrubs: the sticky stage's top under the nav
 * (the room's top less the stage), through the room's two viewport heights.
 */
async function pinRange(page: Page): Promise<{ start: number; end: number }> {
  await page.waitForFunction(
    () => performance.getEntriesByName('sefid:services-pin').length > 0,
    null,
    { timeout: 15_000 },
  );
  const { start, length, viewport } = await page.evaluate(() => {
    const room = document.querySelector('[data-scene="services"] [data-pin-room]');
    const stage = room?.previousElementSibling;
    if (!room || !(stage instanceof HTMLElement)) throw new Error('no pin room');
    const navH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'));
    const { top, height } = room.getBoundingClientRect();
    return {
      start: Math.round(top + window.scrollY - navH - stage.offsetHeight),
      length: Math.round(height),
      viewport: window.innerHeight,
    };
  });
  expect(length, 'the room is two viewport heights (D7)').toBe(viewport * 2);
  return { start, end: start + length };
}

/** The track's x translation and the edges of the rail and its worlds, in viewport pixels. */
async function geometry(page: Page) {
  return page.evaluate(() => {
    const scene = document.querySelector('[data-scene="services"]');
    const rail = scene?.querySelector('[data-rail]');
    const track = scene?.querySelector<HTMLElement>('[data-track]');
    if (!rail || !track) throw new Error('no rail or track');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const edges = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    return {
      x: matrix.m41,
      rail: edges(rail),
      worlds: [...track.children].map(edges),
      pinned: document.documentElement.hasAttribute('data-pins'),
    };
  });
}

/** URL and transfer size of every script response whose body holds `needle`. */
function watchScripts(page: Page, needle: string): Map<string, number> {
  const found = new Map<string, number>();
  page.on('response', async (response) => {
    try {
      if (response.request().resourceType() !== 'script') return;
      const body = await response.text();
      if (!body.includes(needle)) return;
      const { responseBodySize } = await response.request().sizes();
      found.set(response.url(), responseBodySize);
    } catch {
      // A script still in flight when the next navigation starts has no body or sizes.
    }
  });
  return found;
}

test('T-SV1 at ?tier=2 the stage pins: the first world at the start edge, the last flush at the end, and a fast back-scroll leaves the track where a fresh load puts it', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const { start, end } = await pinRange(page);
  await scrollTo(page, start);
  const atStart = await geometry(page);
  expect(atStart.pinned).toBe(true);
  expect(Math.abs(atStart.x)).toBeLessThanOrEqual(1);
  // RTL: the first world sits at the right (start) edge of the rail.
  expect(Math.abs((atStart.worlds[0]?.right ?? 0) - atStart.rail.right)).toBeLessThanOrEqual(1);
  // No world is cut by the viewport while pinned.
  for (const world of atStart.worlds) expect(world.bottom).toBeLessThanOrEqual(900 + 1);

  await scrollTo(page, end);
  const atEnd = await geometry(page);
  expect(atEnd.x).toBeGreaterThan(100);
  expect(Math.abs((atEnd.worlds.at(-1)?.left ?? 0) - atEnd.rail.left)).toBeLessThanOrEqual(1);

  const mid = Math.round((start + end) / 2);
  await scrollTo(page, mid);
  const xMid = (await geometry(page)).x;
  expect(Math.abs(xMid - atEnd.x / 2)).toBeLessThanOrEqual(1);

  // Fast: to the bottom, back to the top, then to the midpoint again.
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  await scrollTo(page, max);
  await scrollTo(page, 0);
  await scrollTo(page, mid);
  expect(Math.abs((await geometry(page)).x - xMid)).toBeLessThanOrEqual(1);

  await page.goto('/?tier=2');
  const fresh = await pinRange(page);
  expect(fresh).toEqual({ start, end });
  await scrollTo(page, mid);
  expect(Math.abs((await geometry(page)).x - xMid)).toBeLessThanOrEqual(1);
});

test('T-SV2 a resize from 1440 to 1280 at the midpoint leaves the track where a fresh 1280 load puts it', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const wide = await pinRange(page);
  await scrollTo(page, Math.round((wide.start + wide.end) / 2));
  await page.setViewportSize({ width: 1280, height: 900 });
  // The engine refreshes the triggers one frame after the root's size changes.
  await page.waitForTimeout(300);
  await frames(page);
  const resized = await pinRange(page);
  const mid = Math.round((resized.start + resized.end) / 2);
  await scrollTo(page, mid);
  const after = await geometry(page);
  expect(after.pinned).toBe(true);

  await page.goto('/?tier=2');
  const fresh = await pinRange(page);
  expect(fresh).toEqual(resized);
  await scrollTo(page, mid);
  const freshGeometry = await geometry(page);
  expect(Math.abs(after.x - freshGeometry.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs((after.worlds[0]?.right ?? 0) - (freshGeometry.worlds[0]?.right ?? 0)),
  ).toBeLessThanOrEqual(1);
});

test('T-SV7 at 1280x720 the pinned track is at least twice the rail and «همهٔ خدمات» stays inside the viewport through the pin', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/?tier=2');
  const { start, end } = await pinRange(page);
  const link = page.locator(SCENE).getByRole('link', { name: t('home.services.all') });
  for (const y of [start, Math.round((start + end) / 2), end]) {
    await scrollTo(page, y);
    const widths = await page.evaluate(() => {
      const scene = document.querySelector('[data-scene="services"]');
      const rail = scene?.querySelector('[data-rail]');
      const track = scene?.querySelector('[data-track]');
      if (!rail || !track) throw new Error('no rail or track');
      return { rail: rail.clientWidth, track: track.getBoundingClientRect().width };
    });
    expect(widths.track - widths.rail, `at ${y}`).toBeGreaterThanOrEqual(widths.rail);
    const box = await link.boundingBox();
    expect(box, `link at ${y}`).not.toBeNull();
    expect((box?.y ?? -1) + (box?.height ?? 0), `link bottom at ${y}`).toBeLessThanOrEqual(720);
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
  }
});

test('T-SV3 the MorphSVG chunk loads only at ?tier=2 from 1024 px, after load, once per page view, within 12 KiB and without a long task before the first morph at 4x', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  const morph = watchScripts(page, 'MorphSVG');
  const intoScene = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-scene="services"]');
      if (!el) throw new Error('no services scene');
      window.scrollTo({ top: el.getBoundingClientRect().top + scrollY, behavior: 'instant' });
    });
  for (const [url, width] of [
    ['/?tier=0', 1440],
    ['/?tier=1', 1440],
    ['/?tier=2', 390],
  ] as const) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto(url);
    await page.waitForLoadState('load');
    await intoScene();
    await page.waitForTimeout(2000);
    expect([...morph.keys()], `${url} at ${width}`).toEqual([]);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const w = window as unknown as { __longTasks: { start: number; duration: number }[] };
    w.__longTasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        w.__longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
  const restoreCpu = await throttleCpu(page, 4);
  await page.goto('/?tier=2');
  await page.waitForLoadState('load');
  const loadStart = await page.evaluate(
    () =>
      (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
        ?.loadEventStart ?? 0,
  );
  await pinRange(page);
  await expect.poll(() => morph.size, { timeout: 15_000 }).toBe(1);
  const [chunkUrl, sizedBytes] = [...morph.entries()][0] as [string, number];
  // `sizes()` answers -1 when Chromium reports no encoded length (a cached response); the resource
  // timing keeps the encoded body size of the same transfer.
  const chunkBytes =
    sizedBytes > 0
      ? sizedBytes
      : await page.evaluate(
          (url) =>
            (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find(
              (entry) => entry.name === url,
            )?.encodedBodySize ?? 0,
          chunkUrl,
        );
  testInfo.annotations.push({
    type: 'MorphSVG chunk KiB',
    description: (chunkBytes / 1024).toFixed(1),
  });
  console.log(`T-SV3 MorphSVG chunk KiB: ${(chunkBytes / 1024).toFixed(1)}`);
  expect(chunkBytes).toBeGreaterThan(0);
  expect(chunkBytes).toBeLessThanOrEqual(MORPH_LIMIT_KIB * 1024);

  await page.waitForFunction(
    () => performance.getEntriesByName('sefid:services-morph').length > 0,
    undefined,
    { timeout: 15_000 },
  );
  const timing = await page.evaluate((url) => {
    const resource = performance
      .getEntriesByType('resource')
      .filter((entry) => entry.name === url) as PerformanceResourceTiming[];
    const [morph] = performance.getEntriesByName('sefid:services-morph');
    const [pin] = performance.getEntriesByName('sefid:services-pin');
    const w = window as unknown as { __longTasks: { start: number; duration: number }[] };
    return {
      fetches: resource.length,
      start: resource[0]?.startTime ?? 0,
      morphAt: morph?.startTime ?? 0,
      morphMs: morph?.duration ?? 0,
      pinMs: pin?.duration ?? 0,
      longTasks: w.__longTasks,
    };
  }, chunkUrl);
  expect(timing.fetches).toBe(1);
  expect(timing.start).toBeGreaterThanOrEqual(loadStart);
  // The task that evaluated the chunk and added the first morph (the chunk's promise jobs run in
  // its evaluation task): none over 100 ms at 4x (C15).
  const [task] = timing.longTasks.filter(
    (t) => t.start <= timing.morphAt && t.start + t.duration >= timing.morphAt,
  );
  testInfo.annotations.push(
    { type: 'addMorphs ms (4x)', description: timing.morphMs.toFixed(1) },
    { type: 'pin creation ms (4x)', description: timing.pinMs.toFixed(1) },
    { type: 'chunk task ms (4x)', description: (task?.duration ?? 0).toFixed(0) },
  );
  console.log(
    `T-SV3 at 4x: addMorphs ${timing.morphMs.toFixed(1)} ms, pin creation ${timing.pinMs.toFixed(1)} ms, chunk task ${task?.duration ?? 0} ms`,
  );
  expect(task?.duration ?? 0).toBeLessThanOrEqual(LONG_TASK_MS);

  // The morph runs: the mark keeps its committed outline as `data-original`, its path changes
  // through the pin and comes back to the rendered start shape (MorphSVG writes the start as
  // cubic path data once the first tween rendered, never the committed string again).
  const { start, end } = await pinRange(page);
  const path = page.locator(`${SCENE} [data-mark] svg path`).first();
  await scrollTo(page, end);
  // Written by the first morph tween's render, the committed outline the restore puts back.
  await expect(path).toHaveAttribute('data-original', SERVICE_MARK_OUTLINE);
  await scrollTo(page, start - 10);
  // anticipatePin can hold the pin at progress 0.0001 just before its start until ScrollTrigger's
  // scroll end (200 ms without a scroll; MorphSVG writes 136.99 for 137): the start shape is the
  // `d` that holds across 400 ms.
  let dStart: string | null = null;
  await expect
    .poll(
      async () => {
        const before = dStart;
        dStart = await path.getAttribute('d');
        return dStart === before;
      },
      { intervals: [400] },
    )
    .toBe(true);
  await scrollTo(page, end);
  await expect.poll(() => path.getAttribute('d')).not.toBe(dStart);
  await scrollTo(page, start - 10);
  await expect.poll(() => path.getAttribute('d')).toBe(dStart);

  // A reload inside the pin fetches the chunk exactly once (the nearViewport guard, C13).
  await scrollTo(page, Math.round((start + end) / 2));
  await page.reload();
  await pinRange(page);
  await page.waitForFunction(
    () => performance.getEntriesByName('sefid:services-morph').length > 0,
    undefined,
    { timeout: 15_000 },
  );
  await page.waitForTimeout(1000);
  const fetches = await page.evaluate(
    (url) => performance.getEntriesByType('resource').filter((entry) => entry.name === url).length,
    chunkUrl,
  );
  expect(fetches).toBe(1);
  await restoreCpu();
});

test('T-SV4 on touch phones and tablets: no pin, a mandatory snap row, every card reachable by Tab and in view when focused', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light', 'tablet-light');
  await page.goto('/?tier=2');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2500);
  await expect(page.locator(ROOM)).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-pins'))).toBe(false);
  const track = page.locator(TRACK);
  await expect(track).toHaveCSS('scroll-snap-type', 'x mandatory');
  await expect(track).toHaveCSS('overscroll-behavior-x', 'contain');
  const width = page.viewportSize()?.width ?? 390;
  const links = track.getByRole('link');
  const count = await links.count();
  expect(count).toBe(5);
  const bar = page.locator(`${SCENE} [data-progress]`);
  await expect(bar).toHaveAttribute('aria-hidden', 'false');
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    await link.evaluate((el) => (el as HTMLElement).focus());
    await expect(link).toBeFocused();
    const card = link.locator('xpath=ancestor::article[1]');
    await expect
      .poll(async () => {
        const box = await card.boundingBox();
        return box !== null && box.x >= -1 && box.x + box.width <= width + 1 ? 'in view' : box;
      })
      .toBe('in view');
    // The bar counts the furthest card at least 60 percent inside the row (two fit on a tablet).
    const furthest = await track.evaluate((row) => {
      const edge = row.getBoundingClientRect();
      let last = 0;
      [...row.children].forEach((card, index) => {
        const r = card.getBoundingClientRect();
        const inside = Math.min(r.right, edge.right) - Math.max(r.left, edge.left);
        if (inside / r.width >= 0.6) last = index + 1;
      });
      return String(last);
    });
    expect(Number(furthest)).toBeGreaterThanOrEqual(i + 1);
    await expect(bar).toHaveAttribute('aria-valuenow', furthest);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
});

test('T-SV5 keyboard in the pin: a Tab to the fourth world scrolls the page so the world is visible', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const { start, end } = await pinRange(page);
  await scrollTo(page, start);
  const links = page.locator(TRACK).getByRole('link');
  await links.first().evaluate((el) => (el as HTMLElement).focus());
  await expect(links.first()).toBeFocused();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Tab');
  await expect(links.nth(3)).toBeFocused();
  const target = start + ((end - start) * 3) / 4;
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 5000 })
    .toBeGreaterThan(target - 2);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(target + 2);
  await frames(page);
  const { rail, worlds, pinned } = await geometry(page);
  expect(pinned).toBe(true);
  const fourth = worlds[3];
  expect(fourth?.left ?? -1).toBeGreaterThanOrEqual(rail.left - 1);
  expect(fourth?.right ?? 1e9).toBeLessThanOrEqual(rail.right + 1);
});

test('T-SV8 a fast Tab from the track into restoration keeps every focused element in view', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const { start } = await pinRange(page);
  await scrollTo(page, start);
  const links = page.locator(TRACK).getByRole('link');
  await links.first().evaluate((el) => (el as HTMLElement).focus());
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el) throw new Error('no focus');
      const r = el.getBoundingClientRect();
      return {
        inView: r.top >= 0 && r.bottom <= window.innerHeight,
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        scene: el.closest('[data-scene]')?.getAttribute('data-scene') ?? null,
        cta: el.hasAttribute('data-booking-cta'),
      };
    });
  // 150 ms per Tab: an animated scroll from the world before still runs at the next Tab.
  let last = await focused();
  for (let i = 0; i < 12 && !(last.scene === 'restoration' && last.cta); i += 1) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    last = await focused();
    expect(last.inView, JSON.stringify(last)).toBe(true);
  }
  expect(last).toMatchObject({ scene: 'restoration', cta: true });
  await page.waitForTimeout(1500);
  const settled = await focused();
  expect(settled.inView, JSON.stringify(settled)).toBe(true);
});

test('T-SV6 a theme switch mid-pin leaves the track transform unchanged', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await page.goto('/?tier=2');
  const { start, end } = await pinRange(page);
  await scrollTo(page, Math.round((start + end) / 2));
  const before = await geometry(page);
  // A dispatched click: a real one would scroll the hidden-on-scroll header back into view.
  await page.getByRole('button', { name: t('theme.toggle') }).dispatchEvent('click');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForTimeout(300);
  await frames(page);
  const after = await geometry(page);
  expect(after.pinned).toBe(true);
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs((after.worlds[0]?.right ?? 0) - (before.worlds[0]?.right ?? 0)),
  ).toBeLessThanOrEqual(1);
});
