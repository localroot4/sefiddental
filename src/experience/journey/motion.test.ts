import { describe, expect, it } from 'vitest';

import { createFollow } from './motion';
import { NO_POSE, type Pose } from './pose';

const pose = (x: number, y: number, scale = 100): Pose => ({
  ...NO_POSE,
  hidden: false,
  presence: 1,
  opacity: 1,
  x,
  y,
  scale,
});

describe('secondary motion', () => {
  it('M1 follows a moved pose without overshoot, leans into the move, and lands on it exactly', () => {
    const follow = createFollow();
    follow.step(pose(100, 400), 1 / 60, 900);
    let last = 100;
    let leaned = false;
    for (let i = 0; i < 120; i += 1) {
      const shown = follow.step(pose(300, 400), 1 / 60, 900);
      expect(shown.x).toBeGreaterThanOrEqual(last - 1e-9);
      expect(shown.x).toBeLessThanOrEqual(300);
      if (Math.abs(shown.tilt) > 0.01) leaned = true;
      last = shown.x;
    }
    expect(leaned).toBe(true);
    expect(follow.settled()).toBe(true);
    expect(follow.step(pose(300, 400), 1 / 60, 900)).toEqual({
      x: 300,
      y: 400,
      scale: 100,
      tilt: 0,
      sx: 1,
      sy: 1,
    });
  });

  it('M2 a jump of more than half a viewport is taken at once; a hidden pose too', () => {
    const follow = createFollow();
    follow.step(pose(100, 100), 1 / 60, 900);
    expect(follow.step(pose(100, 700), 1 / 60, 900).y).toBe(700);
    expect(follow.step({ ...pose(500, 500), hidden: true }, 1 / 60, 900).x).toBe(500);
  });

  it('M3 settles within 0.4 s to under a pixel after a 300 px move', () => {
    const follow = createFollow();
    follow.step(pose(0, 400), 1 / 60, 900);
    let shown = follow.step(pose(300, 400), 1 / 60, 900);
    for (let t = 1 / 60; t < 0.4; t += 1 / 60) shown = follow.step(pose(300, 400), 1 / 60, 900);
    expect(Math.abs(shown.x - 300)).toBeLessThan(1);
  });
});
