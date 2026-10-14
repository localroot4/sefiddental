// The no-WebGL 2 path (project no-webgl2: Chromium with --disable-webgl2; spec-experience-tooling
// 3.12 P2): even a forced ?tier=3 falls back to tier 0, the readable page without a canvas.
import { expect, test } from '@playwright/test';

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
