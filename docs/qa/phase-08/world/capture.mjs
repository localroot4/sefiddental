// Phase 8 WORLD lane evidence: screenshots of the world scenes in both themes at 1440x900 and
// 390x844, and the contrast of every visible text line over the canvas (the text is painted
// transparent for a second shot, so each line's own box shows the world behind it).
//   node docs/qa/phase-08/world/capture.mjs <origin> [--tier=3]
// (after `npm run build` and `npm run db:e2e`, with the standalone server on <origin>; Chromium
// from PW_CHROMIUM_EXECUTABLE, WebGL on SwiftShader)
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const here = path.dirname(fileURLToPath(import.meta.url));
const origin = process.argv[2] ?? 'http://localhost:3000';
const tier = process.argv.find((a) => a.startsWith('--tier='))?.slice(7) ?? '3';
const SIZES = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];
// Each shot: a scroll target (a selector and an offset in viewport heights from its top).
const SHOTS = [
  { name: 'scene2-hero-exit', selector: '[data-scene="trust"]', offset: -0.55 },
  { name: 'scene2-hero-exit-late', selector: '[data-scene="trust"]', offset: 0 },
  { name: 'scene3-services', selector: '[data-scene="services"]', offset: 1.2 },
  { name: 'scene9-first-visit', selector: '[data-scene="first-visit"]', offset: 0.1 },
  { name: 'scene10-booking', selector: '[data-scene="booking"]', offset: 0.2 },
];

/** WCAG relative luminance of an sRGB triple (0..255). */
const luminance = ([r, g, b]) => {
  const c = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM_EXECUTABLE || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const report = [];
for (const size of SIZES) {
  for (const theme of ['light', 'dark']) {
    const phone = size.width < 744;
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      colorScheme: theme,
      locale: 'fa-IR',
      hasTouch: phone,
      isMobile: phone,
    });
    await context.addInitScript(() => sessionStorage.setItem('sefid-intro', '1'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/?tier=${tier}`, { waitUntil: 'load' });
    // The first scroll loads the world; one viewport down the photo no longer covers it.
    await page.evaluate(() => window.scrollTo({ top: innerHeight, behavior: 'instant' }));
    await page
      .waitForFunction(() => document.querySelector('canvas')?.style.opacity === '1', null, {
        timeout: 30_000,
      })
      .catch(() => errors.push('no canvas frame within 30 s'));
    for (const shot of SHOTS) {
      await page.evaluate(({ selector, offset }) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const top = el.getBoundingClientRect().top + window.scrollY + offset * window.innerHeight;
        window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      }, shot);
      await page.waitForTimeout(4000);
      const file = `${shot.name}-${size.width}x${size.height}-${theme}.png`;
      await page.screenshot({ path: path.join(here, file) });
      // Text lines inside the viewport, with their colour, from the elements whose own text nodes
      // are visible.
      const lines = await page.evaluate(() => {
        const out = [];
        const walker = document.createTreeWalker(document.querySelector('main') ?? document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement;
          if (!el || seen.has(el) || !n.textContent?.trim()) continue;
          seen.add(el);
          const style = getComputedStyle(el);
          if (style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const r of range.getClientRects()) {
            if (r.width < 4 || r.height < 4 || r.top < 0 || r.bottom > innerHeight) continue;
            // Only text that is on top at its box's centre (not under the header or the bar).
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (!hit || !(el === hit || el.contains(hit) || hit.contains(el))) continue;
            const m = style.color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0];
            out.push({ text: n.textContent.trim().slice(0, 30), rect: [r.left, r.top, r.width, r.height], color: m.slice(0, 3) });
          }
        }
        return out;
      });
      // CSSOM writes: the page CSP refuses an injected <style>.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('body *')) {
          el.style.setProperty('transition', 'none', 'important');
          el.style.setProperty('color', 'transparent', 'important');
          el.style.setProperty('text-decoration-color', 'transparent', 'important');
        }
      });
      await page.waitForTimeout(300);
      const bare = (await page.screenshot()).toString('base64');
      const backgrounds = await page.evaluate(async ({ png, lines }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${png}`;
        await img.decode();
        const c = new OffscreenCanvas(img.width, img.height);
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return lines.map(({ rect: [x, y, w, h] }) => {
          const data = g.getImageData(Math.max(0, Math.floor(x)), Math.max(0, Math.floor(y)), Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))).data;
          const px = [];
          for (let i = 0; i < data.length; i += 4 * 3) px.push([data[i], data[i + 1], data[i + 2]]);
          return px;
        });
      }, { png: bare, lines });
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('body *')) {
          el.style.removeProperty('transition');
          el.style.removeProperty('color');
          el.style.removeProperty('text-decoration-color');
        }
      });
      let worst = null;
      lines.forEach((line, i) => {
        const ratios = backgrounds[i].map((p) => ratio(line.color, p)).sort((a, b) => a - b);
        // 2nd percentile: a single dust grain under a glyph is not the background.
        const low = ratios[Math.floor(ratios.length * 0.02)] ?? 21;
        if (worst === null || low < worst.ratio) {
          worst = { ratio: Math.round(low * 100) / 100, text: line.text, rect: line.rect.map(Math.round) };
        }
      });
      report.push({ file, lines: lines.length, worst, errors: [...errors] });
      console.log(file, lines.length, 'lines, lowest text contrast', worst);
    }
    await context.close();
  }
}
await browser.close();
writeFileSync(path.join(here, 'contrast.json'), `${JSON.stringify(report, null, 2)}\n`);
