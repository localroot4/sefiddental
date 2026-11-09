// The polish screen recording and the restoration levels (docs/experience/journey.md):
//   node docs/qa/polish/record.mjs <origin>
// writes scroll-854x1280-t2.webm (about 20 s: the whole home page down and back up at tier 2),
// the three restoration levels at 1440x900 and 390x844 in both themes, and prints the frame
// timing of the scroll (rAF intervals, SwiftShader: CPU raster, an upper bound, not a device).
import { renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const origin = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_EXECUTABLE,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// 1. The recording.
{
  const context = await browser.newContext({
    viewport: { width: 854, height: 1280 },
    hasTouch: true,
    recordVideo: { dir: here, size: { width: 427, height: 640 } },
  });
  await context.addInitScript(() => sessionStorage.setItem('sefid-intro', '1'));
  const page = await context.newPage();
  await page.goto(`${origin}/?tier=2`);
  await page.waitForLoadState('load');
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const w = window;
    w.__frames = [];
    let last = performance.now();
    const tick = (t) => {
      w.__frames.push(t - last);
      last = t;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const glide = async (from, to, ms) => {
    const steps = Math.round(ms / 40);
    for (let i = 1; i <= steps; i += 1) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), from + ((to - from) * i) / steps);
      await page.waitForTimeout(40);
    }
  };
  await glide(0, max, 10_000);
  await page.waitForTimeout(500);
  await glide(max, 0, 9_000);
  await page.waitForTimeout(500);
  const frames = await page.evaluate(() => window.__frames.slice(1));
  frames.sort((a, b) => a - b);
  const q = (p) => frames[Math.min(frames.length - 1, Math.floor(p * frames.length))].toFixed(1);
  console.log(`frame interval ms over the scroll (854x1280, tier 2, SwiftShader): median ${q(0.5)}, p95 ${q(0.95)}, max ${q(1)}`);
  const video = page.video();
  await context.close();
  renameSync(await video.path(), path.join(here, 'scroll-854x1280-t2.webm'));
}

// 2. The restoration levels.
for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: scheme,
      hasTouch: width < 744,
      isMobile: width < 744,
    });
    await context.addInitScript(() => sessionStorage.setItem('sefid-intro', '1'));
    const page = await context.newPage();
    await page.goto(`${origin}/?tier=${width < 744 ? 1 : 2}&debug=1`);
    await page.waitForLoadState('load');
    await page.waitForTimeout(2500);
    const radios = page.locator('[data-scene="restoration"] input[name="home-tier"]');
    for (let i = 0; i < (await radios.count()); i += 1) {
      await radios.nth(i).scrollIntoViewIfNeeded();
      await radios.nth(i).check({ force: true });
      await page.waitForTimeout(1500);
      await page.evaluate(() => document.querySelector('[data-dev-overlay]')?.style.setProperty('display', 'none'));
      const shot = await page.screenshot({ type: 'png' });
      await sharp(shot)
        .resize({ width: Math.min(1000, width) })
        .jpeg({ quality: 70, mozjpeg: true })
        .toFile(path.join(here, `${width}x${height}-${scheme}-restoration-level-${i + 1}.jpg`));
    }
    await context.close();
  }
}
await browser.close();
