// Scene 5, the digital workflow (phase 7 report D2 and D7; lane WORKFLOW), on the e2e fixture,
// which publishes the `workflow` block (four sample steps): the pinned diagonal at tier 2 from
// 1024 px with each step at the stage centre at progress i/3, fast back-scroll and a mid-pin
// resize that leave nothing misplaced, the vertical timeline with the phone scroll set on a touch
// phone at tier 1 (phone spec scene 5: Rise per title and line, the line's Fill, the warm
// overlays, still photos) and at rest at tier 0. The home without the block renders no scene at
// all (unit test WS1: every e2e server runs on the one fixture database).
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

type Hook = { snapshot(): { labels: string[] } };

function only(testInfo: TestInfo, ...projects: string[]): void {
  test.skip(!projects.includes(testInfo.project.name), `runs in ${projects.join(', ')}`);
}

/** The debug hook is installed and the engine has measured its labels. */
async function engineReady(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => {
    const h = (window as unknown as { __sefid?: Hook }).__sefid;
    return h !== undefined && h.snapshot().labels.length > 0;
  });
}

/** Two animation frames: ScrollTrigger has rendered the scrub for the scroll. */
const frames = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
  await frames(page);
}

/**
 * The pin once the engine scrubs it: its scroll start (the sticky stage's top under the header,
 * the room's top less the stage) and its distance (the room after the stage).
 */
const geometry = (page: Page) =>
  page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-workflow-stage]');
    if (!stage) throw new Error('no [data-workflow-stage]');
    const room = stage.nextElementSibling;
    const engine = performance.getEntriesByName('sefid:engine-init').length > 0;
    const nav =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;
    const rect =
      engine && room?.hasAttribute('data-pin-room') ? room.getBoundingClientRect() : null;
    const live = rect !== null && rect.height > 0;
    return {
      diagonal: document.documentElement.hasAttribute('data-pins'),
      start: live ? rect.top + window.scrollY - nav - stage.offsetHeight : null,
      distance: live ? rect.height : null,
      stageHeight: stage.getBoundingClientRect().height,
      nav,
      vh: window.innerHeight,
    };
  });

/** Distance of step i's centre from the stage centre, and the path's transform. */
const placement = (page: Page, i: number) =>
  page.evaluate((index) => {
    const stage = document.querySelector<HTMLElement>('[data-workflow-stage]')!;
    const step = document.querySelectorAll<HTMLElement>('[data-workflow-step]')[index]!;
    const centre = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const s = centre(stage);
    const c = centre(step);
    return {
      dx: Math.abs(c.x - s.x),
      dy: Math.abs(c.y - s.y),
      opacity: getComputedStyle(step).opacity,
    };
  }, i);

/** Every scrubbed value: the path's translation and each step's transform and opacity. */
const state = (page: Page) =>
  page.evaluate(() => {
    const read = (el: Element) => {
      const cs = getComputedStyle(el);
      const m = new DOMMatrixReadOnly(cs.transform === 'none' ? '' : cs.transform);
      return { x: m.e, y: m.f, scale: m.a, opacity: Number(cs.opacity) };
    };
    return [
      read(document.querySelector('[data-workflow-path]')!),
      ...Array.from(document.querySelectorAll('[data-workflow-step]'), read),
      ...Array.from(document.querySelectorAll('[data-workflow-warm]'), read),
    ];
  });

function expectClose(a: Awaited<ReturnType<typeof state>>, b: typeof a, label: string): void {
  expect(a.length, label).toBe(b.length);
  a.forEach((v, i) => {
    expect(Math.abs(v.x - b[i]!.x), `${label} x of ${i}`).toBeLessThanOrEqual(1);
    expect(Math.abs(v.y - b[i]!.y), `${label} y of ${i}`).toBeLessThanOrEqual(1);
    expect(Math.abs(v.scale - b[i]!.scale), `${label} scale of ${i}`).toBeLessThanOrEqual(0.01);
    expect(Math.abs(v.opacity - b[i]!.opacity), `${label} opacity of ${i}`).toBeLessThanOrEqual(
      0.02,
    );
  });
}

test.beforeEach(({ page }) => skipIntro(page));

test('T-WF1 ?tier=2 at 1440: the stage pins +200 vh under the header and step i sits at the centre at progress i/3', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  await expect.poll(async () => (await geometry(page)).start).not.toBeNull();
  const g = await geometry(page);
  expect(g.diagonal).toBe(true);
  expect(Math.abs((g.distance ?? 0) - 2 * g.vh)).toBeLessThanOrEqual(2);
  expect(Math.abs(g.stageHeight - (g.vh - g.nav))).toBeLessThanOrEqual(2);
  for (let i = 0; i < 4; i += 1) {
    await scrollTo(page, (g.start ?? 0) + (i / 3) * (g.distance ?? 0));
    await expect
      .poll(async () => {
        const p = await placement(page, i);
        return Math.max(p.dx, p.dy);
      }, `step ${i} at the centre`)
      .toBeLessThanOrEqual(8);
    expect(Number((await placement(page, i)).opacity)).toBeGreaterThanOrEqual(0.98);
    // The other steps recede.
    for (let j = 0; j < 4; j += 1) {
      if (j !== i)
        expect(Number((await placement(page, j)).opacity), `step ${j}`).toBeLessThan(0.5);
    }
  }
  // Nothing scrolls sideways (T-HOME11 holds through the pin).
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
  ).toBeLessThanOrEqual(0);
});

