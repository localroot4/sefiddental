// The experience scaffold on home (deliverable 6; spec-experience-tooling 3.12 P1, P2, P8;
// freeze 3.14): the canvas host mounts only after `load`, `?tier=N` fixes the tier, `?debug=1`
// shows the developer overlay, reduced motion gives tier 0 and no canvas. Desktop light only
// (the spec's project for these rows); the no-WebGL 2 path is tier0.spec.ts.
import { expect, test, type Page } from '@playwright/test';

import { skipIntro } from '../helpers/intro';
import { needsWebgl2 } from '../helpers/webgl';

/** The layer is portalled to body; mount timing comes from a MutationObserver set before load. */
async function recordLayerMount(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __layerMountedAt?: number };
    new MutationObserver((_, observer) => {
      if (document.querySelector('[data-experience-layer], canvas')) {
        w.__layerMountedAt = performance.now();
        observer.disconnect();
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

/** URLs of script responses whose body contains `needle` (WebGLRenderer: the WebGL chunk). */
function watchScripts(page: Page, needle = 'WebGLRenderer'): Set<string> {
  const urls = new Set<string>();
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    const body = await response.text().catch(() => '');
    if (body.includes(needle)) urls.add(response.url());
  });
  return urls;
}

/** Transfer size (encoded body bytes) of every script response, by URL. */
function watchScriptSizes(page: Page): Map<string, number> {
  const sizes = new Map<string, number>();
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    try {
      const { responseBodySize } = await response.request().sizes();
      sizes.set(response.url(), responseBodySize);
    } catch {
      // A script still in flight when the next navigation starts has no sizes.
    }
  });
  return sizes;
}

/** The plugin chunks of phase 7 (MorphSVG for scene 3, Draggable and Inertia for scene 11). */
const PLUGIN_NEEDLES = ['MorphSVG', 'Draggable'] as const;

/** The engine chunk (gsap core, ScrollTrigger, Lenis, the DOM scene modules): at most this. */
const ENGINE_LIMIT_KIB = 64;

/** Start times of the given resource URLs in the page's resource timing. */
async function startTimes(page: Page, urls: Set<string>): Promise<number[]> {
  return page.evaluate(
    (list) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => list.includes(entry.name))
        .map((entry) => entry.startTime),
    [...urls],
  );
}

/** Milliseconds the `load` event is held back after hydration (see holdLoad). */
const HOLD_LOAD_MS = 5000;

/**
 * Holds the `load` event back: an image added at DOMContentLoaded answers late. Hydration and
 * idle callbacks then run long before `load`, so a canvas that ignored the load gate would
 * mount early and the test would see it.
 */
async function holdLoad(page: Page): Promise<void> {
  await page.route('**/brand/og/default.png?hold-load', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, HOLD_LOAD_MS));
    await route.continue();
  });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const img = new Image();
      img.alt = '';
      img.hidden = true;
      img.src = '/brand/og/default.png?hold-load';
      document.body.append(img);
    });
  });
}

async function loadEventStart(page: Page): Promise<number> {
  return page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return nav?.loadEventStart ?? 0;
  });
}

async function expectNoLayerAfterLoad(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  // The canvas would mount on idle within 1.5 s of the gates opening (MOUNT_IDLE_TIMEOUT_MS).
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-experience-layer]')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
}

test.beforeEach(({ page }) => skipIntro(page));

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-light', 'experience rows run in desktop-light');
});

test('T-EX1 P1 the canvas host mounts only after load, and three.js loads only after load', async ({
  page,
}) => {
  await needsWebgl2(page);
  await holdLoad(page);
  await recordLayerMount(page);
  const webgl = watchScripts(page);
  // D5: in phase 7 the canvas chunk is requested only under the debug flag (no scene draws yet).
  await page.goto('/?debug=1&tier=2');
  await page.waitForLoadState('load');
  const layer = page.locator('[data-experience-layer]');
  await expect(layer).toHaveCount(1, { timeout: 15_000 });
  await expect(layer).toHaveAttribute('aria-hidden', 'true');
  await expect(layer).toHaveCSS('position', 'fixed');

  const loadStart = await loadEventStart(page);
  const mountedAt = await page.evaluate(
    () => (window as unknown as { __layerMountedAt?: number }).__layerMountedAt ?? -1,
  );
  expect(loadStart).toBeGreaterThan(HOLD_LOAD_MS);
  expect(mountedAt).toBeGreaterThan(loadStart);

  expect(webgl.size, 'the WebGL chunk was fetched for tier 2').toBeGreaterThan(0);
  for (const start of await startTimes(page, webgl))
    expect(start).toBeGreaterThanOrEqual(loadStart);
});

