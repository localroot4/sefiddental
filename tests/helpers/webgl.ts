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
 * The WebGL world has started and the page draws steadily again: its first frame (the World shows
 * its canvas then: inline opacity 1), the WebGL courier drawn (the DOM courier steps aside: its box
 * hidden; it draws with the studio environment, whose compile is the long part), then 20 frames in
 * a row under 100 ms each. For a page whose courier is on screen at tier 2 or 3. On a software GPU
 * the world's start-up compiles shaders for seconds, and Chrome renders no frame meanwhile: a
 * tween cannot draw its last steps, and a media query change (a rotation) is not delivered, until
 * it is up. A test that times either waits for this once the world has been asked for.
 */
export async function worldSettled(page: Page): Promise<void> {
  // The start-up is not the test's own time (11 to 15 s with two workers on two cores, more on a
  // slow runner: CI run 131 T-S6 and T-WF1 ran out of their 30 s): the budget covers the three
  // waits below while they run, then grows by what they took, so the test keeps all of its own.
  const info = test.info();
  const budget = info.timeout;
  const started = Date.now();
  if (budget > 0) info.setTimeout(budget + 90_000);
  await page.waitForFunction(
    () =>
      document.querySelector<HTMLCanvasElement>('[data-experience-layer] canvas')?.style.opacity ===
      '1',
    null,
    { timeout: 30_000 },
  );
  await page.waitForFunction(
    () => {
      const dom = document.querySelector('[data-courier]');
      return dom !== null && getComputedStyle(dom).visibility === 'hidden';
    },
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
  if (budget > 0) info.setTimeout(budget + (Date.now() - started));
}

/**
 * worldSettled where the page starts the world on load: `?debug=1` mounts the canvas at once on a
 * desktop or a tablet (a phone loads none), and from `?tier=2` the courier draws on it. The specs'
 * engineReady call it, so no test there times a tween, a scrub or a smooth scroll inside the
 * start-up: on CI's software GPU one task of 5 to 15 s right after load answered no poll (run 129
 * T-S7; run 131 T-EN7 3109 px short, T-S6, T-WF1). A real GPU never meets it: a software renderer
 * latches tier 0 (qualityTier.ts).
 */
export async function worldStartedOnLoad(page: Page): Promise<void> {
  const query = new URL(page.url()).searchParams;
  const tier = query.get('tier');
  if (
    query.get('debug') !== '1' ||
    (tier !== '2' && tier !== '3') ||
    test.info().project.name.startsWith('phone-')
  )
    return;
  await worldSettled(page);
}
