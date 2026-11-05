import type { BufferGeometry } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { createGeometryCache } from './brandGeometry';

function fakeGeometry(): BufferGeometry & { dispose: ReturnType<typeof vi.fn> } {
  return { dispose: vi.fn() } as unknown as BufferGeometry & { dispose: ReturnType<typeof vi.fn> };
}

describe('createGeometryCache (disposal far out of view)', () => {
  it('GC1 one load per file while referenced; disposed once at the last release', async () => {
    const geometry = fakeGeometry();
    const load = vi.fn(() => Promise.resolve(geometry));
    const cache = createGeometryCache(load);
    const [a, b] = await Promise.all([cache.acquire('/m.glb'), cache.acquire('/m.glb')]);
    expect(a).toBe(b);
    expect(load).toHaveBeenCalledTimes(1);
    cache.release('/m.glb');
    expect(geometry.dispose).not.toHaveBeenCalled();
    cache.release('/m.glb');
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
    expect(cache.size()).toBe(0);
    cache.release('/m.glb');
    expect(geometry.dispose).toHaveBeenCalledTimes(1);
  });

  it('GC2 a release before the file arrives disposes it on arrival; a new acquire reloads', async () => {
    const first = fakeGeometry();
    const second = fakeGeometry();
    let resolve: (g: BufferGeometry) => void = () => {};
    const load = vi
      .fn()
      .mockImplementationOnce(() => new Promise<BufferGeometry>((r) => (resolve = r)))
      .mockImplementationOnce(() => Promise.resolve(second));
    const cache = createGeometryCache(load);
    const pending = cache.acquire('/m.glb');
    cache.release('/m.glb');
    resolve(first);
    await pending;
    expect(first.dispose).toHaveBeenCalledTimes(1);
    await expect(cache.acquire('/m.glb')).resolves.toBe(second);
    expect(second.dispose).not.toHaveBeenCalled();
  });

  it('GC3 a failed load is forgotten, so the next acquire retries', async () => {
    const geometry = fakeGeometry();
    const load = vi.fn().mockRejectedValueOnce(new Error('404')).mockResolvedValueOnce(geometry);
    const cache = createGeometryCache(load);
    await expect(cache.acquire('/m.glb')).rejects.toThrow('404');
    expect(cache.size()).toBe(0);
    await expect(cache.acquire('/m.glb')).resolves.toBe(geometry);
  });
});
