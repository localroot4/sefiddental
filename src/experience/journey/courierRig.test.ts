import { Box3, BoxGeometry, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { SOLID, workflowBeats } from './beats';
import { createCourierRig, mulberry32, sampleSurface } from './courierRig';
import { courierPose, NO_POSE, type Pose } from './pose';

// Stand-ins for molar.glb (crown 1.03 wide, roots to y -1.03) and mark.glb (1 wide).
const tooth = () => {
  const geometry = new BoxGeometry(1.03, 1.44, 0.95);
  geometry.translate(0, -0.31, 0);
  return geometry;
};
const mark = () => new BoxGeometry(1, 1.21, 0.17);
const pose = (over: Partial<Pose>): Pose => ({
  ...NO_POSE,
  hidden: false,
  scale: 200,
  opacity: 1,
  ...over,
});
const frame = (p: Pose) => ({
  pose: p,
  time: 1,
  level: 0,
  turn: 0,
  beats: SOLID,
  idle: 1,
  pixels: 200,
});

describe('courier rig', () => {
  it('R1 one form at a time: the mark or the tooth, the beats only on the tooth', () => {
    const rig = createCourierRig({ mark: mark(), molar: tooth() }, { particles: 300 });
    rig.update(frame(pose({ form: 'mark' })));
    const visible = () => {
      const names: string[] = [];
      rig.scene.traverseVisible((o) => {
        if ((o as { isMesh?: boolean }).isMesh || (o as { isPoints?: boolean }).isPoints)
          names.push(o.type);
      });
      return names;
    };
    // The mark and its shadow.
    expect(visible()).toEqual(['Mesh', 'Mesh']);
    rig.update({ ...frame(pose({ form: 'tooth' })), beats: workflowBeats(0.4) });
    // Shadow and wireframe: the solid is not built yet and the cloud has left at this beat.
    expect(visible()).toEqual(['Mesh', 'Mesh']);
    rig.update({ ...frame(pose({ form: 'tooth' })), beats: workflowBeats(0.2) });
    expect(visible()).toContain('Points');
  });

  it('R2 the arch frames its box in arch units and dissolves; dispose keeps the cached mark', () => {
    const markGeometry = mark();
    const molar = tooth();
    const rig = createCourierRig({ mark: markGeometry, molar }, { particles: 50 });
    rig.updateArch({ width: 640, height: 427, archWidth: 537.6, dissolve: 0.4 });
    expect(rig.arch.camera.right).toBeCloseTo(320 / 537.6, 6);
    expect(rig.arch.camera.top).toBeCloseTo(213.5 / 537.6, 6);
    const markFreed = vi.spyOn(markGeometry, 'dispose');
    const molarFreed = vi.spyOn(molar, 'dispose');
    rig.dispose();
    expect(markFreed).not.toHaveBeenCalled();
    expect(molarFreed).toHaveBeenCalled();
  });

  it('R3 the seated tooth pivots on its crown and turns it to the camera as the arch view does', () => {
    const rig = createCourierRig({ mark: mark(), molar: tooth() }, { particles: 10 });
    const tilt = () => rig.scene.children[1]!.children[0]!.rotation.x;
    rig.update(frame(pose({ form: 'tooth', arch: 0 })));
    const before = tilt();
    rig.update(frame(pose({ form: 'tooth', arch: 1 })));
    expect(tilt()).toBeGreaterThan(before);
    rig.update(frame(pose({ form: 'mark' })));
    expect(tilt()).toBe(0);
    expect(courierPose(0, [], { width: 1, height: 1, maxScroll: 0 }, 2)).toBe(NO_POSE);
  });

  it('R4 surface samples lie on the mesh and repeat for the same seed', () => {
    const geometry = tooth();
    const a = sampleSurface(geometry, 200, mulberry32(5));
    const b = sampleSurface(geometry, 200, mulberry32(5));
    expect(a).toEqual(b);
    const box = new Box3(new Vector3(-0.516, -1.04, -0.476), new Vector3(0.516, 0.42, 0.476));
    for (let i = 0; i < 200; i += 1) {
      expect(box.containsPoint(new Vector3().fromArray(a, i * 3))).toBe(true);
    }
  });
});
