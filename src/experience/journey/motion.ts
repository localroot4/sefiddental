/**
 * The courier's secondary motion (docs/experience/journey.md section 3): a render-only layer on top
 * of the pure pose. The shown place follows the pose with a critically damped spring (no overshoot
 * past a dock), and its velocity leans the form into the move (a tilt) and squashes it a little
 * along the scroll; the whip stretches it as it spins. At rest the spring has converged and snaps
 * onto the pose exactly, so reverse scrolling and a reload stay exact; a jump (a reload, an anchor,
 * a programmatic scroll of more than half a viewport) is taken at once, not chased.
 */
import { flatAmount, viewportTop, whipTurn, type Box, type Form, type Pose } from './pose';

/** The spring's angular frequency (1/s): about 0.3 s to settle, critically damped. */
const OMEGA = 16;
/** Under this distance (px) and speed (px/s) the shown place is the pose. */
const REST_PX = 0.05;
const REST_SPEED = 1;
/** Lean (radians) per px/s of sideways speed, and its limit. */
const LEAN = 0.00008;
const MAX_LEAN = 0.06;
/** Squash per px/s of vertical speed, and its limit. */
const SQUASH = 0.00003;
const MAX_SQUASH = 0.03;
/**
 * The shown place never trails the pose by more than this (px): the lanes keep LANE_MARGIN
 * (route.ts) round the form, and the lean, the squash and the whip's stretch take the rest.
 */
export const MAX_LAG = 8;
/** The whip's stretch across the spin, at its middle. */
const STRETCH = 0.05;
/** A move of more than this share of the viewport height in one frame is taken at once. */
const JUMP_VH = 0.5;

/** The intro hand-off's glide from the intro mark's hole to D1 (s). */
export const GLIDE_S = 0.6;
/** The glide's spring (1/s): critically damped, about 99 % of the way at GLIDE_S. */
const GLIDE_OMEGA = 12;
const rise = (t: number): number => 1 - (1 + GLIDE_OMEGA * t) * Math.exp(-GLIDE_OMEGA * t);

/**
 * The share of the intro glide done `t` seconds after the overlay lifts: a critically damped
 * spring's rise from rest, scaled to land exactly at GLIDE_S (MAX_LAG would hold the follow
 * spring within 8 px of the pose, so the glide is its own curve).
 */
export function glide(t: number): number {
  if (t >= GLIDE_S) return 1;
  return t <= 0 ? 0 : rise(t) / rise(GLIDE_S);
}

/** A place in the viewport (px): the courier's centre and its box's side. */
export interface Place {
  x: number;
  y: number;
  scale: number;
}

/**
 * The intro glide from `from` to `to` keeps the courier's form box (80 % of its box, as the
 * courier audit draws it, and `margin` px) off every obstacle (text, controls, cards; docks.ts
 * measureObstacles, in document px) at `scrollY`, at every step of its curve, the first included.
 */
export function glideClear(
  from: Place,
  to: Place,
  obstacles: readonly Box[],
  scrollY: number,
  margin = 2,
): boolean {
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const e = glide((GLIDE_S * i) / steps);
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e;
    const half = ((from.scale + (to.scale - from.scale) * e) * 0.8) / 2 + margin;
    for (const o of obstacles) {
      const top = viewportTop(o, scrollY);
      if (
        x - half < o.left + o.width &&
        x + half > o.left &&
        y - half < top + o.height &&
        y + half > top
      ) {
        return false;
      }
    }
  }
  return true;
}

export interface Shown {
  x: number;
  y: number;
  scale: number;
  /** Lean about the view axis (radians). */
  tilt: number;
  /** Scale along x and y on top of `scale` (1 at rest). */
  sx: number;
  sy: number;
  /** The turn toward the pointer about the vertical and the horizontal axis (createPointerTilt). */
  yaw: number;
  pitch: number;
}

