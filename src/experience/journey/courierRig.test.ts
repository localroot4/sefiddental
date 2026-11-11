import { Box3, BoxGeometry, SphereGeometry, Vector3, type WebGLRenderer } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { SOLID, workflowBeats } from './beats';
import { archTooth, createCourierRig, mulberry32, sampleSurface } from './courierRig';
import { courierPose, NO_POSE, type Pose } from './pose';
import { restoreParts } from './restore';

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
    rig.update(frame(pose({ form: 'tooth', arch: 1, lift: 0 })));
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

  it("R5 D3: the level's restoration lies on the chewing surface in the top view only, as it plays", () => {
    const rig = createCourierRig({ mark: mark(), molar: tooth() }, { particles: 10 });
    const decal = rig.scene.getObjectByName('restoration')!;
    const inlay = rig.scene.getObjectByName('inlay')!;
    const tooth3 = pose({ form: 'tooth', dock: 'restoration', presence: 1 });
    rig.update({ ...frame(tooth3), view: 1, restore: restoreParts(1, 0.574) });
    expect(decal.visible).toBe(true);
    expect(inlay.visible).toBe(true);
    // The click: the inlay dips under its size as it seats.
    expect(inlay.scale.x).toBeCloseTo(0.97, 3);
    rig.update({ ...frame(tooth3), view: 1, restore: restoreParts(1, 0) });
    expect(inlay.visible).toBe(false);
    expect(inlay.position.y).toBeCloseTo(16, 5);
    // Plain shows no inlay; out of the top view, or as the mark, nothing.
    rig.update({ ...frame(tooth3), view: 1, restore: restoreParts(0, 1) });
    expect(decal.visible).toBe(true);
    expect(inlay.visible).toBe(false);
    rig.update({ ...frame(tooth3), view: 0, restore: restoreParts(0, 1) });
    expect(decal.visible).toBe(false);
    rig.update({ ...frame(pose({ form: 'mark' })), view: 1, restore: restoreParts(0, 1) });
    expect(decal.visible).toBe(false);
  });

  it("R6 an arch tooth is the molar's crown at a fraction of its triangles, its shape and normals kept", () => {
    const molar = new SphereGeometry(0.5, 64, 48);
    const full = molar.getIndex()!.count / 3;
    const crown = archTooth(molar, -0.25, 0.08);
    const kept = crown.getIndex()!.count / 3;
    expect(kept).toBeGreaterThan(50);
    expect(kept).toBeLessThan(full / 4);
    // Only the part above -0.25 (the clusters keep its cut within a cell), the same width.
    crown.computeBoundingBox();
    const box = crown.boundingBox!;
    expect(box.min.y).toBeGreaterThan(-0.25 - 0.08);
    expect(box.max.x).toBeGreaterThan(0.44);
    // Normals stay unit and outward on a sphere.
    const p = crown.getAttribute('position');
    const n = crown.getAttribute('normal');
    for (let i = 0; i < p.count; i += 7) {
      const out = new Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const normal = new Vector3(n.getX(i), n.getY(i), n.getZ(i));
      expect(normal.length()).toBeCloseTo(1, 4);
      expect(normal.dot(out)).toBeGreaterThan(0.8);
    }
    // The rig's arch draws it, not the full molar.
    const rig = createCourierRig({ mark: mark(), molar: tooth() }, { particles: 10 });
    let instanced = 0;
    rig.arch.scene.traverse((o) => {
      if ((o as { isInstancedMesh?: boolean }).isInstancedMesh) {
        instanced =
          (o as unknown as { geometry: { index: { count: number } } }).geometry.index.count / 3;
      }
    });
    expect(instanced).toBeLessThan(12);
  });
  it('R7 the arch is baked once into a texture and drawn as one quad: again only for a larger size, a theme or a restored context', () => {
    const rig = createCourierRig({ mark: mark(), molar: tooth() }, { particles: 10 });
    const canvas = new EventTarget(); // the renderer's canvas: only its restore event matters
    const render = vi.fn();
    const stub = (float: boolean) =>
      ({
        extensions: { has: (name: string) => float && name === 'EXT_color_buffer_float' },
        domElement: canvas,
        getPixelRatio: () => 1,
        getRenderTarget: () => null,
        setRenderTarget: vi.fn(),
        getClearAlpha: () => 0,
        setClearAlpha: vi.fn(),
        clear: vi.fn(),
        render,
      }) as unknown as WebGLRenderer;
    const shown = () => {
      const kinds: string[] = [];
      rig.arch.scene.traverseVisible((o) => {
        if ((o as { isInstancedMesh?: boolean }).isInstancedMesh) kinds.push('teeth');
        else if ((o as { isMesh?: boolean }).isMesh && o.parent === rig.arch.scene)
          kinds.push('quad');
      });
      return kinds;
    };
    const box = { width: 640, height: 427, archWidth: 400, dissolve: 0 };
    // No float colour buffer: the teeth draw every frame, as before.
    rig.updateArch(box, stub(false));
    expect(render).not.toHaveBeenCalled();
    expect(shown()).toEqual(['teeth']);
    const gl = stub(true);
    rig.updateArch(box, gl);
    // Two passes: the colour and the dissolve's threshold.
    expect(render).toHaveBeenCalledTimes(2);
    expect(shown()).toEqual(['quad']);
    rig.updateArch({ ...box, dissolve: 0.5, archWidth: 410 }, gl);
    expect(render).toHaveBeenCalledTimes(2);
    rig.updateArch({ ...box, archWidth: 520 }, gl);
    expect(render).toHaveBeenCalledTimes(4);
    rig.setTheme(true, '#0A8A80');
    rig.updateArch({ ...box, archWidth: 520 }, gl);
    expect(render).toHaveBeenCalledTimes(6);
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    rig.updateArch({ ...box, archWidth: 520 }, gl);
    expect(render).toHaveBeenCalledTimes(8);
    rig.dispose();
  });
});
