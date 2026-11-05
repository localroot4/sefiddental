/**
 * Pure math of the porcelain world (phase 8, docs/experience-direction.md sections 3 and 6): the
 * tier settings the world reads, the camera path and the light drift bound to the master
 * timeline, the clamped scroll-velocity wobble and the mapping from viewport pixels to the
 * camera's space. No three.js and no window: the callers pass what they measured.
 */
import type { TierSettings } from '@/lib/qualityTier';

import type { SceneId } from '../scenes/types';

/** Diamond dust at 100 %; tiers scale it by `particleFactor` (100 / 50 / 20 %). */
export const PARTICLES_MAX = 400;

export interface WorldSettings {
  particles: number;
  shadows: 'soft' | 'hard' | 'none';
  shadowMapSize: number;
  /** PCF filter radius: three 0.186 removed PCFSoftShadowMap, so softness is the radius. */
  shadowRadius: number;
  /** Film grain inside the world's materials (never on the DOM, never on the bare surface). */
  grain: boolean;
  /** The light bloom: a glow halo behind the glass mark (no full-screen pass). */
  glow: boolean;
  /** The light depth of field: dust far from the focus plane grows soft and faint. */
  dof: boolean;
  transmission: number;
  /** Tier 1 draws only while one of its scenes is mounted (the hero exit; the molar lane's 4). */
  drawsIdle: boolean;
}

/** Section 3 of the experience direction, read from the tier settings (`qualityTier.ts`). */
export function worldSettings(tier: 1 | 2 | 3, settings: TierSettings): WorldSettings {
  return {
    particles: Math.round(PARTICLES_MAX * settings.particleFactor),
    shadows: settings.shadows,
    shadowMapSize: settings.shadows === 'soft' ? 2048 : 1024,
    shadowRadius: settings.shadows === 'soft' ? 6 : 1,
    grain: settings.post.grain,
    glow: settings.post.bloom,
    dof: settings.post.dof,
    transmission: settings.transmission,
    drawsIdle: tier >= 2,
  };
}

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
}

/** The neutral pose: front, centred. Scenes without a key pose (the molar lane's) see this. */
export const NEUTRAL_POSE: CameraPose = { position: [0, 0, 10], target: [0, 0, 0] };

/**
 * Key poses at the start of a scene's segment; the camera eases to the next listed scene's pose
 * across the segment. Scene 2: front, a slight low angle, then the 3 degree tilt before the
 * horizontal turn; scene 3 slides sideways with the track; scenes 9 and 10 come closer and warm.
 */
export const CAMERA_PATH: Partial<Record<SceneId, CameraPose>> = {
  hero: { position: [0, -0.45, 10], target: [0, 0, 0] },
  // 3 degrees up: atan((0.53 + 0.45) / 10) - atan(0.45 / 10).
  trust: { position: [0, -0.45, 10], target: [0, 0.53, 0] },
  services: { position: [0.7, 0.1, 10.4], target: [0.35, 0.1, 0] },
  restoration: NEUTRAL_POSE,
  'first-visit': { position: [-0.35, 0.25, 9.6], target: [-0.2, 0.1, 0] },
  booking: { position: [-0.5, 0.3, 9.4], target: [-0.3, 0.15, 0] },
  footer: { position: [0, 0.4, 10], target: [0, 0.2, 0] },
};

const clamp01 = (value: number): number => (value <= 0 ? 0 : value >= 1 ? 1 : value);
const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  mix(a[0], b[0], t),
  mix(a[1], b[1], t),
  mix(a[2], b[2], t),
];

/**
 * The camera at a place on the master timeline: the active scene's key pose (or the last key
 * pose before it) eased toward the next key pose by the scene's progress. Scenes are in
 * registry order; a place outside them is the neutral pose.
 */
