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

const mocks = vi.hoisted(() => ({
  engines: [] as FakeEngine[],
  placeScrollY: vi.fn(() => 1234),
  monitorFrames: vi.fn((_engine: unknown, _opts: { tier: number }) => () => {}),
  canvasImports: 0,
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
  monitorFrames: mocks.monitorFrames,
  prepareScrollEngine: () => {},
}));
// The factory runs on the first `import()` only: a count of 0 proves the chunk was never asked for.
vi.mock('./canvas/CanvasRoot', () => {
  mocks.canvasImports += 1;
  return { CanvasRoot: () => null };
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
  mocks.monitorFrames.mockClear();
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

  it('XR4 the frame monitor rides the ticker in auto mode only, while no canvas is mounted', async () => {
    const fixed = home('/?tier=2');
    await waitFor(() => expect(mocks.engines).toHaveLength(1));
    await flush();
    expect(mocks.monitorFrames).not.toHaveBeenCalled();
    fixed.unmount();

    home('/?tier=2&monitor=1');
    await waitFor(() => expect(mocks.monitorFrames).toHaveBeenCalledTimes(1));
    expect(mocks.monitorFrames.mock.calls[0]?.[1]).toMatchObject({ tier: 2 });
  });
});
