import { gsap } from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SceneContext } from '../types';

import scene from './workflow';

// The timeline is a recorder: the test reads what the scene placed on it and where.
type Call = { method: string; target: Element; vars: Record<string, unknown>; at: unknown };
let calls: Call[] = [];
let timelineVars: Record<string, unknown> | null = null;
vi.mock('gsap', () => {
  const tl = {
    to: (target: Element, vars: Record<string, unknown>, at: unknown) => {
      calls.push({ method: 'to', target, vars, at });
      return tl;
    },
    fromTo: (
      target: Element,
      from: Record<string, unknown>,
      vars: Record<string, unknown>,
      at: unknown,
    ) => {
      calls.push({ method: 'fromTo', target, vars: { ...vars, from }, at });
      return tl;
    },
  };
  return {
    gsap: {
      timeline: vi.fn((vars: Record<string, unknown>) => {
        timelineVars = vars;
        return tl;
      }),
      set: vi.fn(),
    },
  };
});

// jsdom has no IntersectionObserver: a stand-in that records its targets and lets a test fire it.
let io: {
  callback: IntersectionObserverCallback;
  targets: Set<Element>;
  disconnected: boolean;
} | null;
beforeEach(() => {
  calls = [];
  timelineVars = null;
  io = null;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        io = { callback, targets: new Set(), disconnected: false };
      }
      observe(el: Element) {
        io?.targets.add(el);
      }
      unobserve(el: Element) {
        io?.targets.delete(el);
      }
      disconnect() {
        if (io) io.disconnected = true;
      }
    },
  );
  document.body.innerHTML = `
    <div data-scene="workflow">
      <div data-workflow-stage="">
        <ol data-workflow-path="">
          ${[1, 2, 3, 4].map(() => '<li data-workflow-step=""><span data-workflow-warm=""></span></li>').join('')}
        </ol>
      </div>
      <div data-pin-room=""></div>
    </div>`;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(gsap.timeline).mockClear();
  document.body.innerHTML = '';
});

const el = () => document.querySelector<HTMLElement>('[data-scene]')!;
const stage = () => document.querySelector<HTMLElement>('[data-workflow-stage]')!;
const steps = () => Array.from(document.querySelectorAll<HTMLElement>('[data-workflow-step]'));
/** From 1024 px (tier 1 without a pin, or the pin at tiers 2 and 3). */
const ctx = () =>
  ({ el: el(), conditions: { wide: true, fine: true, reduce: false } }) as unknown as SceneContext;

describe('scene 5 workflow module (lanes WORKFLOW)', () => {
  it('WF-U1 without a pin from 1024 px (tier 1) setup reveals each step once on enter and leaves nothing behind', () => {
    const cleanup = scene.setup(ctx());
    expect(gsap.timeline).not.toHaveBeenCalled();
    expect(io?.targets.size).toBe(4);
    // Nothing hides before the observer's first delivery, which reports every step: a step
    // already on screen is marked `.in` in the same task that writes `data-reveal`.
    expect(stage().hasAttribute('data-reveal')).toBe(false);
    const [first, second] = steps();
    io?.callback(
      [
        { target: first, isIntersecting: true },
        { target: second, isIntersecting: false },
      ] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    expect(stage().hasAttribute('data-reveal')).toBe(true);
    expect(first?.classList.contains('in')).toBe(true);
    expect(second?.classList.contains('in')).toBe(false);
    // Revealed once: the step leaves the observer, so leaving and entering again changes nothing.
    expect(io?.targets.has(first!)).toBe(false);
    expect(typeof cleanup).toBe('function');
    (cleanup as () => void)();
    expect(io?.disconnected).toBe(true);
    expect(stage().hasAttribute('data-reveal')).toBe(false);
    expect(steps().some((step) => step.classList.contains('in'))).toBe(false);
  });

  it('WF-U2 the pin scrubs the pan and the four focus beats over the room after the sticky stage, from its top under the header', () => {
    vi.stubGlobal(
      'getComputedStyle',
      vi.fn(() => ({ getPropertyValue: (name: string) => (name === '--nav-h' ? '72px' : '') })),
    );
    scene.pin!(ctx());
    expect(gsap.timeline).toHaveBeenCalledTimes(1);
    const trigger = timelineVars?.scrollTrigger as Record<string, unknown>;
    const room = document.querySelector<HTMLElement>('[data-pin-room]')!;
    expect(trigger).toMatchObject({ trigger: room, scrub: true, invalidateOnRefresh: true });
    expect(trigger.pin).toBeUndefined();
    // The room never sticks: the stage's top under the header is the room's top less the stage.
    Object.defineProperty(stage(), 'offsetHeight', { value: 828 });
    Object.defineProperty(room, 'offsetHeight', { value: 1800 });
    expect((trigger.start as () => string)()).toBe('top 900px');
    expect((trigger.end as () => string)()).toBe('+=1800');
    // The pan: function values re-read on refresh, across the whole pin.
    const pan = calls.find((c) => c.target.hasAttribute('data-workflow-path'));
    expect(pan).toMatchObject({ method: 'to', at: 0, vars: { duration: 1 } });
    Object.defineProperty(stage(), 'clientWidth', { value: 1000 });
    Object.defineProperty(stage(), 'clientHeight', { value: 800 });
    expect((pan?.vars.x as () => number)()).toBe(900);
    expect((pan?.vars.y as () => number)()).toBe(-960);
    // Step i comes into focus by i/3 and recedes after it; the first starts in focus, the last stays.
    const list = steps();
    const beats = (i: number) =>
      calls.filter((c) => c.target === list[i]).map((c) => [c.method, c.at, c.vars.opacity]);
    expect(beats(0)).toEqual([['to', 0.08, 0.3]]);
    expect(beats(1)).toEqual([
      ['fromTo', 1 / 3 - 0.2, 1],
      ['to', 1 / 3 + 0.08, 0.3],
    ]);
    expect(beats(3)).toEqual([['fromTo', 1 - 0.2, 1]]);
    // The warm overlays: none on the first step, warmer with each step, opacity only.
    const warm = calls.filter((c) => c.target.hasAttribute('data-workflow-warm'));
    expect(warm.map((c) => Math.round((c.vars.opacity as number) * 100) / 100)).toEqual([
      0.12, 0.24, 0.36,
    ]);
    expect(
      warm.every((c) => Object.keys(c.vars).every((k) => k === 'opacity' || k === 'duration')),
    ).toBe(true);
    // Only transform and opacity are written, ever (D12).
    for (const c of calls) {
      for (const key of Object.keys(c.vars))
        expect(['x', 'y', 'scale', 'opacity', 'duration', 'from']).toContain(key);
    }
    // After the pin, setup adds no reveal and its cleanup takes the diagonal away.
    const cleanup = scene.setup(ctx());
    expect(stage().hasAttribute('data-reveal')).toBe(false);
    expect(io).toBeNull();
    (cleanup as () => void)();
    // T-EN3: the pinned path, the steps and the overlays lose every inline style the pin left.
    const overlays = Array.from(document.querySelectorAll('[data-workflow-warm]'));
    expect(gsap.set).toHaveBeenCalledWith(
      [document.querySelector('[data-workflow-path]'), ...steps(), ...overlays],
      { clearProps: 'all' },
    );
  });

  it('WF-U3 a section without the stage markup is left alone', () => {
    document.body.innerHTML = '<div data-scene="workflow"></div>';
    scene.pin!(ctx());
    expect(gsap.timeline).not.toHaveBeenCalled();
    expect(scene.setup(ctx())).toBeUndefined();
  });
});