export function cameraPose(
  order: readonly SceneId[],
  place: { id: SceneId; progress: number } | null,
): CameraPose {
  if (place === null) return NEUTRAL_POSE;
  const index = order.indexOf(place.id);
  if (index < 0) return NEUTRAL_POSE;
  let from: CameraPose = NEUTRAL_POSE;
  for (let i = index; i >= 0; i -= 1) {
    const pose = CAMERA_PATH[order[i] as SceneId];
    if (pose) {
      from = pose;
      break;
    }
  }
  const next = order.slice(index + 1).find((id) => CAMERA_PATH[id] !== undefined);
  const to = next === undefined ? from : (CAMERA_PATH[next] ?? from);
  const t = smooth(clamp01(place.progress));
  return {
    position: mixVec(from.position, to.position, t),
    target: mixVec(from.target, to.target, t),
  };
}

export interface LightDrift {
  /** 0 = cool dawn key, 1 = warm peach key. */
  warmth: number;
  /** Key light position (world units). */
  position: Vec3;
}

/**
 * Cool to warm across the journey (section 6): the master progress carries the key half way to
 * warm, scene 9's `--warm` (0..1, the DOM warm layer's own value) carries it the rest. The key
 * swings from the start side to the end side as it warms.
 */
export function lightDrift(progress: number, warm: number): LightDrift {
  const p = clamp01(progress);
  const w = clamp01(warm);
  const warmth = clamp01(0.45 * smooth(p) + 0.55 * w);
  return { warmth, position: [mix(2.6, -2.2, smooth(p)), mix(3.6, 3.0, w), 9] };
}

/** px/s of scroll at which the wobble saturates; faster scrolling looks the same, never broken. */
export const WOBBLE_FULL_PX_S = 2400;
/** Seconds to settle (exponential), so a stop eases back instead of snapping. */
const WOBBLE_RESPONSE = 0.22;

/** One step of the clamped velocity wobble: -1..1, eased toward the scroll velocity. */
export function wobbleStep(current: number, velocityPxS: number, dtSec: number): number {
  const v = Number.isFinite(velocityPxS) ? velocityPxS : 0;
  const target = Math.max(-1, Math.min(1, v / WOBBLE_FULL_PX_S));
  const dt = Number.isFinite(dtSec) && dtSec > 0 ? Math.min(dtSec, 0.1) : 0;
  return current + (target - current) * (1 - Math.exp(-dt / WOBBLE_RESPONSE));
}

/** Camera distance to the plane the screen-anchored objects stand on (world units). */
export const ANCHOR_DEPTH = 10;

/** A rectangle in viewport pixels (CSS px), as `getBoundingClientRect` gives it. */
export interface PxRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A viewport rectangle on a plane `depth` units in front of a perspective camera: the centre in
 * the camera's own space (x right, y up, z toward the viewer) and the world units of one CSS px.
 */
export function rectToCamera(
  rect: PxRect,
  viewport: { width: number; height: number },
  fovDeg: number,
  depth: number,
): { x: number; y: number; z: number; unitsPerPx: number } {
  const halfHeight = depth * Math.tan((fovDeg * Math.PI) / 360);
  const unitsPerPx = viewport.height > 0 ? (2 * halfHeight) / viewport.height : 0;
  const cx = rect.left + rect.width / 2 - viewport.width / 2;
  const cy = rect.top + rect.height / 2 - viewport.height / 2;
  return { x: cx * unitsPerPx, y: -cy * unitsPerPx, z: -depth, unitsPerPx };
}

/**
 * The colour the canvas paints under the DOM warm layer (`bg-warm/12` at full `--warm`) so the
 * pair composites to `target` (the booking stage's `--color-warm-soft`): the booking section can
 * then be transparent over the world and still look and measure exactly as its opaque self.
 * sRGB 0..255 channels, as the browser blends them; clamped.
 */
export function underWarmLayer(
  target: Vec3,
  warm: Vec3,
  layerAlpha: number,
): [number, number, number] {
  const keep = 1 - layerAlpha;
  const channel = (t: number, w: number): number =>
    Math.max(0, Math.min(255, keep > 0 ? (t - layerAlpha * w) / keep : t));
  return [channel(target[0], warm[0]), channel(target[1], warm[1]), channel(target[2], warm[2])];
}
