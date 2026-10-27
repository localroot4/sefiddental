import type { Page } from '@playwright/test';

/**
 * Marks the intro as already played in this session (`sessionStorage['sefid-intro']`, the
 * session-once key of the inline intro script), so a spec that opens `/` never waits behind the
 * overlay. The intro's own spec (home-intro.spec.ts) opens fresh contexts without it.
 */
export async function skipIntro(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('sefid-intro', '1');
    } catch {
      // An opaque origin (about:blank) has no storage; the first real navigation runs this again.
    }
  });
}
