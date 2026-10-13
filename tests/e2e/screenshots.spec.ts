// Screenshots of the system pages and the home placeholder in every viewport and theme project
// (00-master.md section 5: 390x844, 820x1180, 1440x900, light and dark). Not pixel-compared:
// font rasterization differs between the container's Chromium and CI's. With
// QA_SCREENSHOTS=phase-03 the files go to docs/qa/phase-03/<template>-<width>-<theme>.png for
// the phase report; otherwise they are attached to the test report only.
import path from 'node:path';

import { test } from '@playwright/test';

import { projectTheme } from '../helpers/theme';

const TEMPLATES = [
  { name: '404', path: '/qa-screenshot-missing-page' },
  { name: '500', path: '/qa/error' },
  { name: '410', path: '/qa/gone' },
  // The same document the proxy answers with in maintenance mode (renderStaticSystemPage).
  { name: '503', path: '/maintenance.html' },
  { name: 'home', path: '/' },
] as const;

function outputDir(): string | null {
  const phase = process.env.QA_SCREENSHOTS;
  if (!phase) return null;
  if (!/^phase-\d{2}$/.test(phase)) {
    throw new Error(`QA_SCREENSHOTS must look like phase-03, got "${phase}".`);
  }
  return path.resolve(process.cwd(), 'docs', 'qa', phase);
}

for (const template of TEMPLATES) {
  test(`T-SS ${template.name} screenshot`, async ({ page }, testInfo) => {
    await page.goto(template.path);
    await page.evaluate(() => document.fonts.ready);
    const width = page.viewportSize()?.width ?? 0;
    const file = `${template.name}-${width}-${projectTheme(testInfo)}.png`;
    const dir = outputDir();
    const body = await page.screenshot({
      fullPage: true,
      animations: 'disabled',
      ...(dir ? { path: path.join(dir, file) } : {}),
    });
    await testInfo.attach(file, { body, contentType: 'image/png' });
  });
}
