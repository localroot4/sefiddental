/**
 * Pure math of the scenes 4 to 6 (no three.js, no DOM): the level a chip selects, the turntable,
 * the workflow beats, the wipe edge and the tier gates. Unit-tested in math.test.ts.
 */
import type { TierSettings } from '@/lib/qualityTier';

/** معمولی, VIP, CIP. */
export const LEVELS = 3;

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/** 0 before `a`, 1 after `b`, a smoothstep between. */
export function ramp(value: number, a: number, b: number): number {
  const t = clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * The level the chips show: `data-choice` is the checked chip's 1-based position (choices.ts),
 * absent while none is checked, when the molar shows the plain level. Anything else is plain.
 */
export function levelFromChoice(choice: string | null, levels = LEVELS): number {
  const at = choice === null ? NaN : Number(choice);
  return Number.isInteger(at) && at >= 1 && at <= levels ? at - 1 : 0;
}

/** Frame-rate independent approach of `target` with time constant `tau` seconds. */
export function damp(current: number, target: number, dt: number, tau: number): number {
  if (!(dt > 0) || !(tau > 0)) return dt > 0 ? target : current;
  return target + (current - target) * Math.exp(-dt / tau);
}

/**
 * The enamel per level position `s` (0 plain, 1 VIP, 2 CIP, fractions between): VIP refines the
 * form and the gloss over the first step, CIP adds the colour characterization over the second.
 */
export function levelBlend(s: number): { refine: number; character: number } {
  return { refine: clamp(s, 0, 1), character: clamp(s - 1, 0, 1) };
}

/** A third of a turn per level: each level shows the molar from a new side. */
export const STEP_YAW = (2 * Math.PI) / LEVELS;
const BASE_YAW = -0.5;
/** The pinned scrub turns the molar this far over the pin, on top of the level turns. */
const SCROLL_YAW = 0.6;
const IDLE_YAW = 0.12;
const IDLE_RATE = 0.45;

/** Turntable yaw for the level position `s`, the scene progress (0..1) and the clock (s). */
export function turntableYaw(s: number, progress: number, time: number): number {
  return (
    BASE_YAW +
    s * STEP_YAW +
    (clamp(progress, 0, 1) - 0.5) * SCROLL_YAW +
    IDLE_YAW * Math.sin(time * IDLE_RATE)
  );
}

/** Camera distance at which a `width` x `height` box fills a perspective view of `fovDeg`. */
export function fitDistance(fovDeg: number, aspect: number, width: number, height: number): number {
  const half = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const safeAspect = aspect > 0 ? aspect : 1;
  return Math.max(height / (2 * half), width / (2 * half * safeAspect));
}

/**
 * Progress of a sticky stage through its room (the pinRoom.ts geometry: the stage sticks under
 * the nav and the room after it is the scroll distance), unclamped: below 0 while the stage
 * comes up to the nav, above 1 once it leaves.
 */
export function pinProgress(roomTop: number, navH: number, stageH: number, roomH: number): number {
  if (!(roomH > 0)) return 0;
  return (navH + stageH - roomTop) / roomH;
}

export interface WorkflowStages {
  /** The point cloud converges on the tooth (scan). */
  assemble: number;
  /** Height of the scan band, 0 at the root tips to 1 above the cusps. */
  scan: number;
  /** Point cloud opacity. */
  points: number;
  /** Wireframe opacity (design). */
  wire: number;
  /** The solid builds from the root tips to the cusps (design to solid). */
  build: number;
  /** Matte milled block to glazed enamel (make). */
  glaze: number;
  /** Cool to warm light (smile). */
  warm: number;
}

/**
 * The four beats over the pin progress `p`, with step i of the DOM path at the stage centre at
 * p = i / 3 (workflow.ts): the scan forms the cloud as the stage arrives (p < 0) and through the
 * first step, the wireframe owns the second, the solid and its glaze the third, the warm light
 * the fourth. Overlaps are short so two beats never compete.
 */
export function workflowStages(p: number): WorkflowStages {
  return {
    assemble: ramp(p, -0.25, 0.1),
    scan: ramp(p, -0.15, 0.28),
    points: 1 - ramp(p, 0.2, 0.33),
    wire: ramp(p, 0.16, 0.32) * (1 - ramp(p, 0.56, 0.7)),
    build: ramp(p, 0.36, 0.6),
    glaze: ramp(p, 0.58, 0.76),
    warm: ramp(p, 0.8, 1),
  };
}

/**
 * The divider of the compare slider in texture space (x from the left, 0..1). CompareSlider puts
 * the divider `pos`% from the start side and shows the after photo on the end side: in RTL the
 * start is the right, so the after photo is left of the edge.
 */
export function wipeEdge(pos: number, rtl: boolean): { edge: number; afterLeft: boolean } {
  const share = clamp(Number.isFinite(pos) ? pos : 50, 0, 100) / 100;
  return rtl ? { edge: 1 - share, afterLeft: true } : { edge: share, afterLeft: false };
}

/** Displacement amplitude (texture units): a breath at rest, a wave while the handle moves. */
export const WIPE_REST = 0.004;
const WIPE_MAX = 0.03;
const WIPE_GAIN = 0.02;

/** Rises within about 80 ms of a drag, settles over about 600 ms after it. */
export function wipeAmplitude(current: number, speed: number, dt: number): number {
  const target = Math.min(WIPE_MAX, WIPE_REST + Math.abs(speed) * WIPE_GAIN);
  return damp(current, target, dt, target > current ? 0.08 : 0.6);
}

/** Scene 4 draws the 3D molar where the tier settings give it the canvas (else the SVG stays). */
export const molarDraws = (settings: Pick<TierSettings, 'molar'>): boolean =>
  settings.molar === 'canvas';

/** Scene 5 draws only on the pinned diagonal; phones and tier 1 keep the DOM steps. */
export const workflowDraws = (tier: number, pins: boolean): boolean => tier >= 2 && pins;

/** Scene 6: the WebGL wipe at tiers 2 and 3 from 1024 px; the DOM clip-path everywhere else. */
export const wipeDraws = (settings: Pick<TierSettings, 'compareWipe'>, wide: boolean): boolean =>
  settings.compareWipe === 'webgl' && wide;

export interface PassViewport {
  /** CSS px from the canvas's bottom-left, as WebGLRenderer.setViewport takes them. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The same box clipped to the canvas. */
  scissor: { x: number; y: number; width: number; height: number };
}

/**
 * The viewport of a DOM rect on the full-viewport canvas (y flipped), or null when the rect is
 * empty or outside the canvas.
 */
export function passViewport(
  rect: { left: number; top: number; width: number; height: number },
  size: { width: number; height: number },
): PassViewport | null {
  const { left, top, width, height } = rect;
  if (!(width >= 1 && height >= 1)) return null;
  const right = left + width;
  const bottom = top + height;
  if (right <= 0 || bottom <= 0 || left >= size.width || top >= size.height) return null;
  const y = size.height - bottom;
  const sx = Math.max(0, left);
  const sy = Math.max(0, y);
  return {
    x: left,
    y,
    width,
    height,
    scissor: {
      x: sx,
      y: sy,
      width: Math.min(size.width, right) - sx,
      height: Math.min(size.height, size.height - top) - sy,
    },
  };
}
