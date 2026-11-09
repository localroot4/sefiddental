/**
 * The full upper arch of the smile station (D5, docs/experience/journey.md sections 2 and 9): the
 * sixteen teeth of the station's occlusal photo, seen from straight below, the incisors at the top
 * of the screen, the molars at the bottom. The teeth stand where the photo's teeth are
 * (src/lib/archPhoto.ts, measured on it), so the 3D arch cross-fades into the photo registered.
 * Pure math, shared by the WebGL arch (instanced molar.glb) and the DOM courier's SVG arch, so the
 * courier tooth seats in the same screen spot in both. Arch units: the arch spans x from -0.5 to
 * 0.5 (the last molars' centres); `z` grows toward the front teeth; both renderers look at it
 * orthographically at `ARCH_ELEVATION`, so a point projects with `projectArch` alone.
 */
import { ARCH_PHOTO } from '@/lib/archPhoto';

export interface ArchTooth {
  /** Crown centre across the arch, -0.5 (one end) to 0.5 (the other). */
  x: number;
  /** Crown centre toward the front: 0 at the last molars, `ARCH_DEPTH` at the incisors. */
  z: number;
  /**
   * Turn of the tooth about the vertical axis (three.js `rotation.y`, radians) that lays its
   * mesial-distal axis along the curve: 0 at the front.
   */
  yaw: number;
  /** Crown width along the curve (arch units). */
  width: number;
  /** Crown depth across the curve, as a share of a molar of this width. */
  depth: number;
}

/**
 * The view onto the arch (radians): straight onto the chewing surfaces, the front teeth up (the
 * sign turns the front toward the top of the screen).
 */
export const ARCH_ELEVATION = -Math.PI / 2;

const PHOTO_RATIO = ARCH_PHOTO.height / ARCH_PHOTO.width;
/** One side's teeth in arch units: across (x) and down the screen from the arch's middle (v). */
const SIDE = ARCH_PHOTO.teeth.map((t) => ({
  x: (t.u - ARCH_PHOTO.centre.u) / ARCH_PHOTO.archWidth,
  v: ((t.v - ARCH_PHOTO.centre.v) * PHOTO_RATIO) / ARCH_PHOTO.archWidth,
  width: t.width / ARCH_PHOTO.archWidth,
  depth: t.depth,
}));

/** Depth of the U (arch units): from the last molars' centres to the incisors'. */
export const ARCH_DEPTH = SIDE.at(-1)!.v - SIDE[0]!.v;
/** The teeth in the arch, both sides. */
export const ARCH_TEETH = SIDE.length * 2;
/** The empty slot the courier seats in: the first molar on the screen's right. */
export const ARCH_SLOT = SIDE.length + ARCH_PHOTO.firstMolar;

/** Each tooth of the arch, in order from one end to the other (the left last molar first). */
export function archLayout(): ArchTooth[] {
  const right = SIDE.map((t, i) => {
    // Along the curve: the direction from the tooth before to the one after.
    const prev = SIDE[i - 1] ?? { x: -t.x, v: t.v };
    const next = SIDE[i + 1] ?? { x: 2 * t.x - prev.x, v: 2 * t.v - prev.v };
    return {
      x: t.x,
      z: ARCH_DEPTH / 2 - t.v,
      yaw: Math.atan2(next.v - prev.v, next.x - prev.x),
      width: t.width,
      depth: t.depth,
    };
  });
  const left = right.map((t) => ({ ...t, x: -t.x, yaw: -t.yaw })).reverse();
  return [...left, ...right];
}

/**
 * Screen offset of an arch point under the orthographic view: `u` right and `v` down, in arch
 * units (a renderer multiplies by the arch's width in px). The arch's middle depth projects to
 * v = 0, so the whole arch is centred on its frame.
 */
export function projectArch(
  point: { x: number; z: number },
  elevation = ARCH_ELEVATION,
): { u: number; v: number } {
  // `+ 0` keeps the middle at 0, not -0.
  return { u: point.x, v: (point.z - ARCH_DEPTH / 2) * Math.sin(elevation) + 0 };
}

/** The screen angle (radians, clockwise, y down) of a tooth's footprint under that view. */
export function footprintAngle(yaw: number, elevation = ARCH_ELEVATION): number {
  return Math.atan(-Math.sin(elevation) * Math.tan(yaw));
}
