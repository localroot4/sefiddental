import { afterEach, describe, expect, it, vi } from 'vitest';

import { probeGpu, webgl2OnMainThread, WORKER_TIMEOUT_MS } from './gpuProbe';
import { serializeGpuCache } from './gpuCache';

const getGPUTier = vi.hoisted(() => vi.fn());
vi.mock('detect-gpu', () => ({ getGPUTier }));

const RENDERER = 'ANGLE (Apple, Apple M1, OpenGL 4.1)';
const SOFTWARE = 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)';

/**
 * A Worker whose script answers `reply`, fails to load ('error') or never answers ('silent');
 * `thenError` fires an error event after the answer too.
 */
function installWorker(
  reply: { renderer: string | null } | null | 'error' | 'silent',
  thenError = false,
) {
  const terminate = vi.fn();
  vi.stubGlobal('OffscreenCanvas', class {});
  vi.stubGlobal(
    'Worker',
    class {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: (() => void) | null = null;
      terminate = terminate;
      constructor() {
        if (reply === 'silent') return;
        setTimeout(() => {
          if (reply === 'error') this.onerror?.();
          else this.onmessage?.({ data: reply });
          if (thenError) this.onerror?.();
        });
      }
    },
  );
  return terminate;
}

/** The main-thread canvas: a WebGL 2 context reporting `renderer`, or none. */
function installCanvas(renderer: string | null) {
  const loseContext = vi.fn();
  const gl = {
    RENDERER: 0x1f01,
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
        : name === 'WEBGL_lose_context'
          ? { loseContext }
          : null,
    getParameter: () => renderer,
  };
  const createElement = vi.fn(() => ({ getContext: () => (renderer === null ? null : gl) }));
  vi.stubGlobal('document', { createElement });
  return { createElement, loseContext, gl };
}

const storage = (entries: Record<string, string> = {}) => ({
  get: (key: string) => entries[key] ?? null,
  set: vi.fn(),
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  getGPUTier.mockReset();
});

