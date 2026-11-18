import { describe, expect, it } from 'vitest';

import {
  createFollow,
  CLICK_S,
  createPointerTilt,
  createSeatClick,
  createSettle,
  createTrail,
  createTurn,
  GLIDE_S,
  glide,
  glideClear,
  MAX_PITCH,
  MAX_YAW,
  SETTLE_S,
  TRAIL_S,
  WHIP_RATE,
} from './motion';
import { NO_POSE, whipTurn, type Pose } from './pose';

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
      yaw: 0,
      pitch: 0,
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

describe('the shown turn (owner 2026-11-14: turns too fast to see)', () => {
  // A travel from the tooth to the mark at `whip`, the docks' own turn 0.3.
  const swap = (whip: number): Pose => ({
    ...pose(100, 400),
    whip,
    form: whip < 0.5 ? 'tooth' : 'mark',
    rotation: whipTurn(0.3, whip),
    swap: { from: 'tooth', to: 'mark', base: 0.3 },
  });

  it('M7 a whip the scroll finishes in one frame plays out at WHIP_RATE, the form swapping at edge-on', () => {
    const turn = createTurn();
    turn.step(swap(0), 1 / 60, 900);
    const shown = turn.step(swap(1), 1 / 60, 900);
    expect(shown.whip).toBeCloseTo(WHIP_RATE / 60);
    expect(shown.form).toBe('tooth');
    expect(shown.rotation).toBeCloseTo(whipTurn(0.3, WHIP_RATE / 60));
    expect(turn.settled()).toBe(false);
    let frames = 1;
    // The turn as one angle: the new form's is the old one's less a half turn.
    const angle = (p: Pose): number => p.rotation + (p.form === 'mark' ? Math.PI : 0);
    let last = angle(shown);
    let most = 0;
    for (; frames < 120 && !turn.settled(); frames += 1) {
      const next = turn.step(swap(1), 1 / 60, 900);
      most = Math.max(most, Math.abs(angle(next) - last));
      last = angle(next);
      expect(next.form).toBe(next.whip < 0.5 ? 'tooth' : 'mark');
    }
    // At least 0.6 s for the half turn, never more than 0.12 rad in a 60 Hz frame.
    expect(frames / 60).toBeGreaterThanOrEqual(0.6 - 1 / 60);
    expect(most).toBeLessThan(0.12);
    expect(turn.step(swap(1), 1 / 60, 900).whip).toBe(1);
  });

  it('M8 a swap the scroll left for the next hold still plays out, with the hold turn as its base; then the pose is shown as it is', () => {
    const turn = createTurn();
    turn.step(swap(0.2), 1 / 60, 900);
    const hold: Pose = { ...pose(100, 400), form: 'mark', rotation: -0.2, whip: 0 };
    const mid = turn.step(hold, 1 / 60, 900);
    expect(mid.whip).toBeCloseTo(0.2 + WHIP_RATE / 60);
    expect(mid.form).toBe('tooth');
    expect(mid.rotation).toBeCloseTo(whipTurn(-0.2, mid.whip));
    for (let i = 0; i < 120 && !turn.settled(); i += 1) turn.step(hold, 1 / 60, 900);
    expect(turn.step(hold, 1 / 60, 900)).toEqual(hold);
  });

  it('M10 a fling into the way back mid-turn keeps the shown form: the turn counts from the other form', () => {
    const turn = createTurn();
    turn.step(swap(0), 1 / 60, 900);
    const mid = turn.step(swap(1), 1 / 60, 900);
    expect(mid.form).toBe('tooth');
    // The next travel swaps back (mark to tooth), its whip at 0.
    const back: Pose = {
      ...pose(100, 400),
      whip: 0,
      form: 'mark',
      rotation: whipTurn(-0.1, 0),
      swap: { from: 'mark', to: 'tooth', base: -0.1 },
    };
    const next = turn.step(back, 1 / 60, 900);
    expect(next.form).toBe('tooth');
    expect(next.whip).toBeCloseTo(1 - mid.whip - WHIP_RATE / 60);
  });

  it('M9 the first frame, a jump and a hidden courier take the pose at once', () => {
    const turn = createTurn();
    expect(turn.step(swap(0.9), 1 / 60, 900)).toEqual(swap(0.9));
    turn.step(swap(0), 1 / 60, 900);
    expect(turn.step({ ...swap(1), y: 1400 }, 1 / 60, 900).whip).toBe(1);
    turn.step(swap(0), 1 / 60, 900);
    expect(turn.step({ ...swap(1), hidden: true }, 1 / 60, 900).whip).toBe(1);
    expect(turn.settled()).toBe(true);
  });
});

