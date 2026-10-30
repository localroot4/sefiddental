import type { Page } from '@playwright/test';

/**
 * The QA hero has no client photo, so its 4:5 band under the form is hidden on phones
 * (HomeHero.tsx). Rows about the band (its place, the Drift) show it as a real photo would,
 * through the CSSOM (the CSP allows no injected <style>), before the engine measures it.
 */
export async function showHeroBand(page: Page): Promise<void> {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () =>
      document
        .querySelector<HTMLElement>('[data-scene="hero"] [data-hero-photo]')
        ?.style.setProperty('display', 'block', 'important'),
    );
  });
}