test('T-EX5 the scroll engine (GSAP, ScrollTrigger, Lenis) never loads at tier 0, at tier 1 only after load and within 64 KiB; the plugin chunks never before load', async ({
  page,
}, testInfo) => {
  await needsWebgl2(page);
  const atZero = [...PLUGIN_NEEDLES, 'ScrollTrigger'].map((needle) => watchScripts(page, needle));
  await page.goto('/?tier=0');
  await page.waitForLoadState('load');
  await page.waitForTimeout(2000);
  for (const urls of atZero) expect([...urls]).toEqual([]);

  await holdLoad(page);
  const atOne = watchScripts(page, 'ScrollTrigger');
  const plugins = PLUGIN_NEEDLES.map((needle) => watchScripts(page, needle));
  const sizes = watchScriptSizes(page);
  await page.goto('/?tier=1');
  await page.waitForLoadState('load');
  await expect.poll(() => atOne.size, { timeout: 15_000 }).toBeGreaterThan(0);
  const loadStart = await loadEventStart(page);
  expect(loadStart).toBeGreaterThan(HOLD_LOAD_MS);
  for (const start of await startTimes(page, atOne))
    expect(start).toBeGreaterThanOrEqual(loadStart);
  for (const urls of plugins)
    for (const start of await startTimes(page, urls))
      expect(start).toBeGreaterThanOrEqual(loadStart);

  // The engine set is every script that started after `load` (at tier 0 none does).
  await page.waitForTimeout(1500);
  const afterLoad = await page.evaluate(
    (since) =>
      performance
        .getEntriesByType('resource')
        .filter((entry) => entry.startTime >= since && /\.js(\?|$)/.test(entry.name))
        .map((entry) => entry.name),
    loadStart,
  );
  const engineBytes = afterLoad.reduce((sum, url) => sum + (sizes.get(url) ?? 0), 0);
  const engineNote = `${(engineBytes / 1024).toFixed(1)} (${afterLoad.length} scripts after load)`;
  testInfo.annotations.push({ type: 'engine chunk KiB', description: engineNote });
  console.log(`T-EX5 engine chunk KiB: ${engineNote}`);
  expect(afterLoad.length).toBeGreaterThan(0);
  expect(engineBytes).toBeLessThanOrEqual(ENGINE_LIMIT_KIB * 1024);
});

test('T-EX2 ?tier=N fixes the tier; ?tier=0 never mounts a canvas or fetches three.js', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/?tier=1');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-tier', '1');
  await expect(html).toHaveAttribute('data-tier-reason', 'query-override');

  const webgl = watchScripts(page);
  await page.goto('/?tier=0');
  await expect(html).toHaveAttribute('data-tier', '0');
  await expect(html).toHaveAttribute('data-tier-reason', 'query-override');
  await expectNoLayerAfterLoad(page);
  expect([...webgl]).toEqual([]);

  // D5: without the debug flag no registry scene draws yet, so tier 2 fetches no three.js either.
  await page.goto('/?tier=2');
  await expect(html).toHaveAttribute('data-tier', '2');
  await expectNoLayerAfterLoad(page);
  expect([...webgl]).toEqual([]);
});

test('T-EX3 P8 no overlay without ?debug=1; with it the overlay shows fps, tier, DPR, memory', async ({
  page,
}) => {
  await needsWebgl2(page);
  await page.goto('/');
  await page.waitForLoadState('load');
  await page.waitForTimeout(1000);
  await expect(page.locator('[data-dev-overlay]')).toHaveCount(0);
  expect(await page.evaluate(() => '__sefid' in window)).toBe(false);

  await page.goto('/?debug=1&tier=2');
  const overlay = page.locator('[data-dev-overlay]');
  await expect(overlay).toBeVisible();
  const text = overlay.locator('pre');
  await expect(text).toContainText(/^fps\s/m);
  await expect(text).toContainText(/^tier\s+2 \(query-override\)/m);
  await expect(text).toContainText(/^dpr\s+device 1\.00/m);
  await expect(text).toContainText(/^memory\s+heap /m);
  const snapshot = await page.evaluate(() => {
    const hook = (window as unknown as { __sefid?: { snapshot(): { tier: number } } }).__sefid;
    return hook?.snapshot() ?? null;
  });
  expect(snapshot?.tier).toBe(2);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('T-EX4 P2 reduced motion wins over ?tier=3: tier 0, no canvas, no three.js', async ({
    page,
  }) => {
    const webgl = watchScripts(page);
    await page.goto('/?tier=3');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-tier', '0');
    await expect(html).toHaveAttribute('data-tier-reason', 'reduced-motion');
    await expectNoLayerAfterLoad(page);
    expect([...webgl]).toEqual([]);
  });
});
