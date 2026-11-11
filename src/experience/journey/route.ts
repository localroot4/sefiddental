/**
 * The courier's lanes (docs/experience/journey.md section 2): a travel never puts the courier over
 * the page's text, controls or the boxes painted above it. Planned once per measure, per travel,
 * in viewport space against the scroll: at each of N scroll samples the courier may sit on the
 * travel's own eased path or on a grid of places (and smaller sizes, down to a minimum) whose box
 * touches nothing; a shortest path through those places (dynamic programming over the samples,
 * each step at most one grid cell) prefers the eased path, full size and calm motion, and is then
 * smoothed where the smoothing stays clear. Pure: the same travel, boxes and viewport give the
 * same lane, so scrolling back plays it exactly in reverse. Where no place of the minimum size is
 * clear on screen (a phone's full-width text), the courier slides out at a side and back in where
 * a lane opens (`offstage` counts those samples); it never fades over text. `faded` counts the
 * samples with no clear place at all (none, with the sides always open).
 */
import type { Box, Viewport } from './pose';

/** A place of the courier: centre (viewport px), side of its box (px) and opacity. */
export interface Place {
  x: number;
  y: number;
  s: number;
  o: number;
}

export interface Route {
  y0: number;
  y1: number;
  /** Evenly spaced in scroll from y0 to y1. */
  samples: Place[];
  /** Samples with no clear place at all (the courier fades there). */
  faded: number;
  /** Samples where the courier waits off screen at a side. */
  offstage: number;
}

/** The share of the courier's box its form fills (pose.ts FORM_SHARE). */
const FORM = 0.8;
/** Clear space kept around the form (px). */
// The drawn form's growth past the pose (motion.ts: MAX_LAG, the lean, the squash and the whip's
// stretch, about 13 % of half the form) stays inside it.
export const LANE_MARGIN = 18;
/** At most this many scroll px between two samples. */
const STEP_PX = 16;
const MAX_SAMPLES = 160;
/** Shares of the eased path's size the courier may shrink to. */
const SIZES = [1, 0.74, 0.54, 0.4] as const;
/** At least this share of a place's box is on screen (a place may peek in from a side). */
const ON_SCREEN = 0.6;
const BLOCKED = 1e6;
/**
 * The search window round the eased path: this many grid rows above and below it, every column
 * (a lane may lie across the screen, or off a side).
 */
const WINDOW_ROWS = 6;
/** One planning step's time on this device before it gives the main thread back. */
const SLICE_MS = 4;
/** The cost of a way that keeps the margin only at its quarter points (a fade costs BLOCKED). */
const TIGHT = 100;

/** An index of the boxes by document top, for the ones on screen at one scroll position. */
interface Index {
  flow: Box[];
  pinned: Box[];
  tallest: number;
}

function indexBoxes(boxes: readonly Box[]): Index {
  const flow = boxes.filter((b) => b.pin === null).sort((a, b) => a.top - b.top);
  return {
    flow,
    pinned: boxes.filter((b) => b.pin !== null),
    tallest: flow.reduce((m, b) => Math.max(m, b.height), 0),
  };
}

function viewTop(b: Box, y: number): number {
  const { pin } = b;
  if (pin === null || y <= pin.start) return b.top - y;
  if (y <= pin.end) return b.top - pin.start;
  return b.top - pin.start - (y - pin.end);
}

/** The boxes on screen at scroll `y`, as viewport rects. */
function onScreen(index: Index, y: number, height: number): Float64Array {
  const out: number[] = [];
  const { flow } = index;
  let lo = 0;
  let hi = flow.length;
  const from = y - index.tallest;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (flow[mid]!.top < from) lo = mid + 1;
    else hi = mid;
  }
  for (let i = lo; i < flow.length && flow[i]!.top < y + height; i += 1) {
    const b = flow[i]!;
    const top = b.top - y;
    if (top + b.height > 0) out.push(b.left, top, b.left + b.width, top + b.height);
  }
  for (const b of index.pinned) {
    const top = viewTop(b, y);
    if (top < height && top + b.height > 0) out.push(b.left, top, b.left + b.width, top + b.height);
  }
  return Float64Array.from(out);
}

