// The WebGL world of phase 8, as the journey left it (docs/experience/journey.md): three.js loads
// only after `load` and only at the first scroll, the canvas shows nothing before its first frame
// and draws nothing while the hero photo covers the viewport, the Draco decoder runs in a
// same-origin worker under the page CSP, the booking and footer stages turn transparent only
// while the journey layer paints them, and a lost context hands the courier to the DOM and back
// without a reload. Desktop rows (the journey's own rows are home-journey.spec.ts).
import { expect, test, type Page } from '@playwright/test';

import { watchConsoleErrors } from '../helpers/console';
import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

interface Snapshot {
  gate: string;
  framesRendered: number;
  scene: string | null;
  memory: { geometries: number | null };
}

async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => {
    const h = (window as unknown as { __sefid?: { snapshot(): Snapshot } }).__sefid;
    if (!h) throw new Error('window.__sefid is not installed');
    return h.snapshot();
  });
}

async function scrollTo(page: Page, scene: string, viewports = 0): Promise<void> {
  await page.evaluate(
    ({ scene, viewports }) => {
      const el = document.querySelector(`[data-scene="${scene}"]`);
      if (!el) throw new Error(`no [data-scene="${scene}"]`);
      const top = el.getBoundingClientRect().top + window.scrollY + viewports * window.innerHeight;
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
    },
    { scene, viewports },
  );
}

const canvasOpacity = (page: Page) =>
  page.evaluate(() => document.querySelector('canvas')?.style.opacity ?? null);

test.beforeEach(({ page }) => skipIntro(page));

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'world rows run in desktop-light');
});

test('T-WD1 three.js waits for the first scroll after load; the decoder runs in a same-origin worker under the page CSP', async ({
  page,
}) => {
  await needsWebgl2(page);
  const errors = watchConsoleErrors(page);
  const three: string[] = [];
  const world: string[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/brand/3d/')) world.push(`${response.status()} ${new URL(url).pathname}`);
    if (response.request().resourceType() !== 'script') return;
    const body = await response.text().catch(() => '');
    if (body.includes('WebGLRenderer')) three.push(url);
  });
  await page.goto('/?tier=2');
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000);
  expect(three, 'no three.js before the first scroll').toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);

  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 900);
  const canvas = page.locator('[data-experience-layer] canvas');
  await expect(canvas).toHaveCount(1, { timeout: 20_000 });
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect.poll(() => canvasOpacity(page), { timeout: 30_000 }).toBe('1');
  expect(three.length).toBeGreaterThan(0);
  await expect
    .poll(() => world, { timeout: 30_000 })
    .toEqual(
      expect.arrayContaining([
        '200 /brand/3d/mark.glb',
        '200 /brand/3d/molar.glb',
        '200 /brand/3d/draco/draco_decoder.wasm',
        '200 /brand/3d/draco/draco-worker.js',
      ]),
    );
  // A CSP refusal of a blob: worker or of the wasm is a console error; a decode failure too.
  await page.waitForTimeout(1500);
  expect(errors().filter((line) => !line.includes('/api/events'))).toEqual([]);
});

test('T-WD2 the hero is not a render cover: the canvas draws the courier on the hero photo from the first view', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=2&debug=1');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-experience-layer]')).toHaveCount(1, { timeout: 20_000 });
  // The courier waits on the hero photo (D1, docs/experience/journey.md): the gate is open and
  // frames are drawn without a scroll.
  await expect.poll(async () => (await snapshot(page)).gate, { timeout: 20_000 }).toBe('open');
  await expect.poll(async () => (await snapshot(page)).framesRendered).toBeGreaterThan(0);
});

test('T-WD3 the booking and footer stages are transparent only while the journey layer paints them, and a lost context hands the courier to the DOM and back without a reload', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=2&debug=1');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-experience-layer]')).toHaveCount(1, { timeout: 20_000 });
  const html = page.locator('html');
  const stage = page.locator('[data-home-section="booking"] > section');
  const band = page.locator('[data-band="booking"]');
  await expect(html).toHaveAttribute('data-world-stage', '', { timeout: 30_000 });
  await scrollTo(page, 'booking', 0.1);
  await expect(stage).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.locator('[data-scene="footer"]')).toHaveCSS(
    'background-color',
    'rgba(0, 0, 0, 0)',
  );
  // The band under the stage paints the stage's own colour, over the stage's box.
  const [bandColor, stageBox, bandBox] = await Promise.all([
    band.evaluate((el) => getComputedStyle(el).backgroundColor),
    stage.boundingBox(),
    band.boundingBox(),
  ]);
  const warmSoft = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'bg-warm-soft';
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  });
  expect(bandColor).toBe(warmSoft);
  expect(Math.abs((bandBox?.y ?? 0) - (stageBox?.y ?? 1))).toBeLessThan(2);
  expect(Math.abs((bandBox?.height ?? 0) - (stageBox?.height ?? 1))).toBeLessThan(2);

  const webgl = () =>
    page.evaluate(() =>
      (window as unknown as { __sefidJourney: { webgl(): boolean } }).__sefidJourney.webgl(),
    );
  const domCourier = page.locator('[data-courier]');
  await expect.poll(webgl, { timeout: 60_000 }).toBe(true);
  await expect(domCourier).toBeHidden();
  const lose = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ext = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    (window as unknown as { __lose?: unknown }).__lose = ext;
    return ext !== null && ext !== undefined;
  });
  expect(lose).toBe(true);
  // Lost: no frames; the DOM courier carries on at the same pose, the stages stay painted.
  await expect.poll(async () => (await snapshot(page)).gate).toBe('lost');
  await expect.poll(webgl).toBe(false);
  await expect(domCourier).toBeVisible();
  await expect(html).toHaveAttribute('data-world-stage', '');

  await page.evaluate(() =>
    (window as unknown as { __lose: { restoreContext(): void } }).__lose.restoreContext(),
  );
  const before = (await snapshot(page)).framesRendered;
  await expect.poll(async () => (await snapshot(page)).gate, { timeout: 15_000 }).toBe('open');
  await expect
    .poll(async () => (await snapshot(page)).framesRendered, { timeout: 15_000 })
    .toBeGreaterThan(before + 5);
  await expect.poll(webgl, { timeout: 15_000 }).toBe(true);
  await expect(domCourier).toBeHidden();
});
