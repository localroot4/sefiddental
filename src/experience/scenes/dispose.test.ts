import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
  SphereGeometry,
  Texture,
} from 'three';
import { describe, expect, it, vi } from 'vitest';

import { disposeObject3D } from './dispose';

describe('disposeObject3D', () => {
  it('V8 disposes geometry, materials (array too) and every texture map once', () => {
    const map = new Texture();
    const normalMap = new Texture();
    const uniformTexture = new Texture();
    const sharedGeometry = new BoxGeometry();
    const standard = new MeshStandardMaterial({ map, normalMap });
    const basic = new MeshBasicMaterial({ map }); // shares `map`
    const shader = new ShaderMaterial({ uniforms: { uTex: { value: uniformTexture } } });

    const root = new Group();
    root.add(new Mesh(sharedGeometry, standard));
    root.add(new Mesh(sharedGeometry, [basic, shader])); // shared geometry, material array
    const child = new Group();
    child.add(new Mesh(new SphereGeometry(), standard)); // shared material
    root.add(child);

    const spies = [map, normalMap, uniformTexture, sharedGeometry, standard, basic, shader].map(
      (item) => vi.spyOn(item, 'dispose'),
    );

    const count = disposeObject3D(root);

    expect(count).toEqual({ geometries: 2, materials: 3, textures: 3 });
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('V8 an empty group disposes nothing', () => {
    expect(disposeObject3D(new Group())).toEqual({ geometries: 0, materials: 0, textures: 0 });
  });
});
