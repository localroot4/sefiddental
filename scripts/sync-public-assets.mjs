// Copies generated public assets from their single sources; runs before `dev` and `build`.
// Outputs are gitignored: design/ stays the one source of brand files and fonts.
//   design/brand/*                         -> public/brand/
//   design/fonts/*                         -> public/fonts/  (static 503 and 410 pages; next/font
//                                             reads Vazirmatn-wght.woff2: no brackets in its URL)
//   src/lib/system-pages/staticPage.ts     -> public/maintenance.html (platform serves it when Node is down)
//                                             and public/brand/lockup.svg (the header logo sprite)
//   src/components/ui/icons.ts             -> public/brand/icons.svg (Phosphor and brand-mark sprite)
//   node_modules/detect-gpu/dist/benchmarks -> public/detect-gpu/benchmarks/ (no third-party CDN)
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

// /favicon.ico for clients that ask for it without reading the icon links (feed readers, some
// browsers on non-HTML responses): the 32 px PNG in an ICO container (PNG entries are valid ICO).
const png = readFileSync(from('design', 'brand', 'favicon-32.png'));
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2); // type: icon
ico.writeUInt16LE(1, 4); // one image
ico.writeUInt8(32, 6); // width
ico.writeUInt8(32, 7); // height
ico.writeUInt16LE(1, 10); // color planes
ico.writeUInt16LE(32, 12); // bits per pixel
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(ico.length, 18); // image offset
writeFileSync(path.join(pub, 'favicon.ico'), Buffer.concat([ico, png]));

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
  const { renderStaticSystemPage, LOCKUP_SPRITE } = await import(pathToFileURL(staticPage).href);
  writeFileSync(path.join(pub, 'maintenance.html'), renderStaticSystemPage('maintenance'));
  writeFileSync(path.join(pub, 'brand', 'lockup.svg'), LOCKUP_SPRITE);
  maintenance = 'written';
}

// Icon sprite (freeze F2): only the names in src/components/ui/icons.ts, whose committed hash
// is the cache-busting query of every <use>; a stale hash fails here instead of in a browser.
const ui = (name) => pathToFileURL(from('src', 'components', 'ui', name)).href;
const { ICONS, ICON_SPRITE_HASH } = await import(ui('icons.ts'));
const { buildIconSprite, iconSourceFile } = await import(ui('iconSprite.ts'));
// Resolved through the package's exports map, wherever npm placed it.
const phosphorAssets = path.resolve(
  fileURLToPath(import.meta.resolve('@phosphor-icons/core/regular/x.svg')),
  '../..',
);
const sprite = buildIconSprite(ICONS, (source) =>
  readFileSync(path.resolve(root, iconSourceFile(source, phosphorAssets)), 'utf8'),
);
if (sprite.hash !== ICON_SPRITE_HASH) {
  console.error(
    `sync-public-assets: the icon sprite hashes to ${sprite.hash}, but ICON_SPRITE_HASH in src/components/ui/icons.ts is ${ICON_SPRITE_HASH}. Set it to ${sprite.hash}.`,
  );
  process.exit(1);
}
writeFileSync(path.join(pub, 'brand', 'icons.svg'), sprite.svg);

// Home hero placeholders (freeze F3): neutral grain rasters at the hero widths, so the preload,
// fetchpriority and LCP pipeline is real before the client's photo exists (gap 36). Files that
// exist are kept: the encode takes seconds and every `dev` start runs this script.
const { heroPlaceholderFiles } = await import(
  pathToFileURL(from('src', 'components', 'home', 'heroPlaceholder.ts')).href
);
const { default: sharp } = await import('sharp');
let placeholders = 0;
for (const file of heroPlaceholderFiles()) {
  const out = path.join(pub, file.url);
  if (existsSync(out)) continue;
  mkdirSync(path.dirname(out), { recursive: true });
  // Soft grain around a light neutral grey (noise at a quarter size, scaled up): about 0.15 bits
  // per pixel, three times the low-entropy LCP cut, a quarter of the storyboard byte caps.
  const seed = await sharp({
    create: {
      width: Math.round(file.width / 4),
      height: Math.round(file.height / 4),
      channels: 3,
      noise: { type: 'gaussian', mean: 128, sigma: 40 },
    },
  })
    .linear(0.12, 200 - 0.12 * 128)
    .png()
    .toBuffer();
  const grain = sharp(seed).resize(file.width, file.height, { kernel: 'cubic' });
  await (
    file.url.endsWith('.avif')
      ? grain.avif({ quality: 40, effort: 2 })
      : grain.jpeg({ quality: 50, mozjpeg: true })
  ).toFile(out);
  placeholders++;
}

console.log(
  `sync-public-assets: ${copies.length} brand and font files, favicon.ico, detect-gpu benchmarks, brand/icons.svg (${Object.keys(ICONS).length} icons), ${placeholders} hero placeholders written; maintenance.html and brand/lockup.svg ${maintenance}`,
);
