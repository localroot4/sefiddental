import { describe, expect, it } from 'vitest';

import { tierSettings } from '@/lib/qualityTier';

import {
  damp,
  fitDistance,
  levelBlend,
  levelFromChoice,
  molarDraws,
  passViewport,
  pinProgress,
  ramp,
  STEP_YAW,
  turntableYaw,
  wipeAmplitude,
  wipeDraws,
  wipeEdge,
  WIPE_REST,
  workflowDraws,
  workflowStages,
} from './math';

const desktop = { width: 1440, height: 900, dpr: 1 };
const phone = { width: 390, height: 844, dpr: 3 };

describe('scene 4 level and turntable', () => {
  it('reads the checked chip position, plain without a choice or for anything unknown', () => {
    expect(levelFromChoice(null)).toBe(0);
    expect(levelFromChoice('1')).toBe(0);
    expect(levelFromChoice('2')).toBe(1);
    expect(levelFromChoice('3')).toBe(2);
    for (const bad of ['0', '4', '', '2.5', 'vip']) expect(levelFromChoice(bad)).toBe(0);
  });

  it('turns a third of a turn per level, the same at any scroll and time', () => {
    const at = (s: number) => turntableYaw(s, 0.4, 2);
    expect(at(1) - at(0)).toBeCloseTo(STEP_YAW, 10);
    expect(at(2) - at(1)).toBeCloseTo((2 * Math.PI) / 3, 10);
    // The pinned scrub adds at most 0.6 rad over the pin, clamped outside it.
    expect(turntableYaw(0, 1, 0) - turntableYaw(0, 0, 0)).toBeCloseTo(0.6, 10);
    expect(turntableYaw(0, 5, 0)).toBe(turntableYaw(0, 1, 0));
  });

  it('blends VIP over the first step and CIP over the second', () => {
    expect(levelBlend(0)).toEqual({ refine: 0, character: 0 });
    expect(levelBlend(0.5)).toEqual({ refine: 0.5, character: 0 });
    expect(levelBlend(1)).toEqual({ refine: 1, character: 0 });
    expect(levelBlend(1.5)).toEqual({ refine: 1, character: 0.5 });
    expect(levelBlend(2)).toEqual({ refine: 1, character: 1 });
    expect(levelBlend(-1)).toEqual({ refine: 0, character: 0 });
  });

  it('damps frame-rate independently and never overshoots', () => {
    const once = damp(0, 1, 0.2, 0.3);
    const twice = damp(damp(0, 1, 0.1, 0.3), 1, 0.1, 0.3);
    expect(twice).toBeCloseTo(once, 10);
    expect(once).toBeGreaterThan(0);
    expect(once).toBeLessThan(1);
    expect(damp(0.4, 1, 0, 0.3)).toBe(0.4);
    expect(damp(0.4, 1, 0.016, 0)).toBe(1);
  });

  it('fits the box by height in a tall view and by width in a wide one', () => {
    const half = Math.tan((12 * Math.PI) / 180);
    expect(fitDistance(24, 0.5, 1, 1)).toBeCloseTo(1 / (2 * half * 0.5), 10);
    expect(fitDistance(24, 2, 1, 1)).toBeCloseTo(1 / (2 * half), 10);
  });
});

describe('scene 5 beats', () => {
  it('ramps smoothly between its edges', () => {
    expect(ramp(-1, 0, 1)).toBe(0);
    expect(ramp(0.5, 0, 1)).toBe(0.5);
    expect(ramp(2, 0, 1)).toBe(1);
  });

  it('shows one beat per step: scan, wireframe, solid with glaze, warm light', () => {
    const scan = workflowStages(0);
    // Mostly formed as the pin starts, complete a little after.
    expect(scan.assemble).toBeGreaterThan(0.7);
    expect(workflowStages(0.1).assemble).toBe(1);
    expect(scan.points).toBe(1);
    expect(scan.wire).toBe(0);
    expect(scan.build).toBe(0);

    const design = workflowStages(1 / 3);
    expect(design.wire).toBe(1);
    expect(design.points).toBeLessThan(0.3);
    expect(design.build).toBe(0);

    const make = workflowStages(2 / 3);
    expect(make.build).toBe(1);
    expect(make.wire).toBeLessThan(0.5);
    expect(make.glaze).toBeGreaterThan(0.4);
    expect(make.warm).toBe(0);

    const smile = workflowStages(1);
    expect(smile).toMatchObject({ points: 0, wire: 0, build: 1, glaze: 1, warm: 1 });
  });

  it('forms the cloud as the stage comes up to the nav, before the pin starts', () => {
    expect(workflowStages(-0.3).assemble).toBe(0);
    expect(workflowStages(-0.1).assemble).toBeGreaterThan(0.3);
  });

  it('measures the pin on the room: 0 when the stage sticks, 1 at the end of the room', () => {
    // nav 72, stage 828, room 1800: the room's top is at 900 when the stage reaches the nav.
    expect(pinProgress(900, 72, 828, 1800)).toBe(0);
    expect(pinProgress(0, 72, 828, 1800)).toBe(0.5);
    expect(pinProgress(-900, 72, 828, 1800)).toBe(1);
    expect(pinProgress(1080, 72, 828, 1800)).toBeLessThan(0);
    expect(pinProgress(100, 72, 828, 0)).toBe(0);
  });
});

