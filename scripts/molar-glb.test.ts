import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { MOLAR_GLB } from '../src/experience/scenes/webgl/assets';

import { buildMolarGlb, decodeDracoMolar, readGlb } from './molar-glb.mjs';

const root = path.resolve(__dirname, '..');

describe('molar-glb', () => {
  it('decodes every vertex and triangle of the Draco source', async () => {
    const source = readFileSync(path.join(root, 'design/brand/3d/molar.glb'));
    const { json } = readGlb(source);
    const decoded = await decodeDracoMolar(source, root);
    expect(decoded.positions.length / 3).toBe(json.accessors[1].count);
    expect(decoded.indices.length).toBe(json.accessors[0].count);
    for (let i = 0; i < 3; i += 1) {
      const axis = decoded.positions.filter((_: number, k: number) => k % 3 === i);
      expect(Math.min(...axis)).toBeCloseTo(json.accessors[1].min[i], 3);
      expect(Math.max(...axis)).toBeCloseTo(json.accessors[1].max[i], 3);
    }
  });

  it('writes a plain glTF binary of the size the scene manifest declares', async () => {
    const out = await buildMolarGlb(root);
    expect(out.length).toBe(MOLAR_GLB.bytes);
    const { json, bin } = readGlb(out);
    expect(json.extensionsRequired).toEqual(['KHR_mesh_quantization']);
    expect(json.extensionsUsed).not.toContain('KHR_draco_mesh_compression');
    const [position, normal, index] = json.accessors;
    expect(position).toMatchObject({ componentType: 5126, type: 'VEC3', count: 2948 });
    expect(normal).toMatchObject({ componentType: 5120, normalized: true, count: 2948 });
    expect(index).toMatchObject({ componentType: 5123, count: 17640 });
    expect(bin.length).toBe(json.buffers[0].byteLength);
    // Every index names a vertex.
    const view = json.bufferViews[index.bufferView];
    const indices = new Uint16Array(bin.buffer, bin.byteOffset + view.byteOffset, index.count);
    expect(Math.max(...indices)).toBeLessThan(2948);
  });

  it('refuses a file that is not a glTF binary', () => {
    expect(() => readGlb(Buffer.from('not a glb, sixteen bytes+'))).toThrow(/not a glTF/);
  });
});
