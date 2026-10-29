// The no-WebGL 2 path (project no-webgl2: Chromium with --disable-webgl2; spec-experience-tooling
// 3.12 P2): even a forced ?tier=3 falls back to tier 0, the readable page without a canvas.
import { expect, test } from '@playwright/test';

import { skipIntro } from '../helpers/intro';

test.beforeEach(({ page }) => skipIntro(page));

test('T-T01 without WebGL 2, ?tier=3 gives tier 0 (no-webgl2), no canvas and no three.js', async ({
  page,
}) => {
  const webgl: string[] = [];
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    if ((await response.text().catch(() => '')).includes('WebGLRenderer')) {
      webgl.push(response.url());
    }
  });
  await page.goto('/?tier=3');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-tier', '0');
  await expect(html).toHaveAttribute('data-tier-reason', 'no-webgl2');
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-experience-layer]')).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(webgl).toEqual([]);
  // The tier-0 page is the complete page: the hero heading is there.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('T-T02 tier 0: the footer playground is static, «پخش دوباره» hidden, no Draggable chunk at the footer', async ({
  page,
}) => {
  const draggable: string[] = [];
  page.on('response', async (response) => {
    if (response.request().resourceType() !== 'script') return;
    // The plugin chunk alone names InertiaPlugin (T-EX5 and check-bundle read Draggable).
    if ((await response.text().catch(() => '')).includes('InertiaPlugin'))
      draggable.push(response.url());
  });
  await page.goto('/?tier=3');
  await expect(page.locator('html')).toHaveAttribute('data-tier', '0');
  await page.waitForLoadState('load');
  const stage = page.locator('[data-scene="footer"]');
  await stage.evaluate((el) => el.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.waitForTimeout(3000);
  expect(draggable).toEqual([]);
  await expect(stage.locator('[data-playground-replay]')).toBeHidden();
  const parts = stage.locator('[data-playground-part]');
  await expect(parts).toHaveCount(6);
  for (const transform of await parts.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).transform),
  ))
    expect(transform).toBe('none');
  // The «کیفیت» control is the accessible path: enabled after hydration.
  await expect(page.getByRole('radio', { name: 'خودکار' })).toBeEnabled();
});
