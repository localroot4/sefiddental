import { BoxGeometry, Box3, Vector3, type Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { coverScale, createWipeRig } from './compareRig';
import { createMolarRig } from './restorationRig';
import { createWorkflowRig, mulberry32, sampleSurface } from './workflowRig';

// A stand-in for molar.glb with its bounds (crown 1.03 wide, roots to y -1.03).
const tooth = () => {
  const geometry = new BoxGeometry(1.03, 1.44, 0.95);
  geometry.translate(0, -0.31, 0);
  return geometry;
};

describe('slot rigs', () => {
  it('scene 4: dispose frees the molar, its enamel and the studio, once each', () => {
    const geometry = tooth();
    const rig = createMolarRig(geometry);
    rig.update({ level: 1.5, progress: 0.5, time: 1, aspect: 0.83 });
    const freed = vi.spyOn(geometry, 'dispose');
    const count = rig.dispose();
    expect(freed).toHaveBeenCalledTimes(1);
    // The molar and the shadow quad; the enamel and the shadow's material.
    expect(count).toEqual({ geometries: 2, materials: 2, textures: 0 });
    expect(rig.camera.aspect).toBeCloseTo(0.83);
  });

  it('scene 5: the cloud samples the surface with the tier count, and dispose frees it', () => {
    const geometry = tooth();
    const rig = createWorkflowRig(geometry, { particles: 600, rtl: true });
    rig.update({ p: 0.2, time: 0, w: 1216, h: 828, card: 448, pixelRatio: 1 });
    const count = rig.dispose();
    // Molar (shared by the solid and the wireframe), cloud, shadow; enamel, wire, points, shadow.
    expect(count).toEqual({ geometries: 3, materials: 4, textures: 0 });
  });

  it('scene 5: surface samples lie on the mesh and repeat for the same seed', () => {
    const geometry = tooth();
    const a = sampleSurface(geometry, 200, mulberry32(5));
    const b = sampleSurface(geometry, 200, mulberry32(5));
    expect(a.positions).toEqual(b.positions);
    const box = new Box3(new Vector3(-0.516, -1.04, -0.476), new Vector3(0.516, 0.42, 0.476));
    for (let i = 0; i < 200; i += 1) {
      const p = new Vector3().fromArray(a.positions, i * 3);
      expect(box.containsPoint(p)).toBe(true);
      expect(new Vector3().fromArray(a.normals, i * 3).length()).toBeCloseTo(1, 5);
    }
  });

  it('scene 6: dispose frees both photo textures and bitmaps, and new photos free the old ones', () => {
    const rig = createWipeRig();
    const closed = vi.fn();
    const image = (w: number, h: number) =>
      ({ width: w, height: h, close: closed }) as unknown as ImageBitmap;
    rig.setImages(image(1080, 1080), image(1080, 1080));
    const first = (
      rig.scene.children[0] as unknown as {
        material: { uniforms: Record<string, { value: Texture }> };
      }
    ).material.uniforms;
    const old = [first.tBefore!.value, first.tAfter!.value].map((t) => vi.spyOn(t, 'dispose'));
    rig.setImages(image(640, 480), image(640, 480));
    for (const spy of old) expect(spy).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(2);
    rig.update({ pos: 30, rtl: true, dt: 1 / 60, time: 1, w: 448, h: 448, radius: 24, opacity: 1 });
    expect(rig.dispose()).toEqual({ geometries: 1, materials: 1, textures: 2 });
    expect(closed).toHaveBeenCalledTimes(4);
  });

  it('scene 6: crops a photo to cover the box', () => {
    expect(coverScale(1, 1)).toEqual([1, 1]);
    expect(coverScale(4 / 3, 1)).toEqual([0.75, 1]);
    expect(coverScale(0.5, 1)).toEqual([1, 0.5]);
    expect(coverScale(0, 1)).toEqual([1, 1]);
  });
});
