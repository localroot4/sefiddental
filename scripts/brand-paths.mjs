// Precomputes the morph shapes of home scene 3 (phase 7 report, lane SERVICES; prototype 0b,
// C15): the simplified brand mark (the prototype 0a `mark-clip` outline) and the silhouette of
// each category icon (the Phosphor duotone files the sprite public/brand/icons.svg is built
// from), all on one 256 grid, every outline resampled to the same point count with the same
// orientation and start corner. MorphSVG then tweens the
// pairs point for point (`precompile`), so no O(n^2) shape matching runs in the browser.
// Writes src/brand/serviceIconPaths.ts; scripts/brand-paths.test.ts fails when that file is stale.
//   node scripts/brand-paths.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import prettier from 'prettier';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'src/brand/serviceIconPaths.ts');

/** Points per outline: 72 keeps the mark's corners within 2 px at 96 px (one every 11 units). */
export const POINTS = 72;
export const GRID = 256;
/** Icons fill 24..232 of their 256 grid; the mark is scaled to the same 208 unit height. */
const ICON_INSET = 24;
/** A turn sharper than this at a vertex is a corner the resampling keeps. */
const CORNER_DEG = 30;

/** The simplified mark: the prototype 0a clip outline (design/prototypes/0a-intro.html). */
export const MARK_PATH =
  'M990.5 333.7L990.5 163C990.5 143 1007 127 1027 127L1083.5 127L1047 191.5L1088 137Q1104 125 1125 127C1145 129 1158 145 1158 163L1158 333.7L1128 333.7L1080 276L1113.8 216.7L1018 333.8Z';

/** Accent to its default duotone Phosphor icon, as src/components/ui/Cards.tsx resolves it. */
export const GLYPHS = {
  cosmetic: 'sparkle',
  surgery: 'bandaids',
  restorative: 'tooth',
  ortho: 'smiley',
  kids: 'baby',
};

/** The duotone icon file, resolved through the package's exports map like the sprite build. */
export const iconFile = (glyph) =>
  fileURLToPath(import.meta.resolve(`@phosphor-icons/core/duotone/${glyph}-duotone.svg`));

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
const LETTER = /^[A-Za-z]$/;

/**
 * Absolute commands of SVG path data: M, L, C, Q, A and Z only (H, V, S and T are rewritten,
 * relative commands resolved, implicit repeats expanded).
 */
export function parsePath(d) {
  const tokens = d.match(TOKEN) ?? [];
  const out = [];
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  // The last control point, for S and T reflections.
  let control = null;
  const num = () => {
    const token = tokens[i++];
    if (token === undefined || LETTER.test(token)) {
      throw new Error(`brand-paths: a number was expected at token ${i} of "${d.slice(0, 40)}"`);
    }
    return Number(token);
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (LETTER.test(token)) {
      cmd = token;
      i += 1;
      if (cmd === 'Z' || cmd === 'z') {
        out.push({ c: 'Z' });
        x = sx;
        y = sy;
        control = null;
        continue;
      }
    } else if (cmd === 'M') cmd = 'L';
    else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase();
    const ax = (v) => (rel ? x + v : v);
    const ay = (v) => (rel ? y + v : v);
    const reflect = (type) =>
      control && control.type === type ? [2 * x - control.x, 2 * y - control.y] : [x, y];
    switch (cmd.toUpperCase()) {
      case 'M': {
        x = ax(num());
        y = ay(num());
        sx = x;
        sy = y;
        out.push({ c: 'M', x, y });
        control = null;
        break;
      }
      case 'L': {
        x = ax(num());
        y = ay(num());
        out.push({ c: 'L', x, y });
        control = null;
        break;
      }
      case 'H': {
        x = ax(num());
        out.push({ c: 'L', x, y });
        control = null;
        break;
      }
      case 'V': {
        y = ay(num());
        out.push({ c: 'L', x, y });
        control = null;
        break;
      }
      case 'C':
      case 'S': {
        const [x1, y1] = cmd.toUpperCase() === 'C' ? [ax(num()), ay(num())] : reflect('C');
        const x2 = ax(num());
        const y2 = ay(num());
        x = ax(num());
        y = ay(num());
        out.push({ c: 'C', x1, y1, x2, y2, x, y });
        control = { type: 'C', x: x2, y: y2 };
        break;
      }
      case 'Q':
      case 'T': {
        const [x1, y1] = cmd.toUpperCase() === 'Q' ? [ax(num()), ay(num())] : reflect('Q');
        x = ax(num());
        y = ay(num());
        out.push({ c: 'Q', x1, y1, x, y });
        control = { type: 'Q', x: x1, y: y1 };
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const x0 = x;
        const y0 = y;
        x = ax(num());
        y = ay(num());
        out.push({ c: 'A', rx, ry, rot, large, sweep, x0, y0, x, y });
        control = null;
        break;
      }
      default:
        throw new Error(`brand-paths: unsupported path command "${cmd}"`);
    }
  }
  return out;
}

