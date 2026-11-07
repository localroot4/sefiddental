// Tablet journey evidence (docs/experience/journey.md): the home page at every dock of the courier
// and half way through every travel, at 820x1180, 854x1280, 1180x820 and 1280x854 with touch and an
// Android tablet user agent, light and dark. JPEG, at most 1000 px wide. The stops come from the page itself (`window.__sefidJourney.holds()`, `?debug=1`);
// the developer overlay is hidden for the shot.
//   node docs/qa/tablet/capture.mjs <origin> [--tier=1]
// (after `npm run build` and `npm run db:e2e`, with the standalone server on <origin>, DEMO_CONTENT
// on for the stock photos; Chromium from PW_CHROMIUM_EXECUTABLE, WebGL on SwiftShader)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const origin = process.argv[2] ?? 'http://localhost:3000';
const tier = process.argv.find((a) => a.startsWith('--tier='))?.slice(7) ?? '1';
// `--only=1440x900:dock-hero,390x844:dock-services`: retake just these shots.
const only = process.argv
  .find((a) => a.startsWith('--only='))
  ?.slice(7)
  .split(',')
  .map((pair) => pair.split(':'));
const wanted = (size, stop) =>
  !only || only.some(([s, name]) => s === size && stop.includes(name));
const SIZES = [
  { name: '820x1180', width: 820, height: 1180 },
  { name: '854x1280', width: 854, height: 1280 },
  { name: '1180x820', width: 1180, height: 820 },
  { name: '1280x854', width: 1280, height: 854 },
];
// Xiaomi Pad 7: an Android tablet browser sends no "Mobile".
const UA =
  'Mozilla/5.0 (Linux; Android 14; 24091RPADG) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_EXECUTABLE,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
mkdirSync(here, { recursive: true });
for (const size of SIZES) {
  if (only && !only.some(([s]) => s === size.name)) continue;
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      colorScheme: scheme,
      locale: 'fa-IR',
      userAgent: UA,
      hasTouch: true,
    });
    await context.addInitScript(() => sessionStorage.setItem('sefid-intro', '1'));
    const page = await context.newPage();
    await page.goto(`${origin}/?tier=${tier}&debug=1`);
    await page.waitForLoadState('load');
    await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => window.__sefidJourney, null, { timeout: 30_000 });
    if (tier !== '1') {
      await page.waitForFunction(() => window.__sefidJourney.webgl(), null, { timeout: 90_000 });
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__sefidJourney.measure());
    const holds = await page.evaluate(() => window.__sefidJourney.holds());
    const stops = holds.flatMap((h, i) => {
      const next = holds[i + 1];
      const at = h.id === 'footer' ? h.start + 2 : (h.start + h.end) / 2;
      const dock = { name: `${String(i + 1).padStart(2, '0')}-dock-${h.id}`, y: at };
      return next
        ? [dock, { name: `${String(i + 1).padStart(2, '0')}-travel-${h.id}-${next.id}`, y: (h.end + next.start) / 2 }]
        : [dock];
    });
    for (const stop of stops) {
      if (!wanted(size.name, stop.name)) continue;
      // Twice: a smooth scroll still running would carry the first jump on.
      for (let k = 0; k < 2; k += 1) {
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.ceil(stop.y));
        await page.waitForTimeout(900);
      }
      await page.evaluate(() =>
        document.querySelector('[data-dev-overlay]')?.style.setProperty('display', 'none'),
      );
      await page.waitForTimeout(600);
      const shot = await page.screenshot({ type: 'png' });
      const file = path.join(here, `${size.name}-t${tier}-${scheme}-${stop.name}.jpg`);
      await sharp(shot)
        .resize({ width: Math.min(1000, size.width) })
        .jpeg({ quality: 68, mozjpeg: true })
        .toFile(file);
      console.log(path.basename(file));
    }
    await context.close();
  }
}
await browser.close();
