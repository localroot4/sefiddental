/**
 * GPU probe after `load` (spec EXP 3.5.1, spec-utils 6.1): one WebGL 2 context gives `webgl2`
 * and the renderer string; detect-gpu runs only when the caller allows it, against the
 * self-hosted benchmarks (no third-party request); the context is released at the end.
 */
import {
  DETECT_GPU_TIERS,
  GPU_BENCHMARKS_URL,
  GPU_CACHE_KEY,
  type GpuResult,
} from '@/lib/qualityTier';

export interface ProbeResult {
  webgl2: boolean;
  renderer: string | null;
  /** null when the benchmark did not run or failed (qualityTier reads that as tier 1). */
  gpu: GpuResult | null;
}

function readRenderer(gl: WebGL2RenderingContext): string | null {
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const value: unknown = info
    ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function probeGpu(opts: {
  /** Whether detect-gpu may run for this renderer (no software GPU, data saver, override...). */
  benchmark: (renderer: string | null) => boolean;
  /** localStorage, for the `sefid-gpu` cache. */
  storage: { get(key: string): string | null; set(key: string, value: string): void };
}): Promise<ProbeResult> {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = document.createElement('canvas').getContext('webgl2', {
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.warn('[experience] WebGL 2 probe failed; tier 0.', error);
    gl = null;
  }
  if (gl === null) return { webgl2: false, renderer: null, gpu: null };

  let renderer: string | null = null;
  try {
    renderer = readRenderer(gl);
    if (!opts.benchmark(renderer)) return { webgl2: true, renderer, gpu: null };
    // Loaded only here: the cache parser (zod) and detect-gpu stay out of the initial JS.
    const { parseGpuCache, serializeGpuCache } = await import('./gpuCache');
    const cached =
      renderer === null ? null : parseGpuCache(opts.storage.get(GPU_CACHE_KEY), renderer);
    if (cached !== null) return { webgl2: true, renderer, gpu: cached.gpu };

    const { getGPUTier } = await import('detect-gpu');
    const result = await getGPUTier({
      glContext: gl,
      benchmarksURL: GPU_BENCHMARKS_URL,
      desktopTiers: DETECT_GPU_TIERS.desktop,
      mobileTiers: DETECT_GPU_TIERS.mobile,
    });
    const gpu: GpuResult = { tier: result.tier, type: result.type };
    if (typeof result.fps === 'number') gpu.fps = result.fps;
    if (typeof result.isMobile === 'boolean') gpu.isMobile = result.isMobile;
    if (typeof result.gpu === 'string') gpu.gpu = result.gpu;
    if (renderer !== null) opts.storage.set(GPU_CACHE_KEY, serializeGpuCache(renderer, gpu));
    return { webgl2: true, renderer, gpu };
  } catch (error) {
    // Benchmark data unreachable or a driver error: keep WebGL 2 without a benchmark (tier 1).
    console.warn('[experience] GPU benchmark failed; using the WebGL 2 result only.', error);
    return { webgl2: true, renderer, gpu: null };
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