export const AT_REST: Omit<Shown, 'x' | 'y' | 'scale'> = {
  tilt: 0,
  sx: 1,
  sy: 1,
  yaw: 0,
  pitch: 0,
};

interface Channel {
  at: number;
  v: number;
}

/** One critically damped step of `c` toward `target` over `dt` seconds (exact solution). */
function spring(c: Channel, target: number, dt: number, omega = OMEGA): void {
  const d = c.at - target;
  const e = Math.exp(-omega * dt);
  const k = c.v + omega * d;
  c.at = target + (d + k * dt) * e;
  c.v = (c.v - omega * k * dt) * e;
}

export interface Follow {
  /** The shown place for this frame; `dt` in seconds. */
  step(pose: Pose, dt: number, viewportHeight: number): Shown;
  /** The spring has converged on the last pose (no frame is needed until the pose moves). */
  settled(): boolean;
  /** Take the next pose at once. */
  reset(): void;
}

export function createFollow(): Follow {
  const x: Channel = { at: 0, v: 0 };
  const y: Channel = { at: 0, v: 0 };
  const s: Channel = { at: 0, v: 0 };
  let primed = false;
  let rest = true;
  let primedAt = false;
  let lastX = 0;
  let lastY = 0;
  let speedX = 0;
  let speedY = 0;
  const snap = (pose: Pose): void => {
    x.at = pose.x;
    y.at = pose.y;
    s.at = pose.scale;
    x.v = 0;
    y.v = 0;
    s.v = 0;
  };
  return {
    step(pose, dt, viewportHeight) {
      // The lean and the squash read the pose's own speed (the spring may be held at MAX_LAG).
      const vx = dt > 0 && primedAt ? (pose.x - lastX) / Math.min(dt, 0.05) : 0;
      const vy = dt > 0 && primedAt ? (pose.y - lastY) / Math.min(dt, 0.05) : 0;
      lastX = pose.x;
      lastY = pose.y;
      primedAt = true;
      speedX += (vx - speedX) * 0.3;
      speedY += (vy - speedY) * 0.3;
      const jump =
        Math.abs(pose.x - x.at) + Math.abs(pose.y - y.at) > JUMP_VH * Math.max(1, viewportHeight);
      if (!primed || jump || pose.hidden || dt <= 0) {
        primed = true;
        snap(pose);
        if (jump || pose.hidden) {
          speedX = 0;
          speedY = 0;
        }
      } else {
        const step = Math.min(dt, 0.05);
        spring(x, pose.x, step);
        spring(y, pose.y, step);
        spring(s, pose.scale, step);
        // Held within MAX_LAG of the pose: the drawn form stays inside its lane mid-scroll.
        const dx = x.at - pose.x;
        const dy = y.at - pose.y;
        const lag = Math.hypot(dx, dy);
        if (lag > MAX_LAG) {
          x.at = pose.x + (dx * MAX_LAG) / lag;
          y.at = pose.y + (dy * MAX_LAG) / lag;
          // Held at the edge, it carries no momentum past the pose (no overshoot).
          x.v = 0;
          y.v = 0;
        }
        s.at = Math.max(pose.scale * 0.9, Math.min(pose.scale * 1.1, s.at));
      }
      rest =
        Math.abs(x.at - pose.x) < REST_PX &&
        Math.abs(y.at - pose.y) < REST_PX &&
        Math.abs(s.at - pose.scale) < REST_PX &&
        Math.abs(x.v) + Math.abs(y.v) < REST_SPEED &&
        Math.abs(speedX) + Math.abs(speedY) < REST_SPEED;
      if (rest) {
        snap(pose);
        if (pose.whip === 0) return { x: pose.x, y: pose.y, scale: pose.scale, ...AT_REST };
      }
      const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -speedX * LEAN));
      const squash = Math.min(MAX_SQUASH, Math.abs(speedY) * SQUASH);
      // The whip stretches the form across its spin: a motion-blur feel.
      const stretch = STRETCH * Math.sin(Math.PI * pose.whip);
      return {
        x: x.at,
        y: y.at,
        scale: s.at,
        tilt: lean,
        sx: (1 + squash / 2) * (1 + stretch),
        sy: (1 - squash) * (1 - stretch / 2),
        yaw: 0,
        pitch: 0,
      };
    },
    settled: () => rest,
    reset() {
      primed = false;
    },
  };
}

