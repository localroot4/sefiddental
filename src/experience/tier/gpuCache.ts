/**
 * The cached detect-gpu result in `localStorage['sefid-gpu']` (freeze 3.7). Storage is a
 * boundary: anything that does not match the schema, the pinned detect-gpu version or the
 * current renderer is ignored, so a stale or edited value never decides the tier.
 */
import * as z from 'zod/mini';

import type { GpuResult } from '@/lib/qualityTier';

/** detect-gpu version whose benchmark data produced the cached tier (freeze section 9). */
export const DETECT_GPU_VERSION = '5.0.70';

const gpuCacheSchema = z.object({
  v: z.literal(DETECT_GPU_VERSION),
  renderer: z.string(),
  tier: z.number(),
  type: z.enum(['SSR', 'WEBGL_UNSUPPORTED', 'BLOCKLISTED', 'FALLBACK', 'BENCHMARK']),
  fps: z.optional(z.nullable(z.number())),
});

export interface GpuCacheEntry {
  renderer: string;
  gpu: GpuResult;
}

/**
 * Parses the stored JSON. With `renderer` null the entry is accepted for the synchronous tier at
 * hydration (the renderer is not known before the probe); after the probe the renderer must match.
 */
export function parseGpuCache(raw: string | null, renderer: string | null): GpuCacheEntry | null {
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = gpuCacheSchema.safeParse(json);
  if (!parsed.success) return null;
  const entry = parsed.data;
  if (renderer !== null && entry.renderer !== renderer) return null;
  const gpu: GpuResult = { tier: entry.tier, type: entry.type };
  if (typeof entry.fps === 'number') gpu.fps = entry.fps;
  return { renderer: entry.renderer, gpu };
}

export function serializeGpuCache(renderer: string, gpu: GpuResult): string {
  return JSON.stringify({
    v: DETECT_GPU_VERSION,
    renderer,
    tier: gpu.tier,
    type: gpu.type,
    fps: gpu.fps ?? null,
  });
}
