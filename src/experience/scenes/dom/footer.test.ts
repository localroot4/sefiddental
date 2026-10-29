// @vitest-environment jsdom
import { gsap } from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../../engine/scrollEngine';
import type { SceneContext } from '../types';

import scene, { boundsOf, floorY, playgroundRuns } from './footer';

/** The brief's number, written here so a drift in the module shows. */
const HOME_AFTER_MS = 6000;

interface FakeDraggable {
  target: HTMLElement;
  isPressed: boolean;
  isThrowing: boolean;
  vars: { bounds?: unknown };
  kill: ReturnType<typeof vi.fn>;
}
type Callbacks = Record<
  'onPressInit' | 'onPress' | 'onRelease' | 'onThrowComplete',
  (this: FakeDraggable) => void
>;

const mocks = vi.hoisted(() => ({
  chunkLoads: 0,
  /** The next read of the chunk's export throws: a failed import, as the scene sees it. */
  failNext: false,
  instances: [] as FakeDraggable[],
  vars: null as Callbacks | null,
  triggers: [] as { vars: { onEnter: () => void }; kill: ReturnType<typeof vi.fn> }[],
}));

// The chunk is counted on its first evaluation: 0 proves it was never requested.
vi.mock('./playground.lazy', () => {
  mocks.chunkLoads += 1;
  const Draggable = {
    create: (targets: HTMLElement[], vars: Callbacks) => {
      mocks.vars = vars;
      const made = targets.map((target) => ({
        target,
        isPressed: false,
        isThrowing: false,
        vars: {},
        kill: vi.fn(),
      }));
      mocks.instances.push(...made);
      return made;
    },
  };
  return {
    get default() {
      if (mocks.failNext) {
        mocks.failNext = false;
        throw new Error('offline');
      }
      return Draggable;
    },
  };
});
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: (vars: { onEnter: () => void }) => {
      const trigger = { vars, kill: vi.fn() };
      mocks.triggers.push(trigger);
      return trigger;
    },
  },
}));

const SETTINGS = { footerPlayground: 'dom' } as TierSettings;

let el: HTMLElement;
let field: HTMLElement;
let replay: HTMLButtonElement;
/** «پخش دوباره» as the reader meets it; its box stays at every tier (D24). */
const shown = (button: HTMLElement): boolean =>
  !button.classList.contains('invisible') && !button.hasAttribute('inert') && !button.hidden;
let parts: HTMLElement[];
let near: (() => void) | null;
let cancelNear: ReturnType<typeof vi.fn<() => void>>;

