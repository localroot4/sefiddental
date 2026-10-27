/**
 * GPU probe after `load` (spec EXP 3.5.1, spec-utils 6.1): one WebGL 2 context gives `webgl2`
 * and the renderer string; detect-gpu runs only when the caller allows it, against the
 * self-hosted benchmarks (no third-party request); the context is released at the end. A
 * dedicated worker makes that context where the browser can (gpuProbe.worker.ts): on a software
 * GPU it takes 30 to 55 ms, the largest tier 1 long task after `load` in Lighthouse. The main
 * thread makes one only without the worker's answer, or for detect-gpu on a cache miss. A
 * context in the worker does not promise one on a main-thread `<canvas>` (Chromium's
 * --disable-webgl2 blocks only the latter), so such a result is `workerOnly` and the tier store
 * confirms it with `webgl2OnMainThread()` before a tier that mounts the canvas.
 */
import {
  DETECT_GPU_TIERS,
  GPU_BENCHMARKS_URL,
  GPU_CACHE_KEY,
  type GpuResult,
} from '@/lib/qualityTier';

import { readRenderer } from './glRenderer';

export interface ProbeResult {
  webgl2: boolean;
  renderer: string | null;
  /** null when the benchmark did not run or failed (qualityTier reads that as tier 1). */
  gpu: GpuResult | null;
  /** Only the worker's OffscreenCanvas had a context: WebGL 2 is not confirmed on the main thread. */
  workerOnly?: boolean;
}

/** A worker that has not answered by then (a stalled start) is ended; the main thread probes. */
export const WORKER_TIMEOUT_MS = 1500;

const NO_WEBGL2: ProbeResult = { webgl2: false, renderer: null, gpu: null };

type WorkerFacts = { renderer: string | null } | null;

/** The renderer from gpuProbe.worker.ts; null when the worker had no context, failed or timed out. */
function probeInWorker(): Promise<WorkerFacts> {
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./gpuProbe.worker.ts', import.meta.url));
    } catch {
      resolve(null);
      return;
    }
    let settled = false;
    const done = (facts: WorkerFacts): void => {
      if (settled) return; // the answer, an error event and the timeout can race: end it once
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      resolve(facts);
    };
    const timer = setTimeout(() => done(null), WORKER_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<WorkerFacts>) => done(event.data);
    worker.onerror = () => done(null);
  });
}

/** A main-thread WebGL 2 context, or null (a throw is logged). */
function createContext(): WebGL2RenderingContext | null {
  try {
    return document
      .createElement('canvas')
      .getContext('webgl2', { powerPreference: 'high-performance' });
  } catch (error) {
    console.warn('[experience] WebGL 2 probe failed; tier 0.', error);
    return null;
  }
}

const release = (gl: WebGL2RenderingContext | null): void =>
  gl?.getExtension('WEBGL_lose_context')?.loseContext();

/** Whether a main-thread `<canvas>` gets a WebGL 2 context (made and released at once). */
export function webgl2OnMainThread(): boolean {
  const gl = createContext();
  release(gl);
  return gl !== null;
}

export async function probeGpu(opts: {
  /** Whether detect-gpu may run for this renderer (no software GPU, data saver, override...). */
  benchmark: (renderer: string | null) => boolean;
  /** localStorage, for the `sefid-gpu` cache. */
  storage: { get(key: string): string | null; set(key: string, value: string): void };
}): Promise<ProbeResult> {
  const fromWorker = await probeInWorker();
  let gl = fromWorker === null ? createContext() : null;
  if (fromWorker === null && gl === null) return NO_WEBGL2;

  let renderer = fromWorker?.renderer ?? null;
  const found = (gpu: GpuResult | null): ProbeResult => ({
    webgl2: true,
    renderer,
    gpu,
    workerOnly: gl === null,
  });
  try {
    if (gl !== null) renderer = readRenderer(gl);
    if (!opts.benchmark(renderer)) return found(null);
    // Loaded only here: the cache parser (zod) and detect-gpu stay out of the initial JS.
    const { parseGpuCache, serializeGpuCache } = await import('./gpuCache');
    const cached =
      renderer === null ? null : parseGpuCache(opts.storage.get(GPU_CACHE_KEY), renderer);
    if (cached !== null) return found(cached.gpu);

    // detect-gpu reads pixels from the context it gets (Apple GPUs): a main-thread one, which
    // confirms WebGL 2 there too.
    gl ??= createContext();
    if (gl === null) return NO_WEBGL2;
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
    return found(gpu);
  } catch (error) {
    // Benchmark data unreachable or a driver error: keep WebGL 2 without a benchmark (tier 1).
    console.warn('[experience] GPU benchmark failed; using the WebGL 2 result only.', error);
    return found(null);
  } finally {
    release(gl);
  }
}