/** Whether the courier's form at (x, y) of side s, with its margin, touches none of `rects`. */
function clear(
  rects: Float64Array,
  x: number,
  y: number,
  s: number,
  vp: Viewport,
  /** A point on the way: off screen or partly off is fine, only the part on screen counts. */
  passing = false,
  margin = LANE_MARGIN,
): boolean {
  const half = (s * FORM) / 2 + margin;
  if (passing && (x + half < 0 || x - half > vp.width)) return true;
  // Never under the header or the sticky bar; a side may be off screen (a place peeks in).
  if (y - half < (vp.insetTop ?? 0) || y + half > vp.height - (vp.insetBottom ?? 0)) return false;
  const left = Math.max(0, x - half);
  const right = Math.min(vp.width, x + half);
  if (!passing && right - left < ON_SCREEN * 2 * half) return false;
  const top = y - half;
  const bottom = y + half;
  for (let i = 0; i < rects.length; i += 4) {
    if (rects[i]! < right && rects[i + 2]! > left && rects[i + 1]! < bottom && rects[i + 3]! > top)
      return false;
  }
  return true;
}

/** Plans a route at once (tests; the driver steps `routeSteps` in idle time instead). */
export function planRoute(opts: RouteInput): Route {
  const steps = routeSteps(opts);
  let r = steps.next();
  while (!r.done) r = steps.next();
  return r.value;
}

export interface RouteInput {
  y0: number;
  y1: number;
  /** The travel's own eased path at progress 0..1 (its ends are the docks' poses). */
  base: (t: number, y: number) => { x: number; y: number; s: number };
  obstacles: readonly Box[];
  viewport: Viewport;
  /** The smallest side the courier may shrink to (px). */
  min: number;
}

/**
 * The planning in steps: it yields every SLICE_MS, so the driver spreads one travel over idle slots
 * and no task runs long (a phone is several times slower than a desktop).
 */
