/**
 * D3's restoration per level, in numbers: the tier-1 top view's CSS keyframes (globals.css,
 * courier-top) for the WebGL courier, so both tiers play the same restoration on the chewing
 * surface. Plain (معمولی): a cavity outline, then one flat composite fill. VIP: a ceramic inlay
 * comes down turned, seats with a click (a dip under its size) and a gloss passes over the fit.
 * CIP: dentine, then a translucent enamel layer, then the fissures stained by hand, and a slow
 * shimmer. Lengths in the top view's 100-unit box, angles in degrees, times in seconds from the
 * moment the level shows (a chip, or the top view coming in).
 */

/** The CSS `cubic-bezier(x1, y1, x2, y2)` timing function. */
export function bezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const at = (a: number, b: number, s: number): number =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // x(s) is monotonic for 0 <= x1, x2 <= 1: bisection finds s for x = t.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i += 1) {
      const mid = (lo + hi) / 2;
      if (at(x1, x2, mid) < t) lo = mid;
      else hi = mid;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

/** design/tokens.css --ease-out and --ease-in-out. */
const OUT = bezier(0.16, 1, 0.3, 1);
const IN_OUT = bezier(0.65, 0, 0.35, 1);

/** A keyframed value at `t` (0..1), each segment eased from its start keyframe as CSS does. */
function keys(
  t: number,
  stops: readonly (readonly [number, number])[],
  ease: (t: number) => number,
) {
  const first = stops[0]!;
  if (t <= first[0]) return first[1];
  for (let i = 1; i < stops.length; i += 1) {
    const [o1, v1] = stops[i]!;
    const [o0, v0] = stops[i - 1]!;
    if (t <= o1) return v0 + (v1 - v0) * ease((t - o0) / (o1 - o0));
  }
  return stops.at(-1)![1];
}

/** 0..1 through an animation of `duration` that starts after `delay` (fill both). */
const span = (age: number, delay: number, duration: number): number =>
  Math.min(1, Math.max(0, (age - delay) / duration));

/** The sweep of a light across the restoration (ct-sweep): its opacity and its run (units). */
function sweep(age: number, delay: number, duration: number): { opacity: number; x: number } {
  const t = span(age, delay, duration);
  return {
    opacity: keys(
      t,
      [
        [0, 0],
        [0.4, 0.55],
        [1, 0],
      ],
      IN_OUT,
    ),
    x: keys(
      t,
      [
        [0, 0],
        [1, 60],
      ],
      IN_OUT,
    ),
  };
}

export interface RestoreParts {
  /** Plain: the cavity outline drawn (0..1), then the composite fill's opacity. */
  outline: number;
  fill: number;
  /** VIP: the inlay (y in units, rot in degrees) and the gloss over it. */
  inlay: { opacity: number; y: number; rot: number; scale: number };
  gloss: { opacity: number; x: number };
  /** CIP: the dentine's and the enamel layer's opacity, the stain drawn (0..1), the shimmer. */
  dentine: number;
  enamel: number;
  stain: number;
  shimmer: { opacity: number; x: number };
}

/** The longest level (CIP's shimmer ends 2.9 s in): after it every part holds still. */
export const RESTORE_S = 2.9;

export function restoreParts(level: 0 | 1 | 2, age: number): RestoreParts {
  const none = { opacity: 0, x: 0 };
  const parts: RestoreParts = {
    outline: 0,
    fill: 0,
    inlay: { opacity: 0, y: 0, rot: 0, scale: 1 },
    gloss: none,
    dentine: 0,
    enamel: 0,
    stain: 0,
    shimmer: none,
  };
  if (level === 0) {
    parts.outline = OUT(span(age, 0, 0.5));
    parts.fill = OUT(span(age, 0.45, 0.4));
  } else if (level === 1) {
    const t = span(age, 0, 0.7);
    parts.inlay = {
      opacity: keys(
        t,
        [
          [0, 0],
          [0.7, 1],
          [1, 1],
        ],
        OUT,
      ),
      y: keys(
        t,
        [
          [0, -16],
          [0.7, 0],
          [1, 0],
        ],
        OUT,
      ),
      rot: keys(
        t,
        [
          [0, -14],
          [0.7, 0],
          [1, 0],
        ],
        OUT,
      ),
      scale: keys(
        t,
        [
          [0, 1.14],
          [0.7, 1.02],
          [0.82, 0.97],
          [1, 1],
        ],
        OUT,
      ),
    };
    parts.gloss = sweep(age, 0.65, 0.9);
  } else {
    parts.dentine = OUT(span(age, 0, 0.35));
    parts.enamel = OUT(span(age, 0.3, 0.45));
    parts.stain = OUT(span(age, 0.7, 0.7));
    parts.shimmer = sweep(age, 1.3, 1.6);
  }
  return parts;
}