describe('scene 6 wipe', () => {
  it('puts the edge where CompareSlider draws its divider, after photo on the end side', () => {
    expect(wipeEdge(50, true)).toEqual({ edge: 0.5, afterLeft: true });
    expect(wipeEdge(20, true)).toEqual({ edge: 0.8, afterLeft: true });
    expect(wipeEdge(20, false)).toEqual({ edge: 0.2, afterLeft: false });
    expect(wipeEdge(150, true).edge).toBe(0);
    expect(wipeEdge(Number.NaN, true).edge).toBe(0.5);
  });

  it('breathes at rest, rises with a drag and settles back', () => {
    let amp = WIPE_REST;
    for (let i = 0; i < 10; i += 1) amp = wipeAmplitude(amp, 1.5, 1 / 60);
    expect(amp).toBeGreaterThan(WIPE_REST * 4);
    expect(amp).toBeLessThanOrEqual(0.03);
    for (let i = 0; i < 180; i += 1) amp = wipeAmplitude(amp, 0, 1 / 60);
    expect(amp).toBeCloseTo(WIPE_REST, 3);
  });
});

describe('tier gates', () => {
  it('scene 4: the 3D molar at tiers 2 and 3, and at tier 1 from 1024 px only', () => {
    expect(molarDraws(tierSettings(3, desktop, true))).toBe(true);
    expect(molarDraws(tierSettings(2, phone, false))).toBe(true);
    expect(molarDraws(tierSettings(1, desktop, true))).toBe(true);
    expect(molarDraws(tierSettings(1, phone, false))).toBe(false);
    expect(molarDraws(tierSettings(0, desktop, true))).toBe(false);
  });

  it('scene 5: only the pinned diagonal at tiers 2 and 3', () => {
    expect(workflowDraws(3, true)).toBe(true);
    expect(workflowDraws(2, true)).toBe(true);
    expect(workflowDraws(2, false)).toBe(false);
    expect(workflowDraws(1, true)).toBe(false);
  });

  it('scene 6: the WebGL wipe at tiers 2 and 3 on a wide screen, the DOM clip-path otherwise', () => {
    expect(wipeDraws(tierSettings(3, desktop, true), true)).toBe(true);
    expect(wipeDraws(tierSettings(2, desktop, true), true)).toBe(true);
    // A window narrowed under 1024 px after the tier was chosen.
    expect(wipeDraws(tierSettings(2, desktop, true), false)).toBe(false);
    expect(wipeDraws(tierSettings(1, desktop, true), true)).toBe(false);
    expect(wipeDraws(tierSettings(3, phone, false), false)).toBe(false);
  });

  it('scene 5 particles follow the tier: 100, 50 and 20 percent', () => {
    expect(
      [3, 2, 1].map((t) => tierSettings(t as 1 | 2 | 3, desktop, true).scene5Particles),
    ).toEqual([3000, 1500, 600]);
  });
});

describe('slot viewport', () => {
  const size = { width: 1440, height: 900 };

  it('flips y to the canvas bottom-left and clips the scissor to the canvas', () => {
    expect(passViewport({ left: 600, top: 100, width: 200, height: 240 }, size)).toEqual({
      x: 600,
      y: 560,
      width: 200,
      height: 240,
      scissor: { x: 600, y: 560, width: 200, height: 240 },
    });
    const partly = passViewport({ left: -50, top: 800, width: 200, height: 240 }, size);
    expect(partly).toMatchObject({ x: -50, y: -140 });
    expect(partly?.scissor).toEqual({ x: 0, y: 0, width: 150, height: 100 });
  });

  it('draws nothing for an empty or off-screen box', () => {
    expect(passViewport({ left: 0, top: 0, width: 0, height: 100 }, size)).toBeNull();
    expect(passViewport({ left: 0, top: 900, width: 100, height: 100 }, size)).toBeNull();
    expect(passViewport({ left: 0, top: -100, width: 100, height: 100 }, size)).toBeNull();
    expect(passViewport({ left: 1440, top: 0, width: 100, height: 100 }, size)).toBeNull();
  });
});