export function* routeSteps(opts: RouteInput): Generator<void, Route> {
  const { y0, y1, base, viewport: vp, min } = opts;
  // Steps end on time, not on a count: the work per sample differs several times along a travel.
  let since = performance.now();
  const due = (): boolean => {
    const now = performance.now();
    if (now - since < SLICE_MS) return false;
    since = now;
    return true;
  };
  const n = Math.max(2, Math.min(MAX_SAMPLES, Math.ceil((y1 - y0) / STEP_PX)));
  const index = indexBoxes(opts.obstacles);
  const cols = Math.max(7, Math.min(24, Math.round(vp.width / 60)));
  const rows = Math.max(6, Math.min(16, Math.round(vp.height / 70)));
  const cellW = vp.width / cols;
  const cellH = vp.height / rows;
  // Columns: off screen, peeking in, the grid, peeking in, off screen (the side ones per size).
  const xs = cols + 4;
  const OFF_L = 0;
  const PEEK_L = 1;
  const PEEK_R = cols + 2;
  const OFF_R = cols + 3;
  const grid = xs * rows * SIZES.length;
  const nodes = grid + 1; // node `grid` is the eased path itself
  const at = (k: number): number => y0 + ((y1 - y0) * k) / n;
  // Next to its docks the courier rides with them and does not trail (motion.ts): the margin
  // there is the dock's own, growing to the full lane margin over the first and last samples.
  const marginAt = (k: number): number =>
    Math.max(2, LANE_MARGIN * Math.min(1, Math.min(k, n - k) / 4));

  const px = new Float64Array((n + 1) * nodes);
  const py = new Float64Array((n + 1) * nodes);
  const ps = new Float64Array((n + 1) * nodes);
  const cost = new Float64Array((n + 1) * nodes);
  const free = new Uint8Array((n + 1) * nodes);
  // Only places within a few rows of the eased path are searched: a lane is a detour, not a tour
  // of the screen, and the search stays small enough for idle time.
  const act = new Uint8Array((n + 1) * nodes);
  const actives: number[][] = Array.from({ length: n + 1 }, () => []);
  const from = new Int32Array((n + 1) * nodes).fill(-1);
  const bases: { x: number; y: number; s: number }[] = [];
  const rectsAt: Float64Array[] = [];

  for (let k = 0; k <= n; k += 1) {
    if (due()) yield;
    const b = base(k / n, at(k));
    bases.push(b);
    const rects = onScreen(index, at(k), vp.height);
    rectsAt.push(rects);
    const o = k * nodes;
    const baseRow = Math.floor(b.y / cellH);
    for (let si = 0; si < SIZES.length; si += 1) {
      const s = Math.max(min, b.s * SIZES[si]!);
      const half = (s * FORM) / 2 + LANE_MARGIN;
      for (let r = 0; r < rows; r += 1) {
        if (Math.abs(r - baseRow) > WINDOW_ROWS) continue;
        for (let c = 0; c < xs; c += 1) {
          const i = o + (si * rows + r) * xs + c;
          act[i] = 1;
          actives[k]!.push(i - o);
          const off = c === OFF_L || c === OFF_R;
          const x =
            c === OFF_L
              ? -half - 2
              : c === OFF_R
                ? vp.width + half + 2
                : c === PEEK_L
                  ? half * 2 * (ON_SCREEN - 0.5)
                  : c === PEEK_R
                    ? vp.width - half * 2 * (ON_SCREEN - 0.5)
                    : (c - 1.5) * cellW;
          const y = (r + 0.5) * cellH;
          px[i] = x;
          py[i] = y;
          ps[i] = s;
          // Off screen nothing is covered: where no lane exists the courier leaves the frame at
          // a side and comes back (never a ghost over the text).
          free[i] = off || clear(rects, x, y, s, vp, false, marginAt(k)) ? 1 : 0;
        }
      }
    }
    const e = o + grid;
    px[e] = b.x;
    py[e] = b.y;
    ps[e] = b.s;
    // The docks' own poses are always allowed: the courier leaves and reaches them exactly.
    free[e] = k === 0 || k === n || clear(rects, b.x, b.y, b.s, vp, false, marginAt(k)) ? 1 : 0;
  }

  // The way from sample k-1 to sample k, against the boxes as they are then (the page has
  // scrolled part of the step: they sit lower by the rest of it). `way` checks its quarter points
  // as `clear` does (the bars, a side off screen). `along` checks the whole straight way against
  // each box: every side of the overlap is linear in the way's progress, so the way meets the box
  // (with its margin) only where all four hold together. Quarter points alone let a fast sideways
  // pass cut a box's corner by 7 px, and the drawn courier's lag and lean took the rest (T-CA3 on
  // CI, the booking submit). The search takes a way clear all along wherever there is one (TIGHT),
  // and one clear at its quarter points where there is none, as before.
  const step = (y1 - y0) / n;
  type Point = { x: number; y: number; s: number };
  const way = (k: number, a: Point, b: Point): boolean => {
    for (const f of [0.25, 0.5, 0.75]) {
      if (
        !clear(
          rectsAt[k]!,
          a.x + (b.x - a.x) * f,
          a.y + (b.y - a.y) * f - (1 - f) * step,
          a.s + (b.s - a.s) * f,
          vp,
          true,
          marginAt(k),
        )
      )
        return false;
    }
    return true;
  };
  const along = (k: number, a: Point, b: Point): boolean => {
    const rects = rectsAt[k]!;
    const m = marginAt(k);
    // The form's centre and half side at progress 0 and 1, the boxes fixed (the page's scroll
    // carried into the courier's place).
    const x0 = a.x;
    const y0 = a.y - step;
    const h0 = (a.s * FORM) / 2 + m;
    const dx = b.x - x0;
    const dy = b.y - y0;
    const dh = (b.s * FORM) / 2 + m - h0;
    for (let i = 0; i < rects.length; i += 4) {
      let lo = 0;
      let hi = 1;
      // Each side: g + f d > 0 for an overlap (left < x + h, right > x - h, top < y + h, ...).
      const side = (g: number, d: number): boolean => {
        if (d === 0) return g > 0;
        const root = -g / d;
        if (d > 0) lo = Math.max(lo, root);
        else hi = Math.min(hi, root);
        return lo < hi;
      };
      if (
        side(x0 + h0 - rects[i]!, dx + dh) &&
        side(rects[i + 2]! - x0 + h0, dh - dx) &&
        side(y0 + h0 - rects[i + 1]!, dy + dh) &&
        side(rects[i + 3]! - y0 + h0, dh - dy)
      )
        return false;
    }
    return true;
  };
  /** The way's extra cost: 0 clear all along, TIGHT at its quarter points only, else Infinity. */
  const between = (k: number, io: number, jo: number): number => {
    const a = { x: px[io]!, y: py[io]!, s: ps[io]! };
    const b = { x: px[jo]!, y: py[jo]!, s: ps[jo]! };
    if (!way(k, a, b)) return Infinity;
    return along(k, a, b) ? 0 : TIGHT;
  };
  const nodeCost = (i: number, k: number): number => {
    const b = bases[k]!;
    if (!free[i]) return BLOCKED;
    const dx = (px[i]! - b.x) / vp.width;
    const dy = (py[i]! - b.y) / vp.height;
    const half = ps[i]! * FORM * 0.5;
    const off = px[i]! + half < 0 || px[i]! - half > vp.width;
    const peek = !off && (px[i]! - half < 0 || px[i]! + half > vp.width);
    return 4 * (dx * dx + dy * dy) + 1.2 * (1 - ps[i]! / b.s) + (peek ? 0.6 : 0) + (off ? 3 : 0);
  };
  const moveCost = (i: number, j: number, k: number): number => {
    // Motion beyond the eased path's own, per sample.
    const b0 = bases[k - 1]!;
    const b1 = bases[k]!;
    const mx = (px[j]! - px[i]! - (b1.x - b0.x)) / cellW;
    const my = (py[j]! - py[i]! - (b1.y - b0.y)) / cellH;
    return 0.02 * (mx * mx + my * my);
  };

  // k = 0: the travel starts on its dock.
  cost.fill(Infinity);
  cost[grid] = 0;
  const reach = Math.max(cellW, cellH) * 1.05 + (min * FORM) / 2 + LANE_MARGIN + 2;
  for (let k = 1; k <= n; k += 1) {
    if (due()) yield;
    const o = k * nodes;
    const p = (k - 1) * nodes;
    const last = k === n;
    for (let j = 0; j <= grid; j += 1) {
      if (last && j !== grid) continue;
      if (j !== grid && !act[o + j]) continue;
      // One sample's nodes with their ways took 25 ms on a 2-core runner: the step ends on time here.
      if (due()) yield;
      const jo = o + j;
      const own = nodeCost(jo, k);
      let best = Infinity;
      let arg = -1;
      const consider = (i: number): void => {
        const io = p + i;
        if (cost[io] === Infinity) return;
        const dx = Math.abs(px[jo]! - px[io]! - (bases[k]!.x - bases[k - 1]!.x));
        const dy = Math.abs(py[jo]! - py[io]! - (bases[k]!.y - bases[k - 1]!.y));
        if (dx > reach || dy > reach) return;
        if (Math.abs(ps[jo]! - ps[io]!) > 0.3 * Math.max(ps[jo]!, ps[io]!)) return;
        let c = cost[io]! + moveCost(io, jo, k);
        if (c >= best) return;
        // The courier moves on a straight line between two samples while the page scrolls on
        // under it: the way between is clear too.
        if (free[jo]) c += between(k, io, jo);
        if (c >= best) return;
        best = c;
        arg = i;
      };
      if (j === grid) {
        for (const i of actives[k - 1]!) consider(i);
        consider(grid);
      } else {
        const si = Math.floor(j / (rows * xs));
        const r = Math.floor((j % (rows * xs)) / xs);
        const c = j % xs;
        for (let ds = -1; ds <= 1; ds += 1) {
          const s2 = si + ds;
          if (s2 < 0 || s2 >= SIZES.length) continue;
          for (let dr = -1; dr <= 1; dr += 1) {
            const r2 = r + dr;
            if (r2 < 0 || r2 >= rows) continue;
            for (let dc = -1; dc <= 1; dc += 1) {
              const c2 = c + dc;
              if (c2 < 0 || c2 >= xs) continue;
              consider((s2 * rows + r2) * xs + c2);
            }
            // Off screen is one step from the outer grid columns too (past a full-width text
            // a peek may not fit).
            const far =
              c === OFF_L
                ? 2
                : c === 2
                  ? OFF_L
                  : c === OFF_R
                    ? cols + 1
                    : c === cols + 1
                      ? OFF_R
                      : -1;
            if (far >= 0) consider((s2 * rows + r2) * xs + far);
          }
        }
        consider(grid);
      }
      if (arg >= 0) {
        cost[jo] = best + own;
        from[jo] = arg;
      }
    }
  }

  // Back from the arrival on the next dock.
  const chosen: number[] = new Array(n + 1);
  let j = grid;
  for (let k = n; k >= 0; k -= 1) {
    chosen[k] = k * nodes + j;
    if (k > 0) j = from[k * nodes + j]!;
    if (j < 0) j = grid; // unreachable (never with the eased path always reachable): stay on it
  }
  const samples: Place[] = chosen.map((i) => ({
    x: px[i]!,
    y: py[i]!,
    s: ps[i]!,
    o: free[i] ? 1 : 0,
  }));

  // Smooth the corners where the smoother place is still clear.
  for (let pass = 0; pass < 3; pass += 1) {
    for (let k = 1; k < n; k += 1) {
      if (due()) yield;
      const a = samples[k - 1]!;
      const b = samples[k]!;
      const c = samples[k + 1]!;
      if (b.o === 0) continue;
      const next = {
        x: (a.x + 2 * b.x + c.x) / 4,
        y: (a.y + 2 * b.y + c.y) / 4,
        s: (a.s + 2 * b.s + c.s) / 4,
      };
      if (
        clear(rectsAt[k]!, next.x, next.y, next.s, vp, false, marginAt(k)) &&
        way(k, a, next) &&
        along(k, a, next) &&
        way(k + 1, next, c) &&
        along(k + 1, next, c)
      ) {
        b.x = next.x;
        b.y = next.y;
        b.s = next.s;
      }
    }
  }
  // A fade, where it must be, eases over the neighbouring samples.
  const o = samples.map((p) => p.o);
  for (let k = 0; k <= n; k += 1) {
    if (o[k] === 0) continue;
    const near = Math.min(o[k - 1] ?? 1, o[k + 1] ?? 1);
    samples[k]!.o = near === 0 ? 0.5 : 1;
  }
  const offstage = samples.filter(
    (p) => p.x + (p.s * FORM) / 2 < 0 || p.x - (p.s * FORM) / 2 > vp.width,
  ).length;
  return { y0, y1, samples, faded: o.filter((v) => v === 0).length, offstage };
}

/** The place on a route at scroll `y` (linear between samples). */
export function placeOn(route: Route, y: number): Place {
  const { samples, y0, y1 } = route;
  const n = samples.length - 1;
  const f = y1 > y0 ? ((y - y0) / (y1 - y0)) * n : 0;
  const k = Math.max(0, Math.min(n - 1, Math.floor(f)));
  const t = Math.max(0, Math.min(1, f - k));
  const a = samples[k]!;
  const b = samples[k + 1] ?? a;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    s: a.s + (b.s - a.s) * t,
    o: a.o + (b.o - a.o) * t,
  };
}
