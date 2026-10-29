// Copies generated public assets from their single sources; runs before `dev` and `build`.
// Outputs are gitignored: design/ stays the one source of brand files and fonts.
//   design/brand/*                         -> public/brand/
//   design/brand/og/*.png                  -> public/brand/og/ (share cards, scripts/og-cards.mjs)
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
  readdirSync,
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

// Share cards per page type (H14): the whole folder, so a removed card leaves no stale file.
const cardsOut = path.join(pub, 'brand', 'og');
rmSync(cardsOut, { recursive: true, force: true });
cpSync(from('design', 'brand', 'og'), cardsOut, { recursive: true });
const cards = readdirSync(cardsOut).length;

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

// Home hero placeholders (freeze F3, gap 36): an abstract stand-in at the hero widths, so the
// preload, fetchpriority and LCP pipeline is real before the client's photo exists. It is no photo
// and shows no place: a bright room out of focus (daylight through a window, warm neutrals,
// brand-tinted shade) drawn in SVG with three depths of blur, framed 640x360 inside an 80 unit
// margin that keeps the blur edges out of the crops. The 4:5 band is a crop of the same scene, as
// both crops of the photo come from one shoot (DESIGN.md section 4). Files that exist are kept
// while the recipe stamp matches: the encode takes seconds and every `dev` start runs this script.
const HERO_RECIPE = 'room-1'; // change it with the scene, the grain or the encode settings
const HERO_SCENE = `<svg xmlns="http://www.w3.org/2000/svg"
  width="800" height="520" viewBox="-80 -80 800 520">
  <defs>
    <linearGradient id="room" x1="0" y1="0" x2="0" y2="1">
      <stop offset=".15" stop-color="#EEE8DF"/><stop offset=".57" stop-color="#E5DDD1"/>
      <stop offset=".62" stop-color="#D2C7B9"/><stop offset=".85" stop-color="#C0B4A4"/>
    </linearGradient>
    <radialGradient id="day" cx=".56" cy=".3" r=".55">
      <stop offset="0" stop-color="#FFFCF5" stop-opacity=".8"/>
      <stop offset="1" stop-color="#FFFCF5" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="edge" cx=".52" cy=".38" r=".85">
      <stop offset=".5" stop-color="#7D7468" stop-opacity="0"/>
      <stop offset="1" stop-color="#7D7468" stop-opacity=".38"/>
    </radialGradient>
    <filter id="far"><feGaussianBlur stdDeviation="8"/></filter>
    <filter id="mid" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16"/>
    </filter>
    <filter id="near" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
  </defs>
  <g filter="url(#far)">
    <rect x="-80" y="-80" width="800" height="520" fill="url(#room)"/>
    <path d="M292 34h56v176h-56zM354 34h56v176h-56zM416 34h56v176h-56z" fill="#FFFCF6"/>
  </g>
  <rect x="-40" y="-40" width="720" height="440" fill="url(#day)"/>
  <g filter="url(#mid)">
    <path d="M292 248H472L548 330H236Z" fill="#FBF3E7" opacity=".7"/>
    <rect x="34" y="92" width="118" height="300" rx="34" fill="#B7CBC7" opacity=".72"/>
    <ellipse cx="214" cy="272" rx="62" ry="44" fill="#E8C9A7" opacity=".6"/>
    <rect x="540" y="150" width="110" height="230" rx="34" fill="#BFD1CE" opacity=".7"/>
  </g>
  <g filter="url(#near)">
    <ellipse cx="70" cy="392" rx="190" ry="80" fill="#A4988A" opacity=".6"/>
    <ellipse cx="640" cy="384" rx="150" ry="70" fill="#9AAFAB" opacity=".45"/>
  </g>
  <rect x="-40" y="-40" width="720" height="440" fill="url(#edge)"/>
</svg>`;
const { heroPlaceholderFiles } = await import(
  pathToFileURL(from('src', 'components', 'home', 'heroPlaceholder.ts')).href
);
const { default: sharp } = await import('sharp');
const placeholderDir = path.join(pub, 'placeholders');
const stamp = path.join(placeholderDir, 'recipe.txt');
const fresh = existsSync(stamp) && readFileSync(stamp, 'utf8') === HERO_RECIPE;
const room = await sharp(Buffer.from(HERO_SCENE)).png().toBuffer();
const crop = (left, width) =>
  sharp(room).extract({ left, top: 80, width, height: 360 }).png().toBuffer();
const scene = { landscape: await crop(80, 640), portrait: await crop(400, 288) };
// Grain noise from an integer hash (lowbias32): the same bytes on every build, no visible lattice.
const hash = (i) => {
  i = Math.imul(i ^ (i >>> 16), 0x7feb352d);
  i = Math.imul(i ^ (i >>> 15), 0x846ca68b);
  return ((i ^ (i >>> 16)) >>> 0) / 2 ** 32 - 0.5;
};
mkdirSync(placeholderDir, { recursive: true });
let placeholders = 0;
for (const { url, width, height } of heroPlaceholderFiles()) {
  const out = path.join(pub, url);
  if (fresh && existsSync(out)) continue;
  const pixels = await sharp(width > height ? scene.landscape : scene.portrait)
    .resize(width, height)
    .removeAlpha()
    .raw()
    .toBuffer();
  // A fine film grain, ±6 of 255 at half size scaled up, added to the luminance: it holds every
  // file near 0.17 bits per pixel in AVIF and 0.1 in JPEG, at least twice the low-entropy LCP cut
  // (0.05) and far under the storyboard byte caps. A smooth image alone encodes to about 0.02.
  const half = { width: Math.ceil(width / 2), height: Math.ceil(height / 2), channels: 1 };
  const noise = Uint8Array.from({ length: half.width * half.height }, (_, i) =>
    Math.round(128 + 12 * hash(i)),
  );
  const grain = await sharp(noise, { raw: half })
    .resize(width, height, { kernel: 'cubic' })
    .raw()
    .toBuffer();
  const rgb = new Uint8ClampedArray(pixels.buffer, pixels.byteOffset, pixels.length);
  for (let i = 0; i < rgb.length; i++) rgb[i] += grain[(i / 3) | 0] - 128;
  const image = sharp(pixels, { raw: { width, height, channels: 3 } });
  await (
    url.endsWith('.avif')
      ? image.avif({ quality: 50, effort: 2 })
      : image.jpeg({ quality: 60, mozjpeg: true })
  ).toFile(out);
  placeholders++;
}
writeFileSync(stamp, HERO_RECIPE);

console.log(
  `sync-public-assets: ${copies.length} brand and font files, ${cards} share cards, favicon.ico, detect-gpu benchmarks, brand/icons.svg (${Object.keys(ICONS).length} icons), ${placeholders} hero placeholders written; maintenance.html and brand/lockup.svg ${maintenance}`,
);