function stage(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div data-playground-field="">
      <div data-playground-part="mark"></div>
      <div data-playground-part="bar"></div>
      <div data-playground-part="diamond-1"></div>
    </div>
    <button data-playground-replay="" inert class="invisible" type="button">replay</button>`;
  document.body.append(root);
  return root;
}

function ctx(over: Partial<SceneContext> = {}): SceneContext {
  return {
    id: 'footer',
    el,
    layout: { pinnedScenes: false, lenis: true, latchedAtTier: 1 },
    settings: SETTINGS,
    conditions: { reduce: false, fine: true, wide: true },
    engine: {} as ScrollEngine,
    master: {} as gsap.core.Timeline,
    label: 'footer',
    segment: () => ({ start: 0.9, end: 1 }),
    nearViewport: (cb) => {
      near = cb;
      return cancelNear;
    },
    ...over,
  };
}

/** The chunk resolved (a microtask) and the arming frame ran (a 0 ms timer here). */
const settled = () => new Promise((resolve) => setTimeout(resolve, 5));

beforeEach(() => {
  // Frames are 0 ms timers here (jsdom schedules none on its own).
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    window.setTimeout(() => cb(performance.now()), 0),
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  el = stage();
  field = el.querySelector('[data-playground-field]')!;
  replay = el.querySelector('button')!;
  parts = Array.from(el.querySelectorAll('[data-playground-part]'));
  near = null;
  cancelNear = vi.fn<() => void>();
  mocks.instances.length = 0;
  mocks.triggers.length = 0;
  mocks.vars = null;
  mocks.failNext = false;
});

afterEach(() => {
  for (const tween of gsap.getTweensOf(parts)) tween.kill();
  el.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('floorY', () => {
  it('rests the part on the field bottom edge', () => {
    expect(floorY({ clientHeight: 300 }, { offsetTop: 100, offsetHeight: 50 })).toBe(150);
    expect(floorY({ clientHeight: 440 }, { offsetTop: 320, offsetHeight: 120 })).toBe(0);
  });
});

describe('boundsOf', () => {
  it('is the field edges in the part transform space, the floor as maxY', () => {
    const field = { clientWidth: 1000, clientHeight: 300 };
    const part = { offsetLeft: 700, offsetTop: 100, offsetWidth: 96, offsetHeight: 50 };
    expect(boundsOf(field, part)).toEqual({ minX: -700, maxX: 204, minY: -100, maxY: 150 });
  });
});

describe('playgroundRuns', () => {
  it('runs for the DOM and the 3D setting, never static or under reduced motion', () => {
    expect(playgroundRuns({ footerPlayground: 'dom' }, false)).toBe(true);
    expect(playgroundRuns({ footerPlayground: '3d' }, false)).toBe(true);
    expect(playgroundRuns({ footerPlayground: 'static' }, false)).toBe(false);
    expect(playgroundRuns({ footerPlayground: 'dom' }, true)).toBe(false);
  });
});

describe('footer scene', () => {
  it('tier 0 (static) and reduced motion: no chunk, no trigger, the replay stays hidden', () => {
    expect(scene.setup(ctx({ settings: { footerPlayground: 'static' } as TierSettings }))).toBe(
      undefined,
    );
    expect(
      scene.setup(ctx({ conditions: { reduce: true, fine: true, wide: true } })),
    ).toBeUndefined();
    expect(near).toBeNull();
    expect(mocks.chunkLoads).toBe(0);
    expect(mocks.triggers).toEqual([]);
    expect(shown(replay)).toBe(false);
  });

  it('loads the chunk near the viewport, drops on enter, and times the way home at 6000 ms', async () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    const cleanup = scene.setup(ctx());
    expect(typeof cleanup).toBe('function');
    expect(shown(replay)).toBe(true);
    expect(mocks.chunkLoads).toBe(0);

    near!();
    await settled();
    expect(mocks.chunkLoads).toBe(1);
    expect(mocks.instances.map((d) => d.target)).toEqual(parts);

    mocks.triggers[0]!.vars.onEnter();
    await settled();
    // The drop starts above the home position (56 px past the header line in a zero-layout DOM).
    for (const part of parts) expect(Number(gsap.getProperty(part, 'y'))).toBeLessThan(0);

    // A release without a throw arms the timer; the part at its floor goes nowhere first.
    const bar = mocks.instances[1]!;
    mocks.vars!.onPressInit.call(bar);
    expect(bar.vars.bounds).toEqual(boundsOf(field, bar.target));
    mocks.vars!.onPress.call(bar);
    expect(bar.target.classList.contains('z-10')).toBe(true);
    expect(bar.target.style.willChange).toBe('transform');
    gsap.set(bar.target, { y: floorY(field, bar.target) });
    mocks.vars!.onRelease.call(bar);
    expect(bar.target.style.willChange).toBe('');
    expect(timeout).toHaveBeenLastCalledWith(expect.any(Function), HOME_AFTER_MS);

    // Pressing another part raises it instead and cancels the timer.
    const clear = vi.spyOn(window, 'clearTimeout');
    const mark = mocks.instances[0]!;
    mocks.vars!.onPress.call(mark);
    expect(bar.target.classList.contains('z-10')).toBe(false);
    expect(mark.target.classList.contains('z-10')).toBe(true);
    expect(clear).toHaveBeenCalled();

    (cleanup as () => void)();
    expect(gsap.getTweensOf(parts)).toEqual([]);
    for (const drag of mocks.instances) expect(drag.kill).toHaveBeenCalledTimes(1);
    expect(mocks.triggers[0]!.kill).toHaveBeenCalledTimes(1);
    expect(cancelNear).toHaveBeenCalledTimes(1);
    expect(shown(replay)).toBe(false);
    for (const part of parts) {
      expect(part.style.transform).toBe('');
      expect(part.style.willChange).toBe('');
      expect(part.classList.contains('z-10')).toBe(false);
    }
    // After the cleanup nothing answers: the chunk is not requested again, no drop runs.
    replay.click();
    await settled();
    expect(gsap.getTweensOf(parts)).toEqual([]);
  });

  it('a throw that ends above the floor bounces down to it; one at the floor arms the timer', async () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    const cleanup = scene.setup(ctx());
    near!();
    await settled();
    Object.defineProperty(field, 'clientHeight', { value: 300, configurable: true });
    const mark = mocks.instances[0]!;
    Object.defineProperty(mark.target, 'offsetTop', { value: 100, configurable: true });
    Object.defineProperty(mark.target, 'offsetHeight', { value: 50, configurable: true });
    gsap.set(mark.target, { y: 20 });
    mocks.vars!.onThrowComplete.call(mark);
    const [fall] = gsap.getTweensOf(mark.target);
    expect(fall).toBeDefined();
    expect(fall!.vars.y).toBe(150);
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), HOME_AFTER_MS);

    gsap.killTweensOf(mark.target);
    gsap.set(mark.target, { y: 150 });
    mocks.vars!.onThrowComplete.call(mark);
    expect(gsap.getTweensOf(mark.target)).toEqual([]);
    expect(timeout).toHaveBeenLastCalledWith(expect.any(Function), HOME_AFTER_MS);
    (cleanup as () => void)();
  });

  it('«پخش دوباره» replays the drop through the same chunk', async () => {
    const cleanup = scene.setup(ctx());
    replay.click();
    await settled();
    expect(mocks.chunkLoads).toBe(1);
    for (const part of parts) expect(Number(gsap.getProperty(part, 'y'))).toBeLessThan(0);
    (cleanup as () => void)();
  });

  it('the way home is not armed while a part is held; its release arms it', async () => {
    const timeout = vi.spyOn(window, 'setTimeout');
    const cleanup = scene.setup(ctx());
    near!();
    await settled();
    const [mark, bar] = mocks.instances as [FakeDraggable, FakeDraggable];
    mocks.vars!.onPress.call(mark);
    mark.isPressed = true;
    // Another part lands on the floor (the drop's end goes the same way) under the press.
    mocks.vars!.onThrowComplete.call(bar);
    expect(timeout).not.toHaveBeenCalledWith(expect.any(Function), HOME_AFTER_MS);

    mark.isPressed = false;
    mocks.vars!.onRelease.call(mark);
    expect(timeout).toHaveBeenLastCalledWith(expect.any(Function), HOME_AFTER_MS);
    (cleanup as () => void)();
  });

  it('a failed chunk is reported once and requested again by the next replay', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cleanup = scene.setup(ctx());
    mocks.failNext = true;
    replay.click();
    await settled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(gsap.getTweensOf(parts)).toEqual([]);

    replay.click();
    await settled();
    expect(error).toHaveBeenCalledTimes(1);
    for (const part of parts) expect(Number(gsap.getProperty(part, 'y'))).toBeLessThan(0);
    (cleanup as () => void)();
  });
});
