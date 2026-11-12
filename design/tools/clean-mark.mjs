// The brand mark redrawn as clean geometry: straight edges and true circular corners, fitted to
// the traced outline of the original raster logo (design/brand/logo-mark.svg before 2026-11-12).
// The trace carried scanner wobble: bumpy edges, a nick at the top of the slit, uneven corners.
// The diagonal edges keep the trace's two angles (3:4 and about 30 degrees from vertical); the
// corner radii (42 on top, 41 where the cap meets the slit so the two arcs do not overlap, 23 at the
// feet) are the best fit to the trace (0.2 % of the area differs).
//   node design/tools/clean-mark.mjs   → prints the path data (viewBox 982.3 119.0 184.0 222.9)
const T = 126.6;
const B = 333.9;
const L = 990.3;
const R = 1158.3;
const STEEP = 0.586; // dx/dy of the slits' outer edges
const DIAG = 0.75; // dx/dy of the stroke's edges (3:4)

const meet = (x1, y1, s1, x2, y2, s2) => {
  // Lines x = x1 + s1 (y - y1) and x = x2 + s2 (y - y2).
  const y = (x2 - x1 + s1 * y1 - s2 * y2) / (s1 - s2);
  return [x1 + s1 * (y - y1), y];
};

/** The outline, clockwise from the bottom-left corner: [x, y, corner radius]. */
export const CORNERS = [
  [L, B, 0],
  [L, T, 42],
  [1083.8, T, 0],
  [...meet(1083.8, T, -STEEP, 1060.2, 174, -DIAG), 0.6],
  [1060.2 - DIAG * (T - 174), T, 41],
  [R, T, 42],
  [R, B, 0],
  [1112.3 + DIAG * (B - 319.6), B, 23],
  [...meet(1112.3, 319.6, DIAG, 1086.3, 264.7, -STEEP), 1.5],
  [...meet(1086.3, 264.7, -STEEP, 1107.8, 224, -DIAG), 0.6],
  [1107.8 - DIAG * (B - 224), B, 23],
];

const f = (n) => Number(n.toFixed(2));

export function markPath(corners = CORNERS) {
  const n = corners.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y, r] = corners[i];
    if (!r) {
      d += `${d ? 'L' : 'M'}${f(x)} ${f(y)}`;
      continue;
    }
    const [px, py] = corners[(i + n - 1) % n];
    const [nx, ny] = corners[(i + 1) % n];
    const ax = px - x, ay = py - y, bx = nx - x, by = ny - y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const angle = Math.acos((ax * bx + ay * by) / (la * lb));
    const t = r / Math.tan(angle / 2);
    const sweep = ax * by - ay * bx < 0 ? 1 : 0;
    d += `${d ? 'L' : 'M'}${f(x + (ax / la) * t)} ${f(y + (ay / la) * t)}`;
    d += `A${r} ${r} 0 0 ${sweep} ${f(x + (bx / lb) * t)} ${f(y + (by / lb) * t)}`;
  }
  return `${d}Z`;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(markPath());
