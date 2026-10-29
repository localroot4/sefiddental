// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ExperienceRoot } from './ExperienceRoot';
import { useTier } from './tier/TierProvider';

interface FakeEngine {
  layout: { latchedAtTier: number };
  restore: unknown;
  scrollTo: ReturnType<typeof vi.fn>;
  activeScene: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

type GpuOptions = { override: { loadBenchmarks: (file: string) => Promise<unknown> } };

const mocks = vi.hoisted(() => ({
  engines: [] as FakeEngine[],
  placeScrollY: vi.fn(() => 1234),
  /** The place the browser restored before the first engine; none (the top) unless set. */
  placeNow: vi.fn((): { id: string; progress: number } | null => null),
  monitorFrames: vi.fn((_opts: { tier: number }) => () => {}),
  canvasImports: 0,
  /** Renders of the canvas host: the factory count above sees only the file's first import. */
  canvasMounts: 0,
  /** detect-gpu: the options of the last call and the answer it waits for. */
  gpu: { options: null as GpuOptions | null, answer: (_: unknown) => {} },
}));

// The benchmark runs only in auto mode without a query tier (XR5); it answers when told to.
vi.mock('detect-gpu', () => ({
  getGPUTier: (options: GpuOptions) =>
    new Promise((resolve) => {
      mocks.gpu.options = options;
      mocks.gpu.answer = resolve;
    }),
}));

// The engine chunk (gsap, Lenis) needs a layout engine; the root only wires it.
vi.mock('./engine/scrollEngine', () => ({
  createScrollEngine: (opts: { layout: { latchedAtTier: number }; restore?: unknown }) => {
    const engine: FakeEngine = {
      layout: opts.layout,
      restore: opts.restore,
      scrollTo: vi.fn(),
      activeScene: vi.fn(() => ({ id: 'services', progress: 0.5 })),
      destroy: vi.fn(),
    };
    mocks.engines.push(engine);
    return {
      ...engine,
      lenis: null,
      master: null,
      initMs: 0,
      progress: () => 0,
      sceneProgress: () => 0,
      labels: () => [],
      velocity: () => 0,
      onTick: () => () => {},
      tickSubscribers: () => 0,
      covered: () => false,
      insidePinnedRange: () => false,
      reachedFirstPinnedScene: () => false,
    };
  },
  placeScrollY: mocks.placeScrollY,
  placeNow: mocks.placeNow,
  monitorFrames: mocks.monitorFrames,
  prepareScrollEngine: () => {},
}));
// The factory runs on the first `import()` only: a count of 0 proves the chunk was never asked for.
vi.mock('./canvas/CanvasRoot', () => {
  mocks.canvasImports += 1;
  return {
    CanvasRoot: () => {
      mocks.canvasMounts += 1;
      return null;
    },
  };
});

/** Controllable matchMedia: jsdom has none. */
function installMatchMedia(initial: Record<string, boolean>) {
  window.matchMedia = ((query: string) => ({
    matches: initial[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** A WebGL 2 context that reports a hardware renderer; detect-gpu never runs in these tests. */
function installWebgl2() {
  const fake = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
        : name === 'WEBGL_lose_context'
          ? { loseContext: () => {} }
          : null,
    getParameter: () => 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
    RENDERER: 0x1f01,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' ? fake : null) as never);
}

let observers: { callback: IntersectionObserverCallback; options?: IntersectionObserverInit }[];
let observed: Element[];
let disconnected: number;
function Probe() {
  const tier = useTier();
  return (
    <output data-testid="tier" onClick={() => tier.setPageOverride(0)}>
      {`${tier.tier}|${tier.layout.latchedAtTier}`}
    </output>
  );
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 20)));

function home(path: string) {
  window.history.replaceState(null, '', path);
  return render(
    <ExperienceRoot siteCap={null}>
      <div data-scene="hero" />
      <div data-scene="services" />
      <div data-scene="nope" />
      <Probe />
    </ExperienceRoot>,
  );
}

beforeEach(() => {
  installMatchMedia({ '(pointer: fine)': true, '(min-width: 1024px)': true });
  installWebgl2();
  observers = [];
  observed = [];
  disconnected = 0;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        observers.push({ callback, options });
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {
        disconnected += 1;
      }
    },
  );
  Object.defineProperty(navigator, 'sendBeacon', { value: vi.fn(() => true), configurable: true });
  // The engine is created three frames after the commit: frames are 0 ms timers here.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  window.scrollTo = vi.fn();
  mocks.engines.length = 0;
  mocks.placeScrollY.mockClear();
  mocks.placeNow.mockClear().mockReturnValue(null);
  mocks.monitorFrames.mockClear().mockImplementation(() => () => {});
  mocks.canvasMounts = 0;
  mocks.gpu.options = null;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ExperienceRoot (dom)', () => {
  it('XR1 D5: no canvas chunk without the debug flag or a WebGL scene; with the flag it loads', async () => {
    const view = home('/?tier=2');
    await flush();
    expect(view.getByTestId('tier').textContent).toBe('2|2');
    expect(mocks.canvasImports).toBe(0);
    view.unmount();

    home('/?debug=1&tier=2');
    await flush();
    expect(mocks.canvasImports).toBe(1);
  });

  it('XR2 keep-place: a relatch records the place, restores it from the new bounds, never on unmount', async () => {
    const view = home('/?tier=2');
    await waitFor(() => expect(mocks.engines).toHaveLength(1));
    const first = mocks.engines[0]!;
    expect(first.layout.latchedAtTier).toBe(2);
    expect(first.restore).toBeUndefined();

    // The probe's click asks for a tier-0 page override: a 'user' relatch, applied at once.
    await act(async () => view.getByTestId('tier').click());
    await waitFor(() => expect(mocks.engines).toHaveLength(2));
    expect(first.destroy).toHaveBeenCalledTimes(1);
    const second = mocks.engines[1]!;
    expect(second.layout.latchedAtTier).toBe(0);
    const root = document.querySelector('[data-experience-root]');
    expect(mocks.placeScrollY).toHaveBeenCalledWith(root, { id: 'services', progress: 0.5 });
    // Restored at once, before the new engine exists (three frames later), so nothing flickers,
    // and handed to the new engine, which applies it again after the refresh its pins queue.
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 1234, behavior: 'instant' });
    expect(second.restore).toEqual({ id: 'services', progress: 0.5 });

    view.unmount();
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(mocks.engines).toHaveLength(2);
    expect(mocks.placeScrollY).toHaveBeenCalledTimes(1);
  });

  it('XR8 a first engine keeps the place the browser restored (a reload at voices); a relatch does not read it again', async () => {
    mocks.placeNow.mockReturnValue({ id: 'voices', progress: 0 });
    const view = home('/?tier=2');
    await waitFor(() => expect(mocks.engines).toHaveLength(1));
    const root = document.querySelector('[data-experience-root]');
    expect(mocks.placeNow).toHaveBeenCalledWith(root);
    // The reader is there already: no scroll before the engine, which applies it after its pins.
    expect(mocks.engines[0]!.restore).toEqual({ id: 'voices', progress: 0 });
    expect(window.scrollTo).not.toHaveBeenCalled();

    await act(async () => view.getByTestId('tier').click());
    await waitFor(() => expect(mocks.engines).toHaveLength(2));
    expect(mocks.engines[1]!.restore).toEqual({ id: 'services', progress: 0.5 });
    expect(mocks.placeNow).toHaveBeenCalledTimes(1);
  });

  it('XR3 scene_view: once per registry scene when its top crosses the viewport middle', async () => {
    const view = home('/?tier=0');
    await flush();
    const [observer] = observers;
    expect(observer?.options).toEqual({ rootMargin: '0px 0px -50% 0px' });
    expect(observed.map((el) => el.getAttribute('data-scene'))).toEqual(['hero', 'services']);
    const hero = observed[0]!;
    const entry = { target: hero, isIntersecting: true } as IntersectionObserverEntry;
    const miss = { target: observed[1]!, isIntersecting: false } as IntersectionObserverEntry;
    observer?.callback([entry, miss], {} as IntersectionObserver);
    observer?.callback([entry], {} as IntersectionObserver);
    const beacon = navigator.sendBeacon as unknown as ReturnType<typeof vi.fn>;
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(await (beacon.mock.calls[0]?.[1] as Blob).text()).toContain(
      '"event":"scene_view","location":"hero"',
    );
    view.unmount();
    expect(disconnected).toBe(1);
  });

  it('XR4 the frame monitor runs in auto mode only, while no canvas is mounted', async () => {
    const fixed = home('/?tier=2');
    await waitFor(() => expect(mocks.engines).toHaveLength(1));
    await flush();
    expect(mocks.monitorFrames).not.toHaveBeenCalled();
    fixed.unmount();

    home('/?tier=2&monitor=1');
    await waitFor(() => expect(mocks.monitorFrames).toHaveBeenCalledTimes(1));
    expect(mocks.monitorFrames.mock.calls[0]?.[0]).toMatchObject({ tier: 2 });
  });

  it('XR5 U-PH15 coarse pointer: the engine waits for load + 1500 ms; the deadline aborts the benchmark fetch; a late tier 0 relatches at idle', async () => {
    installMatchMedia({ '(pointer: fine)': false, '(min-width: 1024px)': false });
    const fetches: (AbortSignal | null | undefined)[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        fetches.push(init?.signal);
        return new Promise(() => {});
      }),
    );
    const start = performance.now();
    const view = home('/');
    await waitFor(() => expect(mocks.gpu.options).not.toBeNull());
    await act(() => new Promise((resolve) => setTimeout(resolve, 1000)));
    expect(mocks.engines).toHaveLength(0);
    await waitFor(() => expect(mocks.engines).toHaveLength(1), { timeout: 2000 });
    expect(performance.now() - start).toBeGreaterThanOrEqual(1500);
    expect(view.getByTestId('tier').textContent).toBe('1|1');
    // The fetch detect-gpu would start now carries the gate's aborted signal.
    void mocks.gpu.options?.override.loadBenchmarks('m-apple.json');
    expect(fetches[0]?.aborted).toBe(true);

    // The probe answers late with a blocklisted GPU: the tier drops at once, the layout at idle.
    await act(async () => mocks.gpu.answer({ tier: 0, type: 'BLOCKLISTED' }));
    await waitFor(() => expect(view.getByTestId('tier').textContent).toBe('0|1'));
    expect(mocks.engines).toHaveLength(1);
    await waitFor(() => expect(mocks.engines).toHaveLength(2), { timeout: 2500 });
    expect(view.getByTestId('tier').textContent).toBe('0|0');
    expect(mocks.engines[0]?.destroy).toHaveBeenCalledTimes(1);
    // No pin came or went, so the page did not move (D25).
    expect(window.scrollTo).not.toHaveBeenCalled();
    expect(mocks.engines[1]?.restore).toBeUndefined();
  }, 10_000);

  it('XR7 a phone with the debug flag mounts no canvas: the DOM frame monitor runs and keeps running', async () => {
    installMatchMedia({ '(pointer: fine)': false, '(min-width: 1024px)': false });
    const stop = vi.fn();
    mocks.monitorFrames.mockImplementation(() => stop);
    home('/?tier=1&monitor=1&debug=1');
    await waitFor(() => expect(mocks.monitorFrames).toHaveBeenCalledTimes(1));
    expect(mocks.monitorFrames.mock.calls[0]?.[0]).toMatchObject({ tier: 1, phone: true });
    // Past the idle mount (a 200 ms timer in jsdom): a canvas would have mounted and stopped it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(mocks.canvasMounts).toBe(0);
    expect(stop).not.toHaveBeenCalled();
  });

  it('XR6 coarse pointer with an explicit tier: the probe answer opens the gate; a phone relatch never scrolls', async () => {
    installMatchMedia({ '(pointer: fine)': false, '(min-width: 1024px)': false });
    const view = home('/?tier=1');
    await waitFor(() => expect(mocks.engines).toHaveLength(1));
    expect(mocks.gpu.options).toBeNull(); // no benchmark under a query tier
    await act(async () => view.getByTestId('tier').click());
    await waitFor(() => expect(mocks.engines).toHaveLength(2));
    expect(mocks.placeScrollY).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});