test('T-WF2 a fast back-scroll and a mid-pin resize leave the transforms within 1 px of a fresh load', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  await expect.poll(async () => (await geometry(page)).start).not.toBeNull();
  const g = await geometry(page);
  const mid = (g.start ?? 0) + (g.distance ?? 0) / 2;
  await scrollTo(page, mid);
  const before = await state(page);
  await scrollTo(page, await page.evaluate(() => document.body.scrollHeight));
  await scrollTo(page, 0);
  await scrollTo(page, mid);
  expectClose(await state(page), before, 'after the fast back-scroll');

  // Mid-pin resize: the engine refreshes (ResizeObserver), the pin distance follows the new
  // viewport, and the scrub at the same progress equals a fresh load at that size.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(async () => (await geometry(page)).distance).toBeGreaterThanOrEqual(1998);
  const resized = await geometry(page);
  // At 1/2, where the refresh happened, the focus beats are mid-tween: a start value the refresh
  // re-recorded from the scrubbed state (not from the beat's own start) shows here, not at 1/3.
  await scrollTo(page, (resized.start ?? 0) + (resized.distance ?? 0) / 2);
  const afterResizeHalf = await state(page);
  const third = (resized.start ?? 0) + (resized.distance ?? 0) / 3;
  await scrollTo(page, third);
  await expect
    .poll(async () => {
      const p = await placement(page, 1);
      return Math.max(p.dx, p.dy);
    })
    .toBeLessThanOrEqual(8);
  const afterResize = await state(page);

  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  await expect.poll(async () => (await geometry(page)).start).not.toBeNull();
  const fresh = await geometry(page);
  expect(Math.abs((fresh.start ?? 0) - (resized.start ?? 0))).toBeLessThanOrEqual(1);
  await scrollTo(page, (fresh.start ?? 0) + (fresh.distance ?? 0) / 2);
  expectClose(await state(page), afterResizeHalf, 'at 1/2 after the resize, against a fresh load');
  await scrollTo(page, (fresh.start ?? 0) + (fresh.distance ?? 0) / 3);
  expectClose(await state(page), afterResize, 'at 1/3 after the resize, against a fresh load');
});

/** Scrub lag (0.32 s on coarse pointers) plus the settle window, with margin. */
const SCRUB_WAIT_MS = 700;

/** The document top of an element, transforms ignored (the offset chain). */
const docTop = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    let y = 0;
    for (let e = el as HTMLElement | null; e; e = e.offsetParent as HTMLElement | null) {
      y += e.offsetTop;
    }
    return y;
  });

/** Scrolls to `y` and waits out the scrub lag. */
async function scrollToY(page: Page, y: number): Promise<void> {
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.round(y));
  await page.waitForTimeout(SCRUB_WAIT_MS);
}

/** Computed opacity, scaleY and whether the computed transform is the identity. */
const look = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const style = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform);
    return { opacity: Number(style.opacity), identity: m.isIdentity, scaleY: m.d };
  });

