import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { MonitorWindow } from '../tier/frameMonitor';
import type { LayoutLatch } from '../tier/latch';

/**
 * Turns the trust scene into one that adds a scrub to the master (no shipped scene does on a
 * phone): at `setup`, or later through `later` (a lazy chunk).
 */
const scrub = vi.hoisted(() => ({
  on: false,
  later: null as null | (() => void),
  /** The test's fresh ScrollTrigger (the mock factory outlives a module reset): trust's pin scrubs. */
  pin: null as null | { create(vars: object): unknown },
}));

vi.mock('../scenes/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scenes/dom')>();
  return {
    DOM_SCENES: {
      ...actual.DOM_SCENES,
      trust: {
        pin: ({ el }: { el: HTMLElement }) => {
          scrub.pin?.create({ trigger: el, end: '+=500', scrub: true });
        },
        setup: ({ master, label }: { master: gsap.core.Timeline; label: string }) => {
          const add = () => {
            master.to({ v: 0 }, { v: 1 }, label);
          };
          if (scrub.on) add();
          else scrub.later = add;
        },
      },
    },
  };
});

/** jsdom has no matchMedia: `all` matches, the width, orientation and pointer follow `media`. */
const media = { wide: false, fine: false };
const mediaListeners = new Set<() => void>();
function installMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === '(min-width: 1024px)') return media.wide;
      if (query === '(orientation: portrait)') return !media.wide;
      if (query === '(pointer: fine)') return media.fine;
      return query === 'all';
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
    addListener: (listener: () => void) => mediaListeners.add(listener),
    removeListener: (listener: () => void) => mediaListeners.delete(listener),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
/** A tablet turning to landscape (wide) or back to portrait. */
const rotate = (wide: boolean): void => {
  media.wide = wide;
  for (const listener of [...mediaListeners]) listener();
};

/** The engine's ResizeObserver callback (a height change of the root). */
let resized: (() => void) | null = null;

const PHONE: LayoutLatch = { pinnedScenes: false, lenis: false, latchedAtTier: 1 };
const TABLET: LayoutLatch = { pinnedScenes: true, lenis: false, latchedAtTier: 1 };

/** Lets the engine's deferred scene setups (one task each under 1024 px) run. */
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
/** Both fixture scenes set up under 1024 px: one task each, after the creation task. */
const setupsDone = async () => {
  await nextTask();
  await nextTask();
};

const SCENES_HTML =
  '<section data-scene="hero"><div data-hero-photo></div></section><section data-scene="trust"></section>';

async function engineFor(
  layout: LayoutLatch,
  settings = {} as TierSettings,
  prepare = true,
  html = SCENES_HTML,
) {
  // Fresh modules per test: ScrollTrigger's registration is per page.
  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  const register = vi.spyOn(gsap, 'registerPlugin');
  // ScrollTrigger's own matchMedia (no scope), made when it registers.
  const unscoped: gsap.MatchMedia[] = [];
  const matchMedia = gsap.matchMedia.bind(gsap);
  vi.spyOn(gsap, 'matchMedia').mockImplementation(((scope?: Element) => {
    const mm = matchMedia(scope);
    if (scope === undefined) unscoped.push(mm);
    return mm;
  }) as typeof gsap.matchMedia);
  const { createScrollEngine, prepareScrollEngine } = await import('./scrollEngine');
  const { SCENES } = await import('../scenes/registry');
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.append(root);
  if (prepare) prepareScrollEngine(layout);
  const engine = createScrollEngine({ root, layout, settings, scenes: SCENES });
  return { engine, register, ScrollTrigger, unscoped, root, gsap };
}

