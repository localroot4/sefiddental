import { type Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { coverScale, createWipeRig } from './compareRig';

describe('slot rigs', () => {
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
