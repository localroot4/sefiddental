import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { LayoutLatch } from '../tier/latch';

/**
 * Turns the trust scene into one that adds a scrub to the master (no shipped scene does on a
 * phone): at `setup`, or later through `later` (a lazy chunk).
 */
const scrub = vi.hoisted(() => ({ on: false, later: null as null | (() => void) }));

vi.mock('../scenes/dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scenes/dom')>();
  return {
    DOM_SCENES: {
      ...actual.DOM_SCENES,
      trust: {
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

/** jsdom has no matchMedia: `all` matches, the width and orientation follow `media`. */
const media = { wide: false };
const mediaListeners = new Set<() => void>();
function installMatchMedia(): void {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === '(min-width: 1024px)') return media.wide;
      if (query === '(orientation: portrait)') return !media.wide;
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

async function engineFor(layout: LayoutLatch, settings = {} as TierSettings) {
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
  root.innerHTML =
    '<section data-scene="hero"><div data-hero-photo></div></section><section data-scene="trust"></section>';
  document.body.append(root);
  prepareScrollEngine(layout);
  const engine = createScrollEngine({ root, layout, settings, scenes: SCENES });
  return { engine, register, ScrollTrigger, unscoped };
}

beforeEach(() => {
  vi.resetModules();
  media.wide = false;
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
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('scroll engine without ScrollTrigger (dom)', () => {
  it('SE1 a phone layout whose scenes add no scrub never registers ScrollTrigger; labels and progress still work', async () => {
    const { engine, register, ScrollTrigger } = await engineFor(PHONE);
    expect(register).not.toHaveBeenCalled();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(engine.master?.scrollTrigger).toBeUndefined();
    expect(engine.labels()).toEqual(['hero', 'trust']);
    expect(engine.progress()).toBe(0);
    engine.destroy();
  });

  it('SE2 a scene that adds a scrub on a phone registers ScrollTrigger and gives the master its trigger', async () => {
    scrub.on = true;
    const { engine, register, ScrollTrigger } = await engineFor(PHONE);
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
    const { engine, register, unscoped } = await engineFor(TABLET, {
      heroExitParallax: true,
      pinnedScenes: true,
    } as unknown as TierSettings);
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
    const { engine, register, unscoped, ScrollTrigger } = await engineFor(PHONE, {
      heroExitParallax: true,
      pinnedScenes: false,
    } as unknown as TierSettings);
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

  it('SE6 a refresh on a phone whose scenes add no child neither registers ScrollTrigger nor adopts the spine', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    const { engine, register } = await engineFor(PHONE);
    resized?.();
    resized?.();
    for (const frame of frames.splice(0)) frame(0);
    expect(register).not.toHaveBeenCalled();
    // Adopted, the spine would shrink to the first scene's segment.
    expect(engine.master?.duration()).toBe(1);
    engine.destroy();
  });
});