beforeEach(() => {
  vi.resetModules();
  media.wide = false;
  media.fine = false;
  mediaListeners.clear();
  installMatchMedia();
  resized = null;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  scrub.on = false;
  scrub.later = null;
  scrub.pin = null;
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scroll engine: registration and the master (dom)', () => {
  it('SE1 a phone layout registers ScrollTrigger the frame before; without a child the master stays paused', async () => {
    const { engine, register, ScrollTrigger } = await engineFor(PHONE);
    // The phone scroll set scrubs (D21): the registration rides the prepare frame.
    expect(register).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(engine.master?.scrollTrigger).toBeUndefined();
    expect(engine.labels()).toEqual(['hero', 'trust']);
    expect(engine.progress()).toBe(0);
    engine.destroy();
  });

  it('SE2 a scene that adds a scrub on a phone registers ScrollTrigger and gives the master its trigger', async () => {
    scrub.on = true;
    const { engine, register, ScrollTrigger } = await engineFor(PHONE);
    // Under 1024 px every scene (trust too) sets up in a task of its own.
    expect(engine.master?.scrollTrigger).toBeUndefined();
    await setupsDone();
    expect(register).toHaveBeenCalledTimes(1);
    expect(engine.master?.scrollTrigger).toBeDefined();
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    engine.destroy();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('SE3 a child a lazy chunk adds after setup on a phone gives the master its trigger on the next refresh', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    const { engine, register, ScrollTrigger } = await engineFor(PHONE);
    await setupsDone();
    scrub.later?.();
    expect(engine.master?.scrollTrigger).toBeUndefined();
    // The observer's first callback reports the initial size; the second is a height change,
    // refreshed on the next frame.
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(register).toHaveBeenCalledTimes(1);
    expect(engine.master?.scrollTrigger).toBeDefined();
    expect(engine.velocity()).toBe(0);
    engine.destroy();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('SE4 ScrollTrigger first registered on a rotation keeps its own matchMedia when the engine context reverts', async () => {
    // Without the prepare frame, so the first registration happens inside the engine context.
    const { engine, register, unscoped } = await engineFor(
      TABLET,
      { heroExitParallax: true, pinnedScenes: true } as unknown as TierSettings,
      false,
    );
    expect(register).not.toHaveBeenCalled();
    // Landscape: the context re-runs wide and registers ScrollTrigger inside it.
    rotate(true);
    expect(register).toHaveBeenCalledTimes(1);
    expect(engine.master?.scrollTrigger).toBeDefined();
    expect(unscoped).toHaveLength(1);
    // Portrait again: the engine context reverts and re-runs.
    rotate(false);
    const own = unscoped[0] as unknown as { contexts: { isReverted: boolean }[] };
    expect(own.contexts.length).toBeGreaterThan(0);
    expect(own.contexts.every((context) => !context.isReverted)).toBe(true);
    engine.destroy();
  });

  it('SE5 ScrollTrigger first registered by the master on a wide re-run without pins keeps its own matchMedia', async () => {
    const { engine, register, unscoped, ScrollTrigger } = await engineFor(
      PHONE,
      { heroExitParallax: true, pinnedScenes: false } as unknown as TierSettings,
      false,
    );
    expect(register).not.toHaveBeenCalled();
    // Wide: the hero scrub is the master's first child, so the master registers ScrollTrigger.
    rotate(true);
    expect(register).toHaveBeenCalledTimes(1);
    expect(engine.master?.scrollTrigger).toBeDefined();
    rotate(false);
    const own = unscoped[0] as unknown as { contexts: { isReverted: boolean }[] };
    expect(own.contexts.every((context) => !context.isReverted)).toBe(true);
    engine.destroy();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('SE6 a refresh on a phone whose scenes add no child neither gives the master a trigger nor adopts the spine', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    const { engine, ScrollTrigger } = await engineFor(PHONE);
    vi.spyOn(ScrollTrigger, 'refresh').mockImplementation(() => {});
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(engine.master?.scrollTrigger).toBeUndefined();
    // Adopted, the spine would shrink to the first scene's segment.
    expect(engine.master?.duration()).toBe(1);
    engine.destroy();
  });
});

describe('scroll engine: pins over the CSS geometry (dom)', () => {
  it('SE12 a pinned layout runs the scene pins and neither refreshes nor scrolls at creation', async () => {
    // The sticky stages and their rooms are CSS (html[data-pins]): no spacer arrives that a
    // refresh in the creation task would have to place the reader against (F2, F3).
    media.wide = true;
    window.scrollTo = vi.fn();
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    scrub.pin = ScrollTrigger;
    const refresh = vi.spyOn(ScrollTrigger, 'refresh');
    const { engine } = await engineFor(TABLET);
    expect(
      ScrollTrigger.getAll().filter((trigger) => trigger.trigger?.matches('[data-scene="trust"]')),
    ).toHaveLength(1);
    expect(ScrollTrigger.getAll().some((trigger) => trigger.pin)).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
    engine.destroy();
  });
});

describe('scroll engine under 1024 px (phone spec 1.4, D25, D28)', () => {
  it('SE7 every setup is its own task, the first one too: the creation task makes no trigger', async () => {
    // trust is the first scene and near; its setup adds a scrub, so the master gets its trigger.
    scrub.on = true;
    const { engine, ScrollTrigger } = await engineFor(
      PHONE,
      undefined,
      true,
      '<section data-scene="trust"></section>',
    );
    // The hero's Drift alone (a trigger and its first refresh) made the creation task 52 to 64 ms
    // at 4x when the first setup ran in it.
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(engine.master?.scrollTrigger).toBeUndefined();
    await nextTask();
    expect(engine.master?.scrollTrigger).toBeDefined();
    engine.destroy();
  });

  it('SE7b a scene beyond two viewports sets up only when it comes near', async () => {
    scrub.on = true;
    const top = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: Element,
    ) {
      const far = this.getAttribute('data-scene') === 'trust';
      return { top: far ? 5000 : 0, height: 100, bottom: far ? 5100 : 100 } as DOMRect;
    });
    const { engine, ScrollTrigger } = await engineFor(PHONE);
    await setupsDone();
    // trust is far: one `once` trigger waits for it, and the master has no child yet.
    const [near] = ScrollTrigger.getAll();
    expect(near?.vars).toMatchObject({ start: 'top bottom+=100%', once: true });
    expect(engine.master?.scrollTrigger).toBeUndefined();
    near?.vars.onEnter?.(near);
    expect(engine.master?.scrollTrigger).toBeDefined();
    engine.destroy();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    top.mockRestore();
  });

  it('SE8 data-settling marks one --dur-3 window after creation and again at destroy', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const { engine, root } = await engineFor(PHONE);
      expect(root.hasAttribute('data-settling')).toBe(true);
      await vi.advanceTimersByTimeAsync(369);
      expect(root.hasAttribute('data-settling')).toBe(true);
      await vi.advanceTimersByTimeAsync(1);
      expect(root.hasAttribute('data-settling')).toBe(false);
      engine.destroy();
      expect(root.hasAttribute('data-settling')).toBe(true);
      await vi.advanceTimersByTimeAsync(370);
      expect(root.hasAttribute('data-settling')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('SE9 phone mode: no resize refresh, and a height change asks for refresh(true)', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    scrub.on = true;
    const { ScrollTrigger: before } = await import('gsap/ScrollTrigger');
    const config = vi.spyOn(before, 'config');
    const { engine, ScrollTrigger } = await engineFor(PHONE);
    const refresh = vi.spyOn(ScrollTrigger, 'refresh').mockImplementation(() => {});
    await setupsDone();
    expect(config).toHaveBeenCalledWith({
      autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load',
    });
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(refresh).toHaveBeenLastCalledWith(true);
    engine.destroy();
    // The default list again once the phone engine is gone.
    expect(config).toHaveBeenLastCalledWith({
      autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize',
    });
  });

  it('SE10 a fine pointer under 1024 px keeps the forced refresh and the resize event', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    media.fine = true;
    scrub.on = true;
    const { ScrollTrigger: before } = await import('gsap/ScrollTrigger');
    const config = vi.spyOn(before, 'config');
    const { engine, ScrollTrigger } = await engineFor(PHONE);
    const refresh = vi.spyOn(ScrollTrigger, 'refresh').mockImplementation(() => {});
    await setupsDone();
    expect(config.mock.calls).toEqual([[{ ignoreMobileResize: true }]]);
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(refresh).toHaveBeenLastCalledWith(false);
    engine.destroy();
  });

  it('SE11 the tier-0 engine after a phone step-down neither refreshes ScrollTrigger nor brings the resize refresh back', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    scrub.on = true;
    const { ScrollTrigger: before } = await import('gsap/ScrollTrigger');
    const config = vi.spyOn(before, 'config');
    const first = await engineFor(PHONE);
    await setupsDone();
    // The step-down: the tier-1 engine goes, ScrollTrigger stays registered for the page.
    first.engine.destroy();
    const { createScrollEngine } = await import('./scrollEngine');
    const { SCENES } = await import('../scenes/registry');
    const { ScrollTrigger } = first;
    const refresh = vi.spyOn(ScrollTrigger, 'refresh');
    const engine = createScrollEngine({
      root: first.root,
      layout: { ...PHONE, latchedAtTier: 0 },
      settings: {} as TierSettings,
      scenes: SCENES,
    });
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(config).toHaveBeenLastCalledWith({
      autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load',
    });
    // A FAQ opens: with no trigger to measure, a refresh would only scroll the window to 0 and back.
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(refresh).not.toHaveBeenCalled();
    engine.destroy();
    expect(config).toHaveBeenLastCalledWith({
      autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize',
    });
  });
});

describe('monitorFrames (phone spec D26)', () => {
  /** The monitor's frame loop driven by hand (one pending rAF callback), and ScrollTrigger's events. */
  async function monitored(phone: boolean) {
    const { gsap } = await import('gsap');
    const { ScrollTrigger } = await import('gsap/ScrollTrigger');
    const events = new Map<string, () => void>();
    vi.spyOn(ScrollTrigger, 'addEventListener').mockImplementation(((
      type: string,
      cb: () => void,
    ) => {
      events.set(type, cb);
    }) as typeof ScrollTrigger.addEventListener);
    vi.spyOn(ScrollTrigger, 'removeEventListener').mockImplementation(((type: string) => {
      events.delete(type);
    }) as typeof ScrollTrigger.removeEventListener);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const { monitorFrames } = await import('./scrollEngine');
    const steps: number[] = [];
    const windows: MonitorWindow[] = [];
    let frames = 0;
    const stop = monitorFrames({
      tier: 2,
      phone,
      onStepDown: () => steps.push(now),
      onWindow: (w) => windows.push(w),
      onFrame: () => {
        frames += 1;
      },
    });
    // After creation, so ScrollTrigger's registration keeps the real frame and ticker calls.
    let pending: FrameRequestCallback | null = null;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending = callback;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {
      pending = null;
    });
    const tickerAdd = vi.spyOn(gsap.ticker, 'add');
    let y = 0;
    return {
      steps,
      windows,
      stop,
      events,
      tickerAdd,
      subscribed: () => pending !== null,
      counted: () => frames,
      /**
       * A frame `ms` after the last one, the page `dy` px further down (0: a still frame): the rAF
       * callback gets the frame's timestamp.
       */
      frame(ms: number, dy = 10) {
        now += ms;
        y += dy;
        vi.stubGlobal('scrollY', y);
        const callback = pending;
        pending = null;
        callback?.(now);
      },
      wait(ms: number) {
        now += ms;
      },
    };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('U-PH7 a frame loop only between scrollStart and scrollEnd, never on the gsap ticker; the first frame time after a start is dropped', async () => {
    const m = await monitored(true);
    expect(m.subscribed()).toBe(false);
    m.wait(2000); // the warm-up passes at rest
    m.events.get('scrollStart')?.();
    expect(m.subscribed()).toBe(true);
    m.frame(5000); // the idle gap since the last frame: dropped
    for (let i = 0; i < 15; i += 1) m.frame(17); // 255 ms at 59 fps: one good window
    expect(m.windows).toEqual([{ slowMs: 0, slow: false, stepped: false }]);
    m.frame(100); // half a slow window when the scroll ends: dropped
    m.events.get('scrollEnd')?.();
    expect(m.subscribed()).toBe(false);
    m.wait(10_000);
    m.events.get('scrollStart')?.();
    m.frame(17); // dropped again
    for (let i = 0; i < 15; i += 1) m.frame(17);
    expect(m.windows).toHaveLength(2);
    expect(m.windows[1]).toEqual({ slowMs: 0, slow: false, stepped: false });
    m.stop();
    expect(m.events.size).toBe(0);
    expect(m.subscribed()).toBe(false);
    // gsap dispatches its listeners at most once per 4 ms of Date.now(): two late frames whose
    // callbacks run close together would reach a ticker listener as one long frame.
    expect(m.tickerAdd).not.toHaveBeenCalled();
  });

  it('U-PH7b a 600 ms freeze inside a scroll counts as 600 ms (the frame clock, not a lag-smoothed delta)', async () => {
    const m = await monitored(true);
    m.wait(2000);
    m.events.get('scrollStart')?.();
    m.frame(16); // dropped
    m.frame(600);
    m.frame(600);
    // Two 600 ms frames are 1200 ms of slow time: phone mode goes to tier 0 at once.
    expect(m.windows).toEqual([
      { slowMs: 600, slow: true, stepped: false },
      { slowMs: 0, slow: true, stepped: true },
    ]);
    expect(m.steps).toHaveLength(1);
    m.stop();
  });

  it('U-PH7c a frame in which the page did not move is not sampled: the still frames before scrollEnd never reset the slow time', async () => {
    const m = await monitored(true);
    m.wait(2000);
    m.events.get('scrollStart')?.();
    m.frame(16); // dropped
    for (let i = 0; i < 10; i += 1) m.frame(50); // 500 ms at 20 fps: two slow windows
    expect(m.windows.map((w) => w.slowMs)).toEqual([250, 500]);
    // The finger rests, then lifts: 400 ms of fast still frames before ScrollTrigger's scrollEnd.
    for (let i = 0; i < 24; i += 1) m.frame(16.7, 0);
    m.events.get('scrollEnd')?.();
    m.events.get('scrollStart')?.();
    m.frame(16); // dropped
    for (let i = 0; i < 10; i += 1) m.frame(50);
    // 1000 ms of slow time while the page moved: tier 0.
    expect(m.windows.slice(2)).toEqual([
      { slowMs: 750, slow: true, stepped: false },
      { slowMs: 0, slow: true, stepped: true },
    ]);
    expect(m.steps).toHaveLength(1);
    m.stop();
  });

  it('U-PH7d every frame of the loop is counted, still or not, and none between scrollEnd and the next scrollStart', async () => {
    const m = await monitored(true);
    m.events.get('scrollStart')?.();
    m.frame(16);
    m.frame(16);
    m.frame(16.7, 0); // the finger rests: not sampled, but the loop ran
    expect(m.counted()).toBe(3);
    m.events.get('scrollEnd')?.();
    m.wait(1000);
    m.frame(16); // no loop at rest: nothing calls back
    expect(m.counted()).toBe(3);
    m.stop();
  });
});