test('T-WF3 390 touch: a vertical timeline, no spacer; ?tier=1 scrubs a Rise on each title and line from the bar top to its reading line, fills the line and warms the photos, which never move; ?tier=0 shows everything at rest with the line full', async ({
  page,
}, testInfo) => {
  only(testInfo, 'phone-light');
  await page.goto('/?debug=1&tier=1');
  await engineReady(page);
  const stage = page.locator('[data-workflow-stage]');
  const steps = page.locator('[data-workflow-step]');
  await expect(steps).toHaveCount(4);
  await expect(page.locator('[data-pin-room]')).toHaveCount(3);
  for (const room of await page.locator('[data-pin-room]').all()) await expect(room).toBeHidden();
  // The steps stay in one column (the vertical list, no absolute placement).
  const lefts = await steps.evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().left)),
  );
  expect(new Set(lefts).size).toBe(1);
  const height = page.viewportSize()?.height ?? 844;
  const bar = await page.evaluate(
    () => document.querySelector<HTMLElement>('[data-sticky-bar]')?.offsetHeight ?? 0,
  );
  // A far scene sets up when it comes near (phone spec 1.4): its line then carries data-scrub.
  await scrollToY(page, (await docTop(page, '[data-workflow-stage]')) - height);
  await expect(page.locator('[data-workflow-line][data-scrub]')).toHaveCount(1);
  expect(await stage.getAttribute('data-reveal')).toBeNull();
  expect(await page.evaluate(() => document.documentElement.hasAttribute('data-pins'))).toBe(false);

  const photos = '[data-workflow-step] > div:last-child, [data-workflow-step] img';
  const photosStill = () =>
    page
      .locator(photos)
      .evaluateAll((els) =>
        els.filter((el) => getComputedStyle(el).transform !== 'none').map((el) => el.tagName),
      );
  // Rise: each title and each line on its own trigger, dim at the bar top, at rest at 80 %.
  for (const selector of [
    '[data-workflow-step]:nth-child(1) h3',
    '[data-workflow-step]:nth-child(1) h3 + p',
    '[data-workflow-step]:nth-child(4) h3',
  ]) {
    const top = await docTop(page, selector);
    await scrollToY(page, top - (height - bar));
    expect((await look(page, selector)).opacity, `${selector} at the bar top`).toBeLessThan(0.1);
    await scrollToY(page, top - height * 0.8 + 4);
    expect(await look(page, selector), `${selector} at its reading line`).toMatchObject({
      opacity: 1,
      identity: true,
    });
    expect(await photosStill()).toEqual([]);
  }

  // Fill: the line follows the 60 % line down the list.
  const list = await docTop(page, '[data-workflow-path]');
  const listHeight = await page
    .locator('[data-workflow-path]')
    .evaluate((el) => el.getBoundingClientRect().height);
  await scrollToY(page, list - height * 0.6 - 10);
  expect((await look(page, '[data-workflow-line]')).scaleY).toBeLessThan(0.02);
  await scrollToY(page, list + listHeight / 2 - height * 0.6);
  const half = (await look(page, '[data-workflow-line]')).scaleY;
  expect(half).toBeGreaterThan(0.4);
  expect(half).toBeLessThan(0.6);
  await scrollToY(page, list + listHeight - height * 0.6 + 10);
  expect((await look(page, '[data-workflow-line]')).scaleY).toBeCloseTo(1, 2);

  // The warm overlays: the scan stays cold; the last warms to WARM_MAX (0.36) from 80 % to 40 %.
  const lastFrame = '[data-workflow-step]:nth-child(4) > div:last-child';
  const lastWarm = `${lastFrame} [data-workflow-warm]`;
  const frameTop = await docTop(page, lastFrame);
  await scrollToY(page, frameTop - height * 0.8 - 10);
  expect((await look(page, lastWarm)).opacity).toBeLessThan(0.02);
  await scrollToY(page, frameTop - height * 0.4 + 10);
  expect((await look(page, lastWarm)).opacity).toBeCloseTo(0.36, 2);
  expect((await look(page, '[data-workflow-step]:nth-child(1) [data-workflow-warm]')).opacity).toBe(
    0,
  );
  expect(await photosStill()).toEqual([]);

  await page.goto('/?tier=0');
  await page.waitForLoadState('load');
  await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
  await expect(page.locator('[data-pin-room]')).toHaveCount(3);
  for (const room of await page.locator('[data-pin-room]').all()) await expect(room).toBeHidden();
  await expect(page.locator('[data-scrub]')).toHaveCount(0);
  const rest = await page
    .locator('[data-workflow-step] h3, [data-workflow-step] h3 + p')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(rest).toEqual(Array(8).fill('1'));
  expect(await look(page, '[data-workflow-line]')).toMatchObject({ identity: true, scaleY: 1 });
  const warm = await page
    .locator('[data-workflow-warm]')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  expect(warm).toEqual(['0', '0', '0', '0']);
});

test('T-WF4 the scene is one section between restoration and compare, with its world slot and four lazy photos', async ({
  page,
}, testInfo) => {
  only(testInfo, 'desktop-light');
  await needsWebgl2(page);
  await page.goto('/?debug=1&tier=2');
  await engineReady(page);
  const scenes = await page
    .locator('[data-scene]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-scene')));
  const at = scenes.indexOf('workflow');
  expect(scenes.filter((id) => id === 'workflow')).toHaveLength(1);
  expect(scenes[at - 1]).toBe('restoration');
  expect(scenes[at + 1]).toBe('compare');
  const labels = await page.evaluate(
    () => (window as unknown as { __sefid: Hook }).__sefid.snapshot().labels,
  );
  expect(labels).toContain('workflow');
  await expect(page.locator('[data-world-slot="workflow"]')).toHaveCount(1);
  const imgs = page.locator('[data-scene="workflow"] picture img');
  await expect(imgs).toHaveCount(4);
  expect(await imgs.evaluateAll((els) => els.map((el) => el.getAttribute('loading')))).toEqual([
    'lazy',
    'lazy',
    'lazy',
    'lazy',
  ]);
});