describe('pointer tilt and the seat at a dock', () => {
  const docked = (dock: Pose['dock']): Pose => ({ ...pose(500, 400), dock });
  const run = (
    tilt: ReturnType<typeof createPointerTilt>,
    p: Pose,
    seconds: number,
  ): { yaw: number; pitch: number } => {
    let out = { yaw: 0, pitch: 0 };
    for (let t = 0; t < seconds; t += 1 / 60)
      out = tilt.step(p, { x: 500, y: 400, scale: 100 }, 1 / 60);
    return out;
  };

  it('M10 at a dock it turns toward a near pointer within its limits, eases back as it leaves, and rests', () => {
    const tilt = createPointerTilt();
    tilt.aim({ x: 680, y: 560 }); // right of it and below: the face turns right and down
    const near = run(tilt, docked('services'), 1.5);
    expect(near.yaw).toBeGreaterThan(0.2);
    expect(near.yaw).toBeLessThanOrEqual(MAX_YAW + 1e-9);
    expect(near.pitch).toBeGreaterThan(0.1);
    expect(near.pitch).toBeLessThanOrEqual(MAX_PITCH + 1e-9);
    expect(tilt.settled()).toBe(true);
    // Eases, never snaps: one frame moves it a little.
    tilt.aim({ x: 100, y: 400 });
    const next = tilt.step(docked('services'), { x: 500, y: 400, scale: 100 }, 1 / 60);
    expect(Math.abs(next.yaw - near.yaw)).toBeLessThan(0.05);
    // Far away (past four boxes) nothing pulls: back to 0.
    tilt.aim({ x: 1400, y: 400 });
    expect(run(tilt, docked('services'), 1.5)).toEqual({ yaw: 0, pitch: 0 });
    expect(tilt.settled()).toBe(true);
  });

  it('M11 no turn in a travel, at the logos, at the smile or hidden', () => {
    for (const p of [
      { ...pose(500, 400), dock: null, to: 'restoration' as const },
      docked('header'),
      docked('footer'),
      docked('smile'),
      { ...docked('services'), hidden: true },
    ]) {
      const tilt = createPointerTilt();
      tilt.aim({ x: 600, y: 450 });
      expect(run(tilt, p, 0.5)).toEqual({ yaw: 0, pitch: 0 });
    }
  });

  it('M12 arriving at a dock from a travel the size rings once, under 4.5 %, and rests within SETTLE_S', () => {
    const settle = createSettle();
    const travel = { ...pose(500, 400), dock: null, to: 'services' as const };
    for (let t = 0; t < 0.5; t += 1 / 60) expect(settle.step(travel, 1 / 60)).toBe(1);
    let most = 1;
    let least = 1;
    let t = 0;
    for (; t < SETTLE_S + 0.1; t += 1 / 60) {
      const k = settle.step(docked('services'), 1 / 60);
      most = Math.max(most, k);
      least = Math.min(least, k);
    }
    expect(most).toBeGreaterThan(1.02);
    expect(most).toBeLessThan(1.045);
    expect(least).toBeGreaterThan(0.98);
    expect(settle.settled()).toBe(true);
    expect(settle.step(docked('services'), 1 / 60)).toBe(1);
  });

  it('M13 no ring after a short waver off the dock, at a load on a dock, or landing in a logo', () => {
    const settle = createSettle();
    const travel = { ...pose(500, 400), dock: null, to: 'services' as const };
    expect(settle.step(docked('services'), 1 / 60)).toBe(1); // a load at the dock
    for (let i = 0; i < 6; i += 1) settle.step(travel, 1 / 60); // 0.1 s off its edge
    for (let i = 0; i < 30; i += 1) expect(settle.step(docked('services'), 1 / 60)).toBe(1);
    for (let i = 0; i < 60; i += 1) settle.step(travel, 1 / 60);
    for (let i = 0; i < 30; i += 1) expect(settle.step(docked('footer'), 1 / 60)).toBe(1);
    // A second home in the header logo (hidden) is no time on the way: a jump to D2 rings nothing.
    for (let i = 0; i < 60; i += 1) settle.step({ ...docked('header'), hidden: true }, 1 / 60);
    for (let i = 0; i < 30; i += 1) expect(settle.step(docked('services'), 1 / 60)).toBe(1);
    // At the smile the seat clicks instead (createSeatClick): no ring.
    for (let i = 0; i < 60; i += 1) settle.step(travel, 1 / 60);
    for (let i = 0; i < 30; i += 1) expect(settle.step(docked('smile'), 1 / 60)).toBe(1);
  });

  it('M14 the trail keeps the travelling places of the last TRAIL_S, oldest first, aged 0..1; none at a dock, flat, hidden or across a jump', () => {
    const trail = createTrail();
    const travel = { ...pose(0, 400), dock: null, to: 'restoration' as const };
    let out: { x: number; age: number }[] = [];
    for (let i = 0; i < 40; i += 1)
      out = trail.step(travel, { x: i * 4, y: 400, scale: 100 }, 1 / 60, 900, true);
    expect(out.length).toBeGreaterThan(10);
    expect(out.length).toBeLessThanOrEqual(Math.ceil(TRAIL_S * 60) + 1);
    expect(out.at(-1)!.age).toBe(0);
    expect(out[0]!.age).toBeLessThan(1);
    expect(out.map((p) => p.x)).toEqual([...out.map((p) => p.x)].sort((a, b) => a - b));
    // Still: no new place; the old ones age out, then the trail is empty.
    for (let i = 0; i < 30; i += 1)
      out = trail.step(travel, { x: 156, y: 400, scale: 100 }, 1 / 60, 900, true);
    expect(out).toEqual([]);
    expect(trail.settled()).toBe(true);
    // At a dock, in the flat hand-off out of the header, hidden or not live: nothing.
    for (const p of [
      docked('services'),
      { ...travel, to: 'services' as const, travel: 0.1 },
      { ...travel, hidden: true },
    ]) {
      const t = createTrail();
      for (let i = 0; i < 10; i += 1)
        out = t.step(p, { x: i * 6, y: 400, scale: 100 }, 1 / 60, 900, true);
      expect(out).toEqual([]);
    }
    const intro = createTrail();
    for (let i = 0; i < 10; i += 1)
      out = intro.step(travel, { x: i * 6, y: 400, scale: 100 }, 1 / 60, 900, false);
    expect(out).toEqual([]);
    // A jump (half the viewport in a frame) clears it.
    const jump = createTrail();
    for (let i = 0; i < 10; i += 1)
      jump.step(travel, { x: i * 6, y: 400, scale: 100 }, 1 / 60, 900, true);
    expect(jump.step(travel, { x: 900, y: 400, scale: 100 }, 1 / 60, 900, true)).toEqual([]);
  });

  it('M15 the seat clicks once as the tooth meets its slot in a scroll down: up and back within CLICK_S; never on a load, a jump or a scroll back', () => {
    const at = (local: number): Pose => ({ ...docked('smile'), form: 'tooth', local });
    const click = createSeatClick(0.15);
    expect(click.step(at(0.1), 1 / 60)).toBe(0);
    expect(click.step(at(0.16), 1 / 60)).toBe(0); // the crossing frame starts it at 0
    let most = 0;
    for (let t = 0; t < CLICK_S + 0.05; t += 1 / 60)
      most = Math.max(most, click.step(at(0.2), 1 / 60));
    expect(most).toBeGreaterThan(0.95);
    expect(click.settled()).toBe(true);
    expect(click.step(at(0.2), 1 / 60)).toBe(0);
    // A load at the smile past the slot, a scroll back across it, a jump over it: none.
    const load = createSeatClick(0.15);
    expect(load.step(at(0.3), 1 / 60)).toBe(0);
    expect(load.step(at(0.31), 1 / 60)).toBe(0);
    load.step(at(0.1), 1 / 60);
    for (let i = 0; i < 10; i += 1) expect(load.step(at(0.12 + i * 0.001), 1 / 60)).toBe(0);
    const jump = createSeatClick(0.15);
    jump.step(at(0.0), 1 / 60);
    jump.step(at(0.5), 1 / 60);
    expect(jump.settled()).toBe(true);
  });
});
