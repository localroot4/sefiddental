// Polish evidence (docs/experience/journey.md): the home page at every dock and half way through
// every travel, the hero idle and its descent, the D5 hand-off and the D6 arrival in sixths, at
// 1440x900, 854x1280 and 390x844, light and dark, tiers 2 and 1. JPEG, at most 1000 px wide.
//   node docs/qa/polish/capture.mjs <origin> [--sizes=1440x900,854x1280,390x844] [--tiers=2,1]
//     [--schemes=light,dark] [--only=docks|hero|d5|d6]
// (after `npm run build` and `npm run db:e2e`, with the standalone server on <origin>, DEMO_CONTENT
// on; Chromium from PW_CHROMIUM_EXECUTABLE, WebGL on SwiftShader)
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const origin = process.argv[2] ?? 'http://localhost:3000';
const arg = (name, fallback) =>
  (process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback).split(',');
const sizes = arg('sizes', '1440x900,854x1280,390x844').map((s) => s.split('x').map(Number));
const tiers = arg('tiers', '2,1');
const schemes = arg('schemes', 'light,dark');
const only = arg('only', 'docks,hero,d5,d6');

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_EXECUTABLE,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
mkdirSync(here, { recursive: true });
for (const [width, height] of sizes) {
  const touch = width < 1024;
  for (const tier of tiers) {
    for (const scheme of schemes) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: scheme,
        locale: 'fa-IR',
        hasTouch: touch,
        isMobile: touch && width < 744,
      });
      await context.addInitScript(() => sessionStorage.setItem('sefid-intro', '1'));
      const page = await context.newPage();
      await page.goto(`${origin}/?tier=${tier}&debug=1`);
      await page.waitForLoadState('load');
      await page.waitForFunction(() => window.__sefidJourney, null, { timeout: 30_000 });
      if (tier !== '1') {
        await page
          .waitForFunction(() => window.__sefidJourney.webgl(), null, { timeout: 90_000 })
          .catch(() => console.log('no WebGL courier'));
      }
      await page.waitForTimeout(1500);
      await page.evaluate(() => window.__sefidJourney.measure());
      const holds = await page.evaluate(() => window.__sefidJourney.holds());
      const find = (id) => holds.find((h) => h.id === id);
      const stops = [];
      const add = (group, name, y) => stops.push({ group, name, y });
      holds.forEach((h, i) => {
        const at = h.id === 'footer' ? h.start + 2 : (h.start + h.end) / 2;
        add('docks', `${String(i + 1).padStart(2, '0')}-dock-${h.id}`, at);
        const next = holds[i + 1];
        if (next) add('docks', `${String(i + 1).padStart(2, '0')}-travel-${h.id}-${next.id}`, (h.end + next.start) / 2);
      });
      const hero = find('hero');
      const services = find('services');
      if (hero) {
        add('hero', 'hero-idle', 0);
        if (services) for (let k = 1; k <= 6; k += 1) add('hero', `hero-descent-${k}of6`, hero.end + ((services.start - hero.end) * k) / 6);
      }
      const smile = find('smile');
      const dentists = find('dentists');
      if (smile) {
        for (const l of [0.1, 0.3, 0.46, 0.6, 0.75, 0.86, 1]) add('d5', `d5-station-${Math.round(l * 100)}`, smile.start + (smile.end - smile.start) * l);
        if (dentists) for (let k = 1; k <= 6; k += 1) add('d5', `d5-handoff-${k}of6`, smile.end + ((dentists.start - smile.end) * k) / 6);
      }
      if (dentists) {
        const prev = holds[holds.indexOf(dentists) - 1];
        if (prev) for (let k = 3; k <= 6; k += 1) add('d6', `d6-arrival-${k}of6`, prev.end + ((dentists.start - prev.end) * k) / 6);
        add('d6', 'd6-rest', (dentists.start + dentists.end) / 2);
      }
      for (const stop of stops) {
        if (!only.includes(stop.group)) continue;
        for (let k = 0; k < 2; k += 1) {
          await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.ceil(stop.y));
          await page.waitForTimeout(700);
        }
        await page.evaluate(() =>
          document.querySelector('[data-dev-overlay]')?.style.setProperty('display', 'none'),
        );
        await page.waitForTimeout(400);
        const shot = await page.screenshot({ type: 'png' });
        const file = path.join(here, `${width}x${height}-t${tier}-${scheme}-${stop.name}.jpg`);
        await sharp(shot).resize({ width: Math.min(1000, width) }).jpeg({ quality: 70, mozjpeg: true }).toFile(file);
      }
      console.log(`${width}x${height} t${tier} ${scheme}: ${stops.filter((s) => only.includes(s.group)).length} shots`);
      await context.close();
    }
  }
}
await browser.close();
