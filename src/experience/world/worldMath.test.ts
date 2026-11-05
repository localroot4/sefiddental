import { describe, expect, it } from 'vitest';

import { tierSettings } from '@/lib/qualityTier';

import { SCENES } from '../scenes/registry';

import {
  CAMERA_PATH,
  cameraPose,
  lightDrift,
  NEUTRAL_POSE,
  PARTICLES_MAX,
  rectToCamera,
  underWarmLayer,
  WOBBLE_FULL_PX_S,
  wobbleStep,
  worldSettings,
} from './worldMath';

const VIEWPORT = { width: 1440, height: 900, dpr: 1 };
const ORDER = SCENES.map((scene) => scene.id);

describe('worldSettings (experience direction section 3)', () => {
  it('WM1 particles 100 / 50 / 20 %, grain from tier 2, bloom and depth of field at tier 3', () => {
    const at = (tier: 1 | 2 | 3) => worldSettings(tier, tierSettings(tier, VIEWPORT, true));
    expect([at(3).particles, at(2).particles, at(1).particles]).toEqual([
      PARTICLES_MAX,
      PARTICLES_MAX / 2,
      PARTICLES_MAX / 5,
    ]);
    expect([at(3).grain, at(2).grain, at(1).grain]).toEqual([true, true, false]);
    expect([at(3).glow, at(2).glow, at(1).glow]).toEqual([true, false, false]);
    expect([at(3).dof, at(2).dof, at(1).dof]).toEqual([true, false, false]);
  });

  it('WM2 shadows soft / hard / none; soft is a wider PCF radius on a larger map', () => {
    const at = (tier: 1 | 2 | 3) => worldSettings(tier, tierSettings(tier, VIEWPORT, true));
    expect([at(3).shadows, at(2).shadows, at(1).shadows]).toEqual(['soft', 'hard', 'none']);
    expect(at(3).shadowRadius).toBeGreaterThan(at(2).shadowRadius);
    expect(at(3).shadowMapSize).toBeGreaterThan(at(2).shadowMapSize);
    expect(at(3).shadowMapSize).toBeLessThanOrEqual(2048);
  });

  it('WM3 tier 1 draws only while a scene is mounted; transmission only at tier 3', () => {
    const at = (tier: 1 | 2 | 3) => worldSettings(tier, tierSettings(tier, VIEWPORT, true));
    expect([at(3).drawsIdle, at(2).drawsIdle, at(1).drawsIdle]).toEqual([true, true, false]);
    expect(at(3).transmission).toBeGreaterThan(0);
    expect(at(2).transmission).toBe(0);
  });
});

describe('cameraPose (the camera path on the master timeline)', () => {
  it('CP1 at the start of a keyed scene the camera is at its key pose', () => {
    expect(cameraPose(ORDER, { id: 'trust', progress: 0 })).toEqual(CAMERA_PATH.trust);
    expect(cameraPose(ORDER, { id: 'booking', progress: 0 })).toEqual(CAMERA_PATH.booking);
  });

  it('CP2 it eases to the next keyed scene across the segment, ending on its pose', () => {
    const end = cameraPose(ORDER, { id: 'trust', progress: 1 });
    expect(end.position[0]).toBeCloseTo(CAMERA_PATH.services!.position[0]);
    const half = cameraPose(ORDER, { id: 'trust', progress: 0.5 });
    const from = CAMERA_PATH.trust!.position[0];
    const to = CAMERA_PATH.services!.position[0];
    expect(half.position[0]).toBeCloseTo((from + to) / 2);
  });

  it('CP3 the hero exit tilts the camera up by about 3 degrees', () => {
    const hero = CAMERA_PATH.hero!;
    const trust = CAMERA_PATH.trust!;
    const angle = (pose: typeof hero) =>
      Math.atan2(pose.target[1] - pose.position[1], pose.position[2] - pose.target[2]);
    expect(((angle(trust) - angle(hero)) * 180) / Math.PI).toBeCloseTo(3, 0);
  });

  it('CP4 an unkeyed scene holds the last key pose before it; no place is neutral', () => {
    const workflow = cameraPose(ORDER, { id: 'workflow', progress: 0 });
    expect(workflow).toEqual(CAMERA_PATH.restoration);
    expect(cameraPose(ORDER, null)).toEqual(NEUTRAL_POSE);
    // A progress outside 0..1 clamps.
    expect(cameraPose(ORDER, { id: 'trust', progress: 5 })).toEqual(
      cameraPose(ORDER, { id: 'trust', progress: 1 }),
    );
  });
});

