// Polish evidence (docs/experience/journey.md): the home page at every dock and half way through
// every travel, the hero idle and its descent, the D5 hand-off and the D6 arrival in sixths, D3's
// restoration per level (playing and at rest), and the intro hand-off (the courier in the intro
// mark's hole, then its glide to D1), at 1440x900, 854x1280 and 390x844, light and dark, tiers 2
// and 1. JPEG, at most 1000 px wide.
//   node docs/qa/polish/capture.mjs <origin> [--sizes=1440x900,854x1280,390x844] [--tiers=2,1]
//     [--schemes=light,dark] [--only=docks|hero|d5|d6|d3|intro]
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
const only = arg('only', 'docks,hero,d5,d6,d3,intro');

const jpeg = (png, file, width) =>
  sharp(png).resize({ width: Math.min(1000, width) }).jpeg({ quality: 70, mozjpeg: true }).toFile(file);

/**
 * The intro hand-off: screenshots in a loop from the first frame of the overlay, each one timed by
 * the page's own clock against `intro:end`; then the courier in the hole (the last frame before the
 * lift), the first frames of the glide, about 300 and 450 ms in, and D1 at 800 ms.
 */
async function intro(context, width, height, tier, scheme, attempt = 1) {
  const page = await context.newPage();
  await page.goto(`${origin}/?tier=${tier}`, { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement?.dataset.intro === 'playing');
  // The captures load the page: start them once the courier is in the hole (a journey that comes
  // after the intro has no hand-off, as on a slow device).
  await page.waitForFunction(
    () =>
      document.querySelector('[data-courier-lead]') !== null ||
      document.documentElement.dataset.intro === 'done',
  );
  // A new tab plays the intro again (its session flag is per tab).
  if (!(await page.evaluate(() => document.querySelector('[data-courier-lead]') !== null))) {
    await page.close();
    if (attempt < 4) return intro(context, width, height, tier, scheme, attempt + 1);
    return console.log(`${width}x${height} t${tier} ${scheme} intro: the journey came after it`);
  }
  // CDP's fast JPEG capture: Playwright's screenshot is about 400 ms a frame, longer than a step.
  const cdp = await context.newCDPSession(page);
  const shots = [];
  for (;;) {
    const t = await page.evaluate(() => {
      const end = performance.getEntriesByName('intro:end')[0];
      return end ? performance.now() - end.startTime : -1;
    });
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 90,
      optimizeForSpeed: true,
    });
    shots.push({ t, png: Buffer.from(data, 'base64') });
    if (t > 900) break;
  }
  const before = shots.filter((s) => s.t < 0);
  const after = shots.filter((s) => s.t >= 0);
  const near = (ms) => after.reduce((a, b) => (Math.abs(b.t - ms) < Math.abs(a.t - ms) ? b : a));
  const picks = [
    ['1-hole', before.at(-1)],
    ['2-glide', after[0]],
    ['3-glide', near(300)],
    ['4-glide', near(450)],
    ['5-d1', near(800)],
  ];
  for (const [name, shot] of picks) {
    if (!shot) continue;
    await jpeg(shot.png, path.join(here, `${width}x${height}-t${tier}-${scheme}-intro-${name}.jpg`), width);
  }
  console.log(`${width}x${height} t${tier} ${scheme} intro: ${picks.map(([n, s]) => `${n} ${Math.round(s?.t ?? NaN)} ms`).join(', ')}`);
  await page.close();
}

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
      if (only.includes('intro')) await intro(context, width, height, tier, scheme);
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
      const add = (group, name, y, level = 0, wait = 0) => stops.push({ group, name, y, level, wait });
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
      const restoration = find('restoration');
      if (restoration) {
        const span = restoration.end - restoration.start;
        // Tier 2 with pins steps the levels by scroll; elsewhere a chip chooses (each replays).
        for (const [k, f] of [[1, 0.2], [2, 0.5], [3, 0.8]]) {
          add('d3', `d3-level-${k}-playing`, restoration.start + span * f, k, 450);
          add('d3', `d3-level-${k}-rest`, restoration.start + span * f, k, 3200);
        }
      }
      for (const stop of stops) {
        if (!only.includes(stop.group)) continue;
        if (stop.group !== 'd3') continue;
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.ceil(stop.y));
        await page.waitForTimeout(900);
        await page.evaluate((k) => {
          const input = document.querySelectorAll('[data-scene="restoration"] [data-choices] input')[k - 1];
          if (input && !input.checked) input.click();
        }, stop.level);
        await page.waitForTimeout(stop.wait);
        await page.evaluate(() =>
          document.querySelector('[data-dev-overlay]')?.style.setProperty('display', 'none'),
        );
        const shot = await page.screenshot({ type: 'png' });
        await jpeg(shot, path.join(here, `${width}x${height}-t${tier}-${scheme}-${stop.name}.jpg`), width);
        // Away and back, so the next level comes in afresh.
        await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), Math.max(0, restoration.start - 600));
        await page.waitForTimeout(600);
      }
      for (const stop of stops) {
        if (stop.group === 'd3') continue;
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
        await jpeg(shot, path.join(here, `${width}x${height}-t${tier}-${scheme}-${stop.name}.jpg`), width);
      }
      console.log(`${width}x${height} t${tier} ${scheme}: ${stops.filter((s) => only.includes(s.group)).length} shots`);
      await context.close();
    }
  }
}
await browser.close();
