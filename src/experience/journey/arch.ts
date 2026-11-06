/**
 * The full arch of the smile station (D5, docs/experience/journey.md section 2): fourteen teeth
 * on a U-shaped curve, the front teeth at the bottom of the screen, the molars at the back. Pure
 * math, shared by the WebGL arch (instanced molar.glb) and the DOM courier's SVG arch, so the
 * courier tooth seats in the same screen spot in both. Arch units: the arch spans x from -0.5 to
 * 0.5; `z` grows toward the viewer (the front teeth); both renderers look at it from the front
 * and above at `ARCH_ELEVATION`, orthographically, so a point projects with `projectArch` alone.
 */

export interface ArchTooth {
  /** Crown centre across the arch, -0.5 (one end) to 0.5 (the other). */
  x: number;
  /** Crown centre toward the viewer: 0 at the back molars, `ARCH_DEPTH` at the front teeth. */
  z: number;
  /**
   * Turn of the tooth about the vertical axis (three.js `rotation.y`, radians) that lays its
   * mesial-distal axis along the curve: 0 at the front.
   */
  yaw: number;
  /** Crown width along the curve (arch units). */
  width: number;
}

/** Depth of the U (arch units): a human upper arch is a little less deep than wide. */
export const ARCH_DEPTH = 0.62;
/** The view drops onto the arch from the front by this angle (radians). */
export const ARCH_ELEVATION = 0.9;
/**
 * Relative crown widths from the front to the back of one side: central and lateral incisor,
 * canine, two premolars, two molars.
 */
const SIDE = [0.85, 0.66, 0.74, 0.7, 0.7, 1.02, 0.96] as const;
/** The teeth in the arch, both sides. */
export const ARCH_TEETH = SIDE.length * 2;
/** The empty slot the courier seats in: the first molar on the screen's right. */
export const ARCH_SLOT = SIDE.length + 5;

/** The curve: x in -0.5..0.5, z from 0 at both ends to ARCH_DEPTH in the middle. */
const curveZ = (x: number): number => ARCH_DEPTH * (1 - 4 * x * x);
const curveSlope = (x: number): number => -8 * ARCH_DEPTH * x;

/** Arc length of the curve from -0.5 to `x` (numeric, fine steps). */
function arcTo(x: number): number {
  const steps = 256;
  const h = (x + 0.5) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i += 1) {
    const m = -0.5 + (i + 0.5) * h;
    sum += Math.hypot(1, curveSlope(m)) * h;
  }
  return sum;
}

/** The x where the arc length from -0.5 reaches `length` (bisection). */
function xAtArc(length: number): number {
  let lo = -0.5;
  let hi = 0.5;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (arcTo(mid) < length) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Each tooth of the arch, in order from one end to the other, spaced along the curve. */
export function archLayout(): ArchTooth[] {
  const widths = [...[...SIDE].reverse(), ...SIDE];
  const total = arcTo(0.5);
  const sum = widths.reduce((a, b) => a + b, 0);
  // The crowns fill 96 % of the curve: a hair of space between neighbours.
  const unit = (total * 0.96) / sum;
  const gap = (total * 0.04) / widths.length;
  const teeth: ArchTooth[] = [];
  let at = gap / 2;
  for (const w of widths) {
    const width = w * unit;
    const x = xAtArc(at + width / 2);
    teeth.push({ x, z: curveZ(x), yaw: -Math.atan(curveSlope(x)), width });
    at += width + gap;
  }
  return teeth;
}

/**
 * Screen offset of an arch point under the orthographic view from above the front: `u` right and
 * `v` down, in arch units (a renderer multiplies by the arch's width in px). The arch's middle
 * depth projects to v = 0, so the whole arch is centred on its frame.
 */
export function projectArch(
  point: { x: number; z: number },
  elevation = ARCH_ELEVATION,
): { u: number; v: number } {
  return { u: point.x, v: (point.z - ARCH_DEPTH / 2) * Math.sin(elevation) };
}

/** The screen angle (radians, clockwise, y down) of a tooth's footprint under that view. */
export function footprintAngle(yaw: number, elevation = ARCH_ELEVATION): number {
  return Math.atan(-Math.sin(elevation) * Math.tan(yaw));
}