describe('lightDrift', () => {
  it('LD1 cool at the top, half warm at the end of the page, fully warm with --warm', () => {
    expect(lightDrift(0, 0).warmth).toBe(0);
    expect(lightDrift(1, 0).warmth).toBeCloseTo(0.45);
    expect(lightDrift(1, 1).warmth).toBe(1);
    expect(lightDrift(-3, 7).warmth).toBe(lightDrift(0, 1).warmth);
  });
});

describe('wobbleStep (clamped scroll velocity)', () => {
  it('WB1 eases toward the velocity and never passes -1..1, at any speed', () => {
    let w = 0;
    for (let i = 0; i < 200; i += 1) w = wobbleStep(w, 1e9, 1 / 60);
    expect(w).toBeLessThanOrEqual(1);
    expect(w).toBeGreaterThan(0.99);
    let half = 0;
    for (let i = 0; i < 200; i += 1) half = wobbleStep(half, WOBBLE_FULL_PX_S / 2, 1 / 60);
    expect(half).toBeCloseTo(0.5, 2);
    expect(wobbleStep(0.4, Number.NaN, 1 / 60)).toBeLessThan(0.4);
  });

  it('WB2 a stall (huge dt) moves no further than a tenth of a second', () => {
    expect(wobbleStep(0, WOBBLE_FULL_PX_S, 5)).toBeCloseTo(wobbleStep(0, WOBBLE_FULL_PX_S, 0.1));
    expect(wobbleStep(0.3, 0, -1)).toBe(0.3);
  });
});

describe('rectToCamera (viewport px to the camera plane)', () => {
  it('RC1 the viewport centre is on the axis; the top edge is half the frustum height up', () => {
    const view = { width: 1440, height: 900 };
    const centre = rectToCamera({ left: 720, top: 450, width: 0, height: 0 }, view, 30, 10);
    expect(centre.x).toBeCloseTo(0);
    expect(centre.y).toBeCloseTo(0);
    expect(centre.z).toBe(-10);
    const top = rectToCamera({ left: 720, top: 0, width: 0, height: 0 }, view, 30, 10);
    expect(top.y).toBeCloseTo(10 * Math.tan(Math.PI / 12));
    // Screen y grows down, camera y grows up; x keeps its direction.
    const corner = rectToCamera({ left: 1440, top: 900, width: 0, height: 0 }, view, 30, 10);
    expect(corner.x).toBeGreaterThan(0);
    expect(corner.y).toBeLessThan(0);
    expect(900 * centre.unitsPerPx).toBeCloseTo(2 * top.y);
  });
});

describe('underWarmLayer', () => {
  it('UW1 the colour under the 12 % warm layer composites back to the warm-soft stage', () => {
    const warmSoft = [251, 241, 230] as const;
    const warm = [232, 175, 118] as const;
    const under = underWarmLayer(warmSoft, warm, 0.12);
    for (let i = 0; i < 3; i += 1) {
      expect(under[i]! * 0.88 + warm[i]! * 0.12).toBeCloseTo(warmSoft[i]!);
    }
    // Dark theme: the stage is darker than the layer would allow at some channel; it clamps.
    const dark = underWarmLayer([29, 36, 51], warm, 0.12);
    expect(dark.every((c) => c >= 0 && c <= 255)).toBe(true);
    expect(underWarmLayer([10, 20, 30], warm, 0)).toEqual([10, 20, 30]);
  });
});