/** Points of an elliptical arc from (x1, y1), SVG implementation notes F.6.5, `steps` per quarter. */
function arcPoints(a, steps) {
  const { x0: x1, y0: y1, x: x2, y: y2, large, sweep } = a;
  if (x1 === x2 && y1 === y2) return [];
  let rx = Math.abs(a.rx);
  let ry = Math.abs(a.ry);
  if (rx === 0 || ry === 0) return [[x2, y2]];
  const phi = (a.rot * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const numer = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const denom = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, numer / denom));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const theta = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let delta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  else if (sweep && delta < 0) delta += 2 * Math.PI;
  const n = Math.max(2, Math.ceil((Math.abs(delta) / (Math.PI / 2)) * steps));
  const points = [];
  for (let k = 1; k <= n; k += 1) {
    const t = theta + (delta * k) / n;
    points.push([
      cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx,
      sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy,
    ]);
  }
  return points;
}

/** Closed polylines (one per subpath) of parsed commands; curves sampled at `steps` points. */
export function flatten(commands, steps = 16) {
  const subpaths = [];
  let current = null;
  let x = 0;
  let y = 0;
  for (const cmd of commands) {
    if (cmd.c === 'M') {
      current = [[cmd.x, cmd.y]];
      subpaths.push(current);
      x = cmd.x;
      y = cmd.y;
      continue;
    }
    if (cmd.c === 'Z') {
      if (current?.length) [x, y] = current[0];
      continue;
    }
    if (current === null) throw new Error('brand-paths: path data must start with M');
    if (cmd.c === 'L') current.push([cmd.x, cmd.y]);
    else if (cmd.c === 'C' || cmd.c === 'Q') {
      for (let k = 1; k <= steps; k += 1) {
        const t = k / steps;
        const u = 1 - t;
        current.push(
          cmd.c === 'C'
            ? [
                u * u * u * x + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x,
                u * u * u * y + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y,
              ]
            : [
                u * u * x + 2 * u * t * cmd.x1 + t * t * cmd.x,
                u * u * y + 2 * u * t * cmd.y1 + t * t * cmd.y,
              ],
        );
      }
    } else if (cmd.c === 'A') current.push(...arcPoints(cmd, steps));
    x = cmd.x;
    y = cmd.y;
  }
  return subpaths;
}

/** Twice the signed area (shoelace); the sign is the winding. */
export function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** The subpath with the largest area: the icon's silhouette, not its holes or details. */
export function silhouette(subpaths) {
  let best = null;
  for (const points of subpaths) {
    if (best === null || Math.abs(signedArea(points)) > Math.abs(signedArea(best))) best = points;
  }
  if (best === null) throw new Error('brand-paths: no subpath');
  return best;
}

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Drops repeated consecutive points and a closing point equal to the first. */
function dedupe(points) {
  const out = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-6) out.push(p);
  }
  if (out.length > 1 && dist(out[0], out[out.length - 1]) <= 1e-6) out.pop();
  return out;
}

