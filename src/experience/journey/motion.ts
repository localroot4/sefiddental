/**
 * The courier's secondary motion (docs/experience/journey.md section 3): a render-only layer on top
 * of the pure pose. The shown place follows the pose with a critically damped spring (no overshoot
 * past a dock), and its velocity leans the form into the move (a tilt) and squashes it a little
 * along the scroll; the whip stretches it as it spins. At rest the spring has converged and snaps
 * onto the pose exactly, so reverse scrolling and a reload stay exact; a jump (a reload, an anchor,
 * a programmatic scroll of more than half a viewport) is taken at once, not chased.
 */
import type { Pose } from './pose';

/** The spring's angular frequency (1/s): about 0.3 s to settle, critically damped. */
const OMEGA = 24;
/** Under this distance (px) and speed (px/s) the shown place is the pose. */
const REST_PX = 0.05;
const REST_SPEED = 1;
/** Lean (radians) per px/s of sideways speed, and its limit. */
const LEAN = 0.00012;
const MAX_LEAN = 0.16;
/** Squash per px/s of vertical speed, and its limit. */
const SQUASH = 0.00005;
const MAX_SQUASH = 0.07;
/** A move of more than this share of the viewport height in one frame is taken at once. */
const JUMP_VH = 0.5;

export interface Shown {
  x: number;
  y: number;
  scale: number;
  /** Lean about the view axis (radians). */
  tilt: number;
  /** Scale along x and y on top of `scale` (1 at rest). */
  sx: number;
  sy: number;
}

export const AT_REST: Omit<Shown, 'x' | 'y' | 'scale'> = { tilt: 0, sx: 1, sy: 1 };

interface Channel {
  at: number;
  v: number;
}

/** One critically damped step of `c` toward `target` over `dt` seconds (exact solution). */
function spring(c: Channel, target: number, dt: number): void {
  const d = c.at - target;
  const e = Math.exp(-OMEGA * dt);
  const k = c.v + OMEGA * d;
  c.at = target + (d + k * dt) * e;
  c.v = (c.v - OMEGA * k * dt) * e;
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
      const jump =
        Math.abs(pose.x - x.at) + Math.abs(pose.y - y.at) > JUMP_VH * Math.max(1, viewportHeight);
      if (!primed || jump || pose.hidden || dt <= 0) {
        primed = true;
        snap(pose);
      } else {
        const step = Math.min(dt, 0.05);
        spring(x, pose.x, step);
        spring(y, pose.y, step);
        spring(s, pose.scale, step);
      }
      rest =
        Math.abs(x.at - pose.x) < REST_PX &&
        Math.abs(y.at - pose.y) < REST_PX &&
        Math.abs(s.at - pose.scale) < REST_PX &&
        Math.abs(x.v) + Math.abs(y.v) < REST_SPEED;
      if (rest) {
        snap(pose);
        if (pose.whip === 0) return { x: pose.x, y: pose.y, scale: pose.scale, ...AT_REST };
      }
      const lean = Math.max(-MAX_LEAN, Math.min(MAX_LEAN, -x.v * LEAN));
      const squash = Math.min(MAX_SQUASH, Math.abs(y.v) * SQUASH);
      // The whip stretches the form across its spin: a motion-blur feel.
      const stretch = 0.08 * Math.sin(Math.PI * pose.whip);
      return {
        x: x.at,
        y: y.at,
        scale: s.at,
        tilt: lean,
        sx: (1 + squash / 2) * (1 + stretch),
        sy: (1 - squash) * (1 - stretch / 2),
      };
    },
    settled: () => rest,
    reset() {
      primed = false;
    },
  };
}