/**
 * At most this many whips a second (owner 2026-11-14: «the turns are so fast I can't see them»):
 * a half turn that swaps the form never takes less than 0.6 s, however fast the scroll.
 */
export const WHIP_RATE = 1 / 0.6;

export interface Turn {
  /** The pose with its shown turn: `whip`, `form` and `rotation` trail the scroll's swap. */
  step(pose: Pose, dt: number, viewportHeight: number): Pose;
  /** The shown turn is the pose's (no frame is needed for it). */
  settled(): boolean;
}

/**
 * The shown whip follows the pose's at most WHIP_RATE per second, and the form and the turn are
 * drawn from it (pose.ts whipTurn). A swap the scroll has finished (the next hold, or another
 * travel) still plays out on the clock, with the forms it began with, the dock's turn as its base.
 * The first frame, a jump (as createFollow's), a hidden courier or a form unknown to the swap take
 * the pose at once.
 */
export function createTurn(): Turn {
  let w: number | null = null;
  let pair: { from: Form; to: Form } | null = null;
  let done = true;
  let lastX = 0;
  let lastY = 0;
  return {
    step(pose, dt, viewportHeight) {
      const jump = Math.abs(pose.x - lastX) + Math.abs(pose.y - lastY) > JUMP_VH * viewportHeight;
      lastX = pose.x;
      lastY = pose.y;
      if (pose.swap) {
        // The way back mid-turn (a fling into the next travel): the same shown turn, counted
        // from the other form.
        if (w !== null && pair?.from === pose.swap.to && pair.to === pose.swap.from) w = 1 - w;
        pair = { from: pose.swap.from, to: pose.swap.to };
      }
      const known = pair !== null && (pose.form === pair.from || pose.form === pair.to);
      if (pair === null || !known || pose.hidden || jump || dt <= 0 || w === null) {
        w = pose.swap ? pose.whip : null;
        if (!pose.swap) pair = null;
        done = true;
        return pose;
      }
      const target = pose.swap ? pose.whip : pose.form === pair.to ? 1 : 0;
      const most = WHIP_RATE * Math.min(dt, 0.05);
      w += Math.max(-most, Math.min(most, target - w));
      done = w === target;
      if (!pose.swap && done) {
        w = null;
        pair = null;
        return pose;
      }
      const base = pose.swap?.base ?? pose.rotation;
      return {
        ...pose,
        whip: w,
        form: w < 0.5 ? pair.from : pair.to,
        rotation: whipTurn(base, w),
      };
    },
    settled: () => done,
  };
}

/**
 * The turn toward the pointer at a dock (owner 2026-11-17: «really playing with the mouse»): within
 * two boxes of the courier it turns its face toward a fine pointer, at most MAX_YAW and MAX_PITCH,
 * fading out by four boxes; on a slower critically damped spring than the place, so it eases, never
 * snaps. None in a travel, at the logos (the hand-offs draw the flat logo mark), at the smile (the
 * arch) or hidden: there it eases back to 0. A turn in place moves no box, so no lane changes.
 */
export const MAX_YAW = 0.35;
export const MAX_PITCH = 0.22;
const TILT_OMEGA = 8;

export interface PointerTilt {
  /** The pointer's place in the viewport (px), or null when it left the page. */
  aim(at: { x: number; y: number } | null): void;
  /** The shown turn toward the pointer for this frame; `dt` in seconds. */
  step(pose: Pose, place: Place, dt: number): { yaw: number; pitch: number };
  /** The turn has come to rest (no frame is needed for it). */
  settled(): boolean;
}