/** Turn angle in degrees at point i of a closed polyline. */
function turnAt(points, i) {
  const m = points.length;
  const a = points[(i - 1 + m) % m];
  const b = points[i];
  const c = points[(i + 1) % m];
  const t1 = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const t2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let d = Math.abs(t2 - t1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

/** The points from index `start` to `end` inclusive, cyclic; the whole loop when they are equal. */
function arcPolyline(points, start, end) {
  const m = points.length;
  const out = [points[start]];
  for (let i = (start + 1) % m; ; i = (i + 1) % m) {
    out.push(points[i]);
    if (i === end) break;
  }
  return out;
}

const polylineLength = (poly) =>
  poly.reduce((sum, p, i) => sum + (i ? dist(poly[i - 1], p) : 0), 0);

/** The point at distance `at` from the start of an open polyline. */
function along(poly, at) {
  let left = at;
  for (let i = 1; i < poly.length; i += 1) {
    const d = dist(poly[i - 1], poly[i]);
    if (left <= d) {
      const t = d === 0 ? 0 : left / d;
      const [ax, ay] = poly[i - 1];
      return [ax + (poly[i][0] - ax) * t, ay + (poly[i][1] - ay) * t];
    }
    left -= d;
  }
  return poly[poly.length - 1];
}

/**
 * `n` points along a closed polyline: every corner (a turn over `cornerDeg`) stays a point and the
 * rest spread by arc length between corners, so the mark keeps its angles while a circle stays
 * uniform. The polyline is oriented to a positive winding first.
 */
export function resample(polyline, n = POINTS, cornerDeg = CORNER_DEG) {
  let points = dedupe(polyline);
  if (points.length < 3) throw new Error('brand-paths: a contour needs three points');
  if (signedArea(points) < 0) points = points.reverse();
  const m = points.length;
  let corners = [];
  for (let i = 0; i < m; i += 1) if (turnAt(points, i) > cornerDeg) corners.push(i);
  if (corners.length === 0) corners = [0];
  if (corners.length > n) {
    throw new Error(`brand-paths: ${corners.length} corners do not fit in ${n} points`);
  }
  // The open polyline from each corner to the next (the whole loop for a single corner).
  const arcs = corners.map((start, k) =>
    arcPolyline(points, start, corners[(k + 1) % corners.length]),
  );
  const lengths = arcs.map(polylineLength);
  // Points per arc beyond its start corner: largest remainder over the free points.
  const free = n - corners.length;
  const total = lengths.reduce((a, b) => a + b, 0);
  const shares = lengths.map((length) => (length / total) * free);
  const counts = shares.map(Math.floor);
  let rest = free - counts.reduce((a, b) => a + b, 0);
  const order = shares
    .map((share, k) => [share - Math.floor(share), k])
    .sort((a, b) => b[0] - a[0]);
  for (const [, k] of order) {
    if (rest === 0) break;
    counts[k] += 1;
    rest -= 1;
  }
  const out = [];
  arcs.forEach((arc, k) => {
    out.push(arc[0]);
    for (let j = 1; j <= counts[k]; j += 1)
      out.push(along(arc, (lengths[k] * j) / (counts[k] + 1)));
  });
  return out;
}

/** Rotates the list so the topmost point (then the leftmost) is first: the same start corner everywhere. */
export function startAtTop(points) {
  let best = 0;
  points.forEach((p, i) => {
    const b = points[best];
    if (p[1] < b[1] - 1e-9 || (Math.abs(p[1] - b[1]) <= 1e-9 && p[0] < b[0])) best = i;
  });
  return [...points.slice(best), ...points.slice(0, best)];
}

/** Scales a contour into the icon box of the grid (height 208, centered), as the icons sit. */
export function fitToGrid(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const height = Math.max(...ys) - minY;
  const width = Math.max(...xs) - minX;
  const scale = (GRID - 2 * ICON_INSET) / height;
  const offsetX = (GRID - width * scale) / 2;
  return points.map(([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + ICON_INSET]);
}

/** Integer path data (0.2 px at 96 px): `M x y L x y ... Z`. */
export function toPathData(points) {
  return `M${points.map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L')}Z`;
}

/** The `d` attributes of an SVG file's paths. */
export function pathData(svg) {
  return [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
}

/** The contour to morph: the largest subpath across the icon's paths (the silhouette). */
export function iconOutline(svg) {
  const subpaths = pathData(svg).flatMap((d) => flatten(parsePath(d)));
  if (subpaths.length === 0) throw new Error('brand-paths: the icon file has no path');
  return toPathData(startAtTop(resample(silhouette(subpaths))));
}

/** The generated module's text (Prettier-formatted); `read` returns an icon file's text by glyph. */
export async function generate(read = (glyph) => readFileSync(iconFile(glyph), 'utf8')) {
  const mark = toPathData(
    startAtTop(resample(fitToGrid(silhouette(flatten(parsePath(MARK_PATH)))))),
  );
  const icons = Object.entries(GLYPHS).map(([accent, glyph]) => [accent, iconOutline(read(glyph))]);
  const lines = [
    '// Generated by scripts/brand-paths.mjs; do not edit. The morph shapes of home scene 3: the',
    `// simplified mark and the five category icon silhouettes, ${POINTS} points each on a ${GRID} grid,`,
    '// the same winding and start corner, so MorphSVG tweens them point for point (precompile).',
    '',
    `export const SERVICE_MORPH_VIEWBOX = '0 0 ${GRID} ${GRID}';`,
    '',
    '/** The brand mark, the resting shape of the morph (prototype 0a clip outline). */',
    `export const SERVICE_MARK_OUTLINE =\n  '${mark}';`,
    '',
    '/** The category icon silhouettes (Phosphor duotone, as in public/brand/icons.svg), by accent. */',
    'export const SERVICE_ICON_OUTLINES = {',
    ...icons.map(([accent, d]) => `  ${accent}:\n    '${d}',`),
    '} as const;',
    '',
  ];
  const config = await prettier.resolveConfig(OUT);
  return prettier.format(lines.join('\n'), { ...config, filepath: OUT });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(OUT, await generate());
  console.log(`brand-paths: wrote ${path.relative(root, OUT)}`);
}
