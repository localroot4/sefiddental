// Copies generated public assets from their single sources; runs before `dev` and `build`.
// Outputs are gitignored: design/ stays the one source of brand files and fonts.
//   design/brand/*                         -> public/brand/
//   design/fonts/*                         -> public/fonts/  (static 503 and 410 pages; next/font
//                                             reads Vazirmatn-wght.woff2: no brackets in its URL)
//   src/lib/system-pages/staticPage.ts     -> public/maintenance.html (platform serves it when Node is down)
//   node_modules/detect-gpu/dist/benchmarks -> public/detect-gpu/benchmarks/ (no third-party CDN)
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');
const from = (...p) => path.join(root, ...p);

const copies = [
  ...[
    'favicon.svg',
    'favicon-32.png',
    'favicon-192.png',
    'favicon-512.png',
    'apple-touch-icon.png',
    'og-preview.png',
    'logo-mark.svg',
  ].map((name) => [from('design', 'brand', name), path.join(pub, 'brand', name)]),
  [
    from('design', 'fonts', 'Vazirmatn[wght].woff2'),
    path.join(pub, 'fonts', 'Vazirmatn-wght.woff2'),
  ],
  [from('design', 'fonts', 'Estedad-Bold.woff2'), path.join(pub, 'fonts', 'Estedad-Bold.woff2')],
];

for (const [src, dest] of copies) {
  if (!existsSync(src)) {
    console.error(`sync-public-assets: missing source ${path.relative(root, src)}`);
    process.exit(1);
  }
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

const benchmarks = from('node_modules', 'detect-gpu', 'dist', 'benchmarks');
if (!existsSync(benchmarks)) {
  console.error('sync-public-assets: detect-gpu benchmarks missing. Run `npm ci` first.');
  process.exit(1);
}
const benchmarksOut = path.join(pub, 'detect-gpu', 'benchmarks');
rmSync(benchmarksOut, { recursive: true, force: true });
cpSync(benchmarks, benchmarksOut, { recursive: true });

// The static page module uses only erasable TypeScript, so Node 22 imports it directly.
const staticPage = from('src', 'lib', 'system-pages', 'staticPage.ts');
let maintenance = 'skipped (src/lib/system-pages/staticPage.ts not present yet)';
if (existsSync(staticPage)) {
  const { renderStaticSystemPage } = await import(pathToFileURL(staticPage).href);
  writeFileSync(path.join(pub, 'maintenance.html'), renderStaticSystemPage('maintenance'));
  maintenance = 'written';
}

console.log(
  `sync-public-assets: ${copies.length} brand and font files, detect-gpu benchmarks; maintenance.html ${maintenance}`,
);
