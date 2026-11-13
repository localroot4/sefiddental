// The clinic's own photos into the preview's photo slots (public/demo-photos, src/lib/demoPhotos.ts):
// the same files the stock photos had, so the slots need no code change. Each source is a photo
// of the clinic in content/photos/clinic; a 3:2 (`wide`) or 4:5 (`tall`) crop at its focal point,
// then AVIF (quality 50) and WebP (quality 72) at the widths of src/lib/demoPhotos.ts.
//   node scripts/clinic-photos.mjs
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'content/photos/clinic');
const OUT = path.join(root, 'public/demo-photos');

// Widths per slot kind (src/lib/demoPhotos.ts DEMO_KINDS and DEMO_HERO).
const KIND = {
  hero: { wide: [1280, 1600, 1920, 2560], tall: [640, 828, 1080] },
  frame: { wide: [960, 1440], tall: [640, 1080] },
  card: { wide: [640, 1280], tall: [] },
  portrait: { wide: [], tall: [640, 1080] },
};

/** Slot → source file, focal point (0..1) and zoom per crop. */
const SLOTS = {
  hero: {
    kind: 'hero',
    wide: ['treatment-at-work.jpg', 0.45, 0.5],
    tall: ['room-chair.jpg', 0.5, 0.45],
  },
  'services-hub': {
    kind: 'frame',
    wide: ['room-window.jpg', 0.5, 0.5],
    tall: ['room-window.jpg', 0.55, 0.5],
  },
  cosmetic: {
    kind: 'frame',
    wide: ['exam-smile.jpg', 0.6, 0.5],
    tall: ['exam-smile.jpg', 0.6, 0.5],
  },
  'surgery-replacement': {
    kind: 'frame',
    wide: ['implant-kit.jpg', 0.5, 0.5],
    tall: ['implant-kit.jpg', 0.45, 0.5],
  },
  restorative: {
    kind: 'frame',
    wide: ['curing-light.jpg', 0.5, 0.5],
    tall: ['curing-light.jpg', 0.45, 0.5],
  },
  orthodontics: {
    kind: 'frame',
    wide: ['braces-mirror.jpg', 0.5, 0.5],
    tall: ['braces-mirror.jpg', 0.5, 0.5],
  },
  pediatric: {
    kind: 'frame',
    wide: ['desk-toys.jpg', 0.5, 0.5],
    tall: ['desk-toys.jpg', 0.45, 0.5],
  },
  about: { kind: 'frame', wide: ['lounge.jpg', 0.5, 0.55], tall: ['reception.jpg', 0.5, 0.6] },
  'guide-hub': {
    kind: 'frame',
    wide: ['doctor-monitor.jpg', 0.5, 0.5],
    tall: ['doctor-monitor.jpg', 0.35, 0.5],
  },
  'dentists-hub': {
    kind: 'frame',
    wide: ['doctor-treating.jpg', 0.45, 0.45],
    tall: ['doctor-treating.jpg', 0.3, 0.45],
  },
  'workflow-scan': { kind: 'card', wide: ['scan-screen.jpg', 0.5, 0.5] },
  'workflow-design': { kind: 'card', wide: ['xray-review.jpg', 0.6, 0.45] },
  'workflow-make': { kind: 'card', wide: ['implant-parts.jpg', 0.5, 0.5] },
  'workflow-smile': { kind: 'card', wide: ['smile-exam.jpg', 0.6, 0.5] },
  'shade-guide': { kind: 'card', wide: ['instrument-tray.jpg', 0.5, 0.5] },
  'dentist-1': { kind: 'portrait', tall: ['dr-woman.jpg', 0.5, 0.36, 1.5] },
  'dentist-2': { kind: 'portrait', tall: ['dr-man.jpg', 0.5, 0.33, 1.5] },
  'voice-1': { kind: 'portrait', tall: ['smile-braces.jpg', 0.5, 0.5, 1.2] },
  'voice-2': { kind: 'portrait', tall: ['smile-mirror.jpg', 0.45, 0.5, 1.2] },
  'voice-3': { kind: 'portrait', tall: ['curing-shield.jpg', 0.4, 0.5, 1.2] },
};

/** The largest `ratio` box around (fx, fy) inside the image, shrunk by `zoom`, kept inside. */
function cropBox(w, h, ratio, fx, fy, zoom = 1) {
  let cw = w;
  let ch = Math.round(w / ratio);
  if (ch > h) {
    ch = h;
    cw = Math.round(h * ratio);
  }
  cw = Math.round(cw / zoom);
  ch = Math.round(ch / zoom);
  const left = Math.min(w - cw, Math.max(0, Math.round(fx * w - cw / 2)));
  const top = Math.min(h - ch, Math.max(0, Math.round(fy * h - ch / 2)));
  return { left, top, width: cw, height: ch };
}

async function encode(slot, crop, [file, fx, fy, zoom], widths) {
  const src = sharp(path.join(SRC, file)).rotate();
  const { width, height } = await src.metadata();
  const box = cropBox(width, height, crop === 'wide' ? 3 / 2 : 4 / 5, fx, fy, zoom);
  for (const w of widths) {
    const base = path.join(OUT, `${slot}-${crop === 'tall' ? 'p' : ''}${w}`);
    const img = sharp(path.join(SRC, file)).rotate().extract(box).resize({ width: w });
    await img.clone().avif({ quality: 50 }).toFile(`${base}.avif`);
    await img.clone().webp({ quality: 72 }).toFile(`${base}.webp`);
  }
  return `${slot} ${crop} ${file} ${box.width}x${box.height}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(OUT, { recursive: true });
  for (const [slot, spec] of Object.entries(SLOTS)) {
    for (const crop of ['wide', 'tall']) {
      if (spec[crop]) console.log(await encode(slot, crop, spec[crop], KIND[spec.kind][crop]));
    }
  }
}
