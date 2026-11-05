// The WebGL world of phase 8 (lane WORLD: scenes 1-2 exit, 3 backdrop, 9-10 warm light and the
// booking mark): three.js loads only after `load` and only at the first scroll, the canvas shows
// nothing before its first frame and draws nothing while the hero photo covers the viewport, the
// Draco decoder runs in a same-origin worker under the page CSP, the booking stage turns
// transparent only while the world paints it, and a lost context recovers without a reload.
// Desktop only: under 1024 px the world draws no mark, backdrop or booking stage.
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
        '200 /brand/3d/diamond.glb',
        '200 /brand/3d/draco/draco_decoder.wasm',
        '200 /brand/3d/draco/draco-worker.js',
      ]),
    );
  // A CSP refusal of a blob: worker or of the wasm is a console error; a decode failure too.
  await page.waitForTimeout(1500);
  expect(errors().filter((line) => !line.includes('/api/events'))).toEqual([]);
});

test('T-WD2 no frame while the photo covers the viewport under the header; frames once it leaves', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=2&debug=1');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-experience-layer]')).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(1500);
  const covered = await snapshot(page);
  expect(covered.gate).toBe('covered');
  expect(covered.framesRendered).toBe(0);
  // The canvas has drawn nothing yet, so it shows nothing (no black or stale flash).
  expect(await canvasOpacity(page)).toBe('0');
  await page.evaluate(() => window.scrollTo({ top: 1, behavior: 'instant' }));
  await expect.poll(async () => (await snapshot(page)).framesRendered).toBeGreaterThan(0);
  expect((await snapshot(page)).gate).toBe('open');
});

test('T-WD3 the booking stage is transparent only while the world paints its mark, and a lost context recovers without a reload', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=2&debug=1');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-experience-layer]')).toHaveCount(1, { timeout: 20_000 });
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-world-stage');
  await scrollTo(page, 'booking', 0.1);
  await expect(html).toHaveAttribute('data-world-stage', '', { timeout: 30_000 });
  const stage = page.locator('[data-home-section="booking"] > section');
  await expect(stage).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  const lose = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const ext = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    (window as unknown as { __lose?: unknown }).__lose = ext;
    return ext !== null && ext !== undefined;
  });
  expect(lose).toBe(true);
  // Lost: no frames, and the stage is opaque again (nothing paints it).
  await expect.poll(async () => (await snapshot(page)).gate).toBe('lost');
  await expect(html).not.toHaveAttribute('data-world-stage');
  await expect(stage).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await page.evaluate(() =>
    (window as unknown as { __lose: { restoreContext(): void } }).__lose.restoreContext(),
  );
  const before = (await snapshot(page)).framesRendered;
  await expect.poll(async () => (await snapshot(page)).gate, { timeout: 15_000 }).toBe('open');
  await expect
    .poll(async () => (await snapshot(page)).framesRendered, { timeout: 15_000 })
    .toBeGreaterThan(before + 5);
  await expect(html).toHaveAttribute('data-world-stage', '', { timeout: 15_000 });
});

test('T-WD4 scenes two away are disposed: a full scroll back to the top frees the booking models', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=2&debug=1');
  await page.waitForLoadState('load');
  await expect(page.locator('[data-experience-layer]')).toHaveCount(1, { timeout: 20_000 });
  await scrollTo(page, 'booking', 0.1);
  await expect(page.locator('html')).toHaveAttribute('data-world-stage', '', { timeout: 30_000 });
  const atBooking = (await snapshot(page)).memory.geometries ?? 0;
  await scrollTo(page, 'workflow');
  // The booking stage closes as its scene unmounts, and the GPU holds fewer geometries.
  await expect(page.locator('html')).not.toHaveAttribute('data-world-stage');
  await expect
    .poll(async () => (await snapshot(page)).memory.geometries ?? Infinity, { timeout: 15_000 })
    .toBeLessThan(atBooking);
});
