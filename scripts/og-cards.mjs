// Share cards per page type (phase 6, H14): renders design/og/card.html once per card in
// Playwright's Chromium, so a real browser shapes the Persian text (next/og's Satori does not),
// and writes design/brand/og/<card>.png at 1200x630. The PNGs are committed and copied to
// public/brand/og by sync-public-assets.mjs; nothing renders on the host. Run by hand after a
// copy or template change, then look at every PNG (letter joining, right-to-left order):
//   node scripts/og-cards.mjs
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'design', 'brand', 'og');
// As check-bundle.mjs: the repo .env names the container Chromium (PW_CHROMIUM_EXECUTABLE).
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
// Both modules use only erasable TypeScript, so Node 22 imports them directly.
const ts = (...p) => import(pathToFileURL(path.join(root, ...p)).href);
const { OG_CARDS, ogCardCopy } = await ts('src', 'i18n', 'fa-seo.ts');
const { defaultLaunch } = await ts('tests', 'helpers', 'launch.ts');

mkdirSync(outDir, { recursive: true });
// A card removed from OG_CARDS leaves no stale file behind.
for (const file of readdirSync(outDir)) rmSync(path.join(outDir, file));

const browser = await chromium.launch(defaultLaunch());
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(path.join(root, 'design', 'og', 'card.html')).href);
  for (const card of OG_CARDS) {
    const { title, line } = ogCardCopy(card);
    const problem = await page.evaluate(
      async ([titleText, lineText]) => {
        document.getElementById('title').textContent = titleText;
        document.getElementById('line').textContent = lineText;
        await document.fonts.ready;
        if (
          !document.fonts.check('700 64px Estedad') ||
          !document.fonts.check('500 32px Vazirmatn')
        ) {
          return 'the brand fonts did not load (design/fonts)';
        }
        if ([...document.images].some((img) => !img.complete || img.naturalWidth === 0)) {
          return 'a logo image did not load (design/brand)';
        }
        const long = ['title', 'line'].find((id) => {
          const el = document.getElementById(id);
          return (
            el.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(el).lineHeight) + 1
          );
        });
        return long ? `#${long} needs more than two lines; shorten it in fa-seo.ts` : null;
      },
      [title, line],
    );
    if (problem) throw new Error(`og-cards: ${card}: ${problem}`);
    await page.screenshot({ path: path.join(outDir, `${card}.png`), type: 'png' });
  }
} finally {
  await browser.close();
}

console.log(`og-cards: ${OG_CARDS.length} cards written to ${path.relative(root, outDir)}`);
