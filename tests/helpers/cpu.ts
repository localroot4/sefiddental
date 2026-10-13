// CPU throttling and garbage collection through the Chrome DevTools Protocol (Chromium only).
// Rates 4 and 6 are the slowdowns docs/experience-direction.md asks frame times for.
import type { Page } from '@playwright/test';

export type CpuRate = 1 | 4 | 6;

/** Slows the page's main thread by `rate`; the returned function restores full speed. */
export async function throttleCpu(page: Page, rate: CpuRate): Promise<() => Promise<void>> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  return async () => {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await cdp.detach();
  };
}

/** Forces a full garbage collection, so heap readings after it compare across runs. */
export async function collectGarbage(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.detach();
}
