import { describe, expect, it } from 'vitest';

import { createFollow, GLIDE_S, glide, glideClear } from './motion';
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

describe('the drawn form stays in its lane', () => {
  it('M4 at any speed the shown place trails the pose by MAX_LAG at most, and grows under LANE_MARGIN', async () => {
    const { MAX_LAG } = await import('./motion');
    const { LANE_MARGIN } = await import('./route');
    const follow = createFollow();
    let y = 400;
    follow.step(pose(500, y, 150), 1 / 60, 900);
    for (let i = 0; i < 120; i += 1) {
      // 1200 px/s of scroll the courier rides, and sideways at 900 px/s.
      y += 20;
      const target = pose(500 + i * 15, y % 900, 150);
      const shown = follow.step({ ...target, whip: (i % 30) / 30 }, 1 / 60, 900);
      const lag = Math.hypot(shown.x - target.x, shown.y - target.y);
      expect(lag).toBeLessThanOrEqual(MAX_LAG + 1e-9);
      // The drawn box's half against the pose's: the lean turns it, the squash and stretch scale.
      const half = (shown.scale * 0.8) / 2;
      const turned = half * (Math.abs(Math.cos(shown.tilt)) + Math.abs(Math.sin(shown.tilt)));
      const grown = turned * Math.max(shown.sx, shown.sy) + lag - (target.scale * 0.8) / 2;
      expect(grown).toBeLessThan(LANE_MARGIN);
    }
  });

  it("M5 the intro glide is the spring's own rise: from 0, never back, on 1 at GLIDE_S and after", () => {
    expect(GLIDE_S).toBeCloseTo(0.6, 5);
    expect(glide(0)).toBe(0);
    expect(glide(-0.1)).toBe(0);
    let last = 0;
    for (let t = 0.01; t < GLIDE_S; t += 0.01) {
      const e = glide(t);
      expect(e).toBeGreaterThan(last);
      expect(e).toBeLessThan(1);
      last = e;
    }
    // Slow out of the hole (no velocity at the start), most of the way by half time.
    expect(glide(0.02)).toBeLessThan(0.05);
    expect(glide(GLIDE_S / 2)).toBeGreaterThan(0.7);
    expect(glide(GLIDE_S)).toBe(1);
    expect(glide(5)).toBe(1);
  });

  it('M6 the intro glide is clear only if no frame of its form box touches an obstacle', () => {
    const box = (left: number, top: number, width: number, height: number, pin = null) => ({
      left,
      top,
      width,
      height,
      pin,
    });
    const from = { x: 400, y: 300, scale: 100 };
    const to = { x: 400, y: 700, scale: 50 };
    // A card beside the way down: clear (the form box is 80 % of the courier's box).
    expect(glideClear(from, to, [box(470, 0, 200, 900)], 0)).toBe(true);
    // A line of text across the way: not clear.
    expect(glideClear(from, to, [box(300, 500, 300, 20)], 0)).toBe(false);
    // The hole itself on a card: not clear from the first frame.
    expect(glideClear(from, to, [box(430, 280, 100, 40)], 0)).toBe(false);
    // Obstacles in document px: scrolled 400 down, a box at 900 is on the way at 500.
    expect(glideClear(from, to, [box(300, 900, 300, 20)], 400)).toBe(false);
    expect(glideClear(from, to, [box(300, 900, 300, 20)], 0)).toBe(true);
  });
});
