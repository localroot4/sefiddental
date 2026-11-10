import { test, type Page } from '@playwright/test';

/**
 * Engine gate for a test of the scroll engine, the pins or the canvas: they need tier 1 or more,
 * and a page without WebGL 2 latches tier 0 whatever `?tier` says (decision D-Q3). Headless
 * Firefox on the CI runner gets no GL driver on the main thread («Exhausted GL driver options», CI
 * run 95), while its probe worker sometimes gets a context: the tier then races the engine (run
 * 96: T-KB walk ?tier=2, T-SV8, T-RS9 waited for an engine that never came). Outside
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

/**
 * The WebGL world has started and the page draws steadily again: its first frame (the debug hook,
 * `?debug=1`), then 20 frames in a row under 100 ms each. On a software GPU the world's start-up
 * compiles shaders for seconds, past its first frame too (the studio environment recompiles the
 * materials), and Chrome renders no frame meanwhile: a tween cannot draw its last steps, and a
 * media query change (a rotation) is not delivered, until it is up. A test that times either
 * waits for this once the world has been asked for.
 */
export async function worldSettled(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      ((
        window as unknown as { __sefid?: { snapshot(): { framesRendered?: number } } }
      ).__sefid?.snapshot().framesRendered ?? 0) > 0,
    null,
    { timeout: 30_000 },
  );
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const until = performance.now() + 30_000;
        let last = performance.now();
        let steady = 0;
        const frame = (now: number): void => {
          steady = now - last < 100 ? steady + 1 : 0;
          last = now;
          if (steady >= 20) resolve();
          else if (now > until) reject(new Error('the page never drew 20 steady frames in 30 s'));
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}
