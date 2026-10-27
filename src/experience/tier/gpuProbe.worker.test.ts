import { afterEach, describe, expect, it, vi } from 'vitest';

const RENDERER = 'ANGLE (Apple, Apple M1, OpenGL 4.1)';

/** Runs the worker script once against an OffscreenCanvas whose WebGL 2 context is `gl`. */
async function runWorker(gl: unknown) {
  const postMessage = vi.fn();
  vi.stubGlobal('postMessage', postMessage);
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      getContext() {
        return gl;
      }
    },
  );
  vi.resetModules();
  await import('./gpuProbe.worker');
  return postMessage;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gpuProbe.worker', () => {
  it('GW1 posts the renderer and releases the context', async () => {
    const loseContext = vi.fn();
    const posted = await runWorker({
      RENDERER: 0x1f01,
      getExtension: (name: string) => (name === 'WEBGL_lose_context' ? { loseContext } : null),
      getParameter: () => RENDERER,
    });
    expect(posted).toHaveBeenCalledWith({ renderer: RENDERER });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('GW2 posts null without a context, so the main thread probes', async () => {
    expect(await runWorker(null)).toHaveBeenCalledWith(null);
  });
});