describe('probeGpu', () => {
  it('GP1 takes the renderer from the worker: no context on the main thread, so workerOnly', async () => {
    const terminate = installWorker({ renderer: SOFTWARE });
    const canvas = installCanvas(RENDERER);
    const result = await probeGpu({ benchmark: () => false, storage: storage() });
    expect(result).toEqual({
      webgl2: true,
      renderer: SOFTWARE,
      gpu: null,
      workerOnly: true,
      gpuNull: 'skipped',
    });
    expect(canvas.createElement).not.toHaveBeenCalled();
    expect(terminate).toHaveBeenCalledTimes(1);
  });

  it('GP2 a cached benchmark for the worker renderer needs no main-thread context either', async () => {
    installWorker({ renderer: RENDERER });
    const canvas = installCanvas(RENDERER);
    const cache = serializeGpuCache(RENDERER, { tier: 3, type: 'BENCHMARK', fps: 120 });
    const result = await probeGpu({
      benchmark: () => true,
      storage: storage({ 'sefid-gpu': cache }),
    });
    expect(result).toEqual({
      webgl2: true,
      renderer: RENDERER,
      gpu: { tier: 3, type: 'BENCHMARK', fps: 120 },
      workerOnly: true,
    });
    expect(canvas.createElement).not.toHaveBeenCalled();
  });

  it.each([
    ['answers null (no context in the worker)', null],
    ['fails to load', 'error'],
  ] as const)('GP3 a worker that %s leaves the probe to the main thread', async (_, reply) => {
    installWorker(reply);
    const canvas = installCanvas(RENDERER);
    const result = await probeGpu({ benchmark: () => false, storage: storage() });
    expect(result).toEqual({
      webgl2: true,
      renderer: RENDERER,
      gpu: null,
      workerOnly: false,
      gpuNull: 'skipped',
    });
    expect(canvas.createElement).toHaveBeenCalledWith('canvas');
    expect(canvas.loseContext).toHaveBeenCalledTimes(1);
  });

  it('GP4 without workers the main thread probes, and no context there means no WebGL 2', async () => {
    installCanvas(null);
    const result = await probeGpu({ benchmark: () => true, storage: storage() });
    expect(result).toEqual({ webgl2: false, renderer: null, gpu: null });
  });

  it('GP5 a worker silent for WORKER_TIMEOUT_MS is ended and the main thread probes', async () => {
    vi.useFakeTimers();
    const terminate = installWorker('silent');
    const canvas = installCanvas(RENDERER);
    let result: unknown = null;
    void probeGpu({ benchmark: () => false, storage: storage() }).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS - 1);
    expect(result).toBeNull();
    expect(terminate).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(canvas.createElement).toHaveBeenCalledWith('canvas');
    expect(result).toEqual({
      webgl2: true,
      renderer: RENDERER,
      gpu: null,
      workerOnly: false,
      gpuNull: 'skipped',
    });
  });

  it('GP6 a benchmark after a worker answer runs on a main-thread context, which confirms WebGL 2', async () => {
    installWorker({ renderer: RENDERER });
    const canvas = installCanvas(RENDERER);
    getGPUTier.mockResolvedValue({ tier: 2, type: 'BENCHMARK', fps: 90 });
    const result = await probeGpu({ benchmark: () => true, storage: storage() });
    expect(getGPUTier).toHaveBeenCalledWith(expect.objectContaining({ glContext: canvas.gl }));
    expect(result).toEqual({
      webgl2: true,
      renderer: RENDERER,
      gpu: { tier: 2, type: 'BENCHMARK', fps: 90 },
      workerOnly: false,
    });
    expect(canvas.loseContext).toHaveBeenCalledTimes(1);
  });

  it('GP7 a benchmark that finds no main-thread context reports no WebGL 2 (D-Q3)', async () => {
    installWorker({ renderer: RENDERER });
    installCanvas(null);
    const result = await probeGpu({ benchmark: () => true, storage: storage() });
    expect(result).toEqual({ webgl2: false, renderer: null, gpu: null });
    expect(getGPUTier).not.toHaveBeenCalled();
  });

  it('GP9 an error event after the answer changes nothing: the worker is ended once', async () => {
    const terminate = installWorker({ renderer: SOFTWARE }, true);
    const canvas = installCanvas(RENDERER);
    const result = await probeGpu({ benchmark: () => false, storage: storage() });
    expect(result).toMatchObject({ renderer: SOFTWARE, gpu: null, gpuNull: 'skipped' });
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(canvas.createElement).not.toHaveBeenCalled();
  });

  it('GP10 a benchmark that throws keeps WebGL 2 with gpu null, reason failed, and the error name', async () => {
    installWorker({ renderer: RENDERER });
    installCanvas(RENDERER);
    getGPUTier.mockRejectedValue(new TypeError('driver'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await probeGpu({ benchmark: () => true, storage: storage() });
    expect(result).toEqual({
      webgl2: true,
      renderer: RENDERER,
      gpu: null,
      workerOnly: false,
      gpuNull: 'failed',
      gpuError: 'TypeError',
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('GP11 the gate signal reaches the benchmark fetch; a result after the abort is not cached', async () => {
    installWorker({ renderer: RENDERER });
    installCanvas(RENDERER);
    const fetches: { url: string; signal: AbortSignal | undefined }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        fetches.push({ url, signal: init?.signal ?? undefined });
        return Promise.resolve({ json: () => Promise.resolve(['5.0.70', ['a', 'b', 'c', 0, []]]) });
      }),
    );
    const gate = new AbortController();
    getGPUTier.mockImplementation(
      async (o: { override: { loadBenchmarks: (f: string) => Promise<unknown[]> } }) => {
        // detect-gpu's loader gets the data without its version line.
        expect(await o.override.loadBenchmarks('m-adreno.json')).toEqual([['a', 'b', 'c', 0, []]]);
        gate.abort();
        return { tier: 1, type: 'FALLBACK' };
      },
    );
    const store = storage();
    const result = await probeGpu({ benchmark: () => true, storage: store, signal: gate.signal });
    expect(fetches).toEqual([{ url: '/detect-gpu/benchmarks/m-adreno.json', signal: gate.signal }]);
    expect(result.gpu).toEqual({ tier: 1, type: 'FALLBACK' });
    expect(store.set).not.toHaveBeenCalled();
  });
});

describe('webgl2OnMainThread', () => {
  it('GP8 makes and releases one main-thread context; none or a throw is false', () => {
    const canvas = installCanvas(RENDERER);
    expect(webgl2OnMainThread()).toBe(true);
    expect(canvas.loseContext).toHaveBeenCalledTimes(1);
    installCanvas(null);
    expect(webgl2OnMainThread()).toBe(false);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => {
          throw new Error('blocked');
        },
      }),
    });
    expect(webgl2OnMainThread()).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
