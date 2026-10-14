// The three QA viewports (00-master.md section 5) and the screenshot writer shared by the
// screenshot specs. Screenshots are not pixel-compared: font rasterization differs between the
// container's Chromium and CI's.
import path from 'node:path';

import { devices, type Page, type TestInfo } from '@playwright/test';

import type { Theme } from './theme';

const androidChrome = devices['Pixel 7'].userAgent;

export const VIEWPORTS = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: androidChrome,
  },
  tablet: {
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: androidChrome,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

/**
 * docs/qa/<phase>/ when QA_SCREENSHOTS=phase-NN is set (local phase verification), else null
 * (the images are only attached to the test report).
 */
export function qaScreenshotDir(): string | null {
  const phase = process.env.QA_SCREENSHOTS;
  if (!phase) return null;
  if (!/^phase-\d{2}$/.test(phase)) {
    throw new Error(`QA_SCREENSHOTS must look like phase-03, got "${phase}".`);
  }
  return path.resolve(process.cwd(), 'docs', 'qa', phase);
}

/** Full-page screenshot named <template>-<width>-<theme>.png, written and attached. */
export async function captureTemplate(
  page: Page,
  testInfo: TestInfo,
  template: string,
  theme: Theme,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const width = page.viewportSize()?.width ?? 0;
  const file = `${template}-${width}-${theme}.png`;
  const dir = qaScreenshotDir();
  const body = await page.screenshot({
    fullPage: true,
    animations: 'disabled',
    ...(dir ? { path: path.join(dir, file) } : {}),
  });
  await testInfo.attach(file, { body, contentType: 'image/png' });
}