/** Where the courier may turn toward the pointer: at a dock, but the logos, the smile or hidden. */
export function canTurn(pose: Pose): boolean {
  return (
    !pose.hidden &&
    pose.dock !== null &&
    pose.dock !== 'header' &&
    pose.dock !== 'footer' &&
    pose.dock !== 'smile' &&
    flatAmount(pose) === 0
  );
}

export function createPointerTilt(): PointerTilt {
  const yaw: Channel = { at: 0, v: 0 };
  const pitch: Channel = { at: 0, v: 0 };
  let pointer: { x: number; y: number } | null = null;
  let rest = true;
  return {
    aim(at) {
      pointer = at;
    },
    step(pose, place, dt) {
      let ty = 0;
      let tp = 0;
      if (pointer !== null && canTurn(pose)) {
        const r = Math.max(60, place.scale);
        const dx = pointer.x - place.x;
        const dy = pointer.y - place.y;
        const near = 1 - smoothstep01((Math.hypot(dx, dy) - 2 * r) / (2 * r));
        const unit = (v: number): number => Math.max(-1, Math.min(1, v / (2 * r)));
        ty = MAX_YAW * unit(dx) * near;
        tp = MAX_PITCH * unit(dy) * near;
      }
      const step = Math.min(Math.max(0, dt), 0.05);
      spring(yaw, ty, step, TILT_OMEGA);
      spring(pitch, tp, step, TILT_OMEGA);
      rest =
        Math.abs(yaw.at - ty) + Math.abs(pitch.at - tp) < 1e-3 &&
        Math.abs(yaw.v) + Math.abs(pitch.v) < 1e-3;
      if (rest) {
        yaw.at = ty;
        pitch.at = tp;
        yaw.v = 0;
        pitch.v = 0;
      }
      return { yaw: yaw.at, pitch: pitch.at };
    },
    settled: () => rest,
  };
}

/** 0..1 eased, clamped. */
const smoothstep01 = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/**
 * The seat at a dock (owner 2026-11-17: «a springy settle»): arriving at D2 to D6 from a travel,
 * the courier's size rings once, about 3 % over and 1 % under, and rests within SETTLE_S. Only after
 * SETTLE_AFTER s on the way, so a load at a dock or a scroll that wavers on its edge rings nothing;
 * never at the logos, where the hand-off draws the flat logo mark at its exact size.
 */
const SETTLE_AMP = 0.06;
const SETTLE_TAU = 0.11;
const SETTLE_PERIOD = 0.32;
export const SETTLE_S = 0.5;
const SETTLE_AFTER = 0.25;

export interface Settle {
  /** The factor on the shown size for this frame (1 at rest); `dt` in seconds. */
  step(pose: Pose, dt: number): number;
  settled(): boolean;
}

export function createSettle(): Settle {
  let away = 0;
  let docked = true;
  let t = -1;
  return {
    step(pose, dt) {
      // Hidden (home in a logo, or no courier) is no time on the way: a jump from there rings nothing.
      if (pose.hidden) {
        away = 0;
        docked = true;
        t = -1;
        return 1;
      }
      const at = pose.dock;
      if (at === null) {
        away += Math.max(0, dt);
        docked = false;
        t = -1;
      } else {
        if (!docked && away >= SETTLE_AFTER && at !== 'header' && at !== 'footer') t = 0;
        else if (t >= 0) t += Math.max(0, dt);
        away = 0;
        docked = true;
      }
      if (t < 0) return 1;
      if (t >= SETTLE_S) {
        t = -1;
        return 1;
      }
      return (
        1 + SETTLE_AMP * Math.exp(-t / SETTLE_TAU) * Math.sin((2 * Math.PI * t) / SETTLE_PERIOD)
      );
    },
    settled: () => t < 0,
  };
}
