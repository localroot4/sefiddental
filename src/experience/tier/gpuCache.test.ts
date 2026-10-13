import { describe, expect, it } from 'vitest';

import { parseGpuCache, serializeGpuCache } from './gpuCache';

const RENDERER = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';

describe('gpu cache', () => {
  it('GC1 round-trips a benchmark result', () => {
    const raw = serializeGpuCache(RENDERER, { tier: 3, type: 'BENCHMARK', fps: 240 });
    expect(parseGpuCache(raw, RENDERER)).toEqual({
      renderer: RENDERER,
      gpu: { tier: 3, type: 'BENCHMARK', fps: 240 },
    });
  });

  it('GC2 accepts any renderer before the probe, only the same one after it', () => {
    const raw = serializeGpuCache(RENDERER, { tier: 1, type: 'FALLBACK' });
    expect(parseGpuCache(raw, null)?.gpu).toEqual({ tier: 1, type: 'FALLBACK' });
    expect(parseGpuCache(raw, 'Apple GPU')).toBeNull();
  });

  it('GC3 ignores another detect-gpu version, corrupt JSON and wrong shapes', () => {
    const other = JSON.stringify({ v: '5.0.69', renderer: RENDERER, tier: 3, type: 'BENCHMARK' });
    expect(parseGpuCache(other, null)).toBeNull();
    expect(parseGpuCache('{not json', null)).toBeNull();
    expect(parseGpuCache('null', null)).toBeNull();
    expect(
      parseGpuCache(
        JSON.stringify({ v: '5.0.70', renderer: RENDERER, tier: '3', type: 'BENCHMARK' }),
        null,
      ),
    ).toBeNull();
    expect(
      parseGpuCache(
        JSON.stringify({ v: '5.0.70', renderer: RENDERER, tier: 3, type: 'FAST' }),
        null,
      ),
    ).toBeNull();
    expect(parseGpuCache(null, null)).toBeNull();
  });
});
