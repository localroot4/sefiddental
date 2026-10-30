import { test, type Page } from '@playwright/test';

/**
 * Engine gate for a test of the scroll engine, the pins or the canvas: they need tier 1 or more,
 * and a page without WebGL 2 latches tier 0 whatever `?tier` says (decision D-Q3). Headless
 * Firefox on the CI runner gets no GL driver («Exhausted GL driver options», CI run 95). Outside
 * Chromium such a test is skipped while the browser makes no WebGL 2 context, and runs once it
 * does; Chromium always runs it, so a lost GPU path there fails loudly.
 */
export async function needsWebgl2(page: Page): Promise<void> {
  if (page.context().browser()?.browserType().name() === 'chromium') return;
  const webgl2 = await page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl !== null;
  });
  test.skip(!webgl2, 'needs WebGL 2 for tier 1 and up; this browser makes no WebGL 2 context');
}
