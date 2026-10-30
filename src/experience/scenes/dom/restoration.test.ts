// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { setupChoices } from '@/components/chrome/choices';

import type { DomScene } from '../types';
import type { PhoneTargets } from './phone';
import scene, { LOCK_MS, lockHolds, selectStep, stepAt, stepScrollY } from './restoration';

// gsap stands in as spies: RS-S5 reads the inline base state `pin` writes and drives the trigger's
// callbacks by hand (the scrub itself is covered by T-RS1 and T-RS6).
const g = vi.hoisted(() => {
  const timeline = { to: () => timeline, fromTo: () => timeline, render: () => {}, time: () => 0 };
  return {
    timeline,
    set: vi.fn<(el: Element, vars: { opacity: number; scale: number }) => void>(),
    create: vi.fn((config: Record<string, unknown>) => ({ ...config, start: 1000, end: 1900 })),
  };
});
vi.mock('gsap', () => ({ gsap: { set: g.set, timeline: () => g.timeline } }));
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: { create: g.create } }));
// The phone scroll set is phone.ts's (phone.test.tsx, T-RS4); here only what the scene hands it.
const phone = vi.hoisted(() => {
  const off = vi.fn();
  return { off, motion: vi.fn((_targets: unknown) => off) };
});
vi.mock('./phone', () => ({ phoneMotion: phone.motion }));
// jsdom has no matchMedia: the viewport is wide unless a test narrows it.
const media = { wide: true };
window.matchMedia = (query: string) =>
  ({
    get matches() {
      return media.wide;
    },
    media: query,
  }) as MediaQueryList;

describe('scene 4 restoration helpers', () => {
  it('RS-S1 the pin progress selects equal thirds, clamped at both ends', () => {
    expect([0, 0.33, 0.34, 0.66, 0.67, 1].map((p) => stepAt(p, 3))).toEqual([0, 0, 1, 1, 2, 2]);
    expect(stepAt(1.2, 3)).toBe(2);
    expect(stepAt(-0.1, 3)).toBe(0);
    expect(stepAt(0.5, 2)).toBe(1);
  });

  it('RS-S2 a user choice scrolls to the middle of its third', () => {
    expect([0, 1, 2].map((i) => stepScrollY(1000, 1900, i, 3))).toEqual([1150, 1450, 1750]);
  });

  it('RS-S3 the scroll checks a radio with one untrusted change, which moves data-choice (D21); -1 clears the group', () => {
    document.body.innerHTML = `<div data-choices="">${[0, 1, 2]
      .map((i) => `<input type="radio" name="home-tier" value="t${i}">`)
      .join('')}</div>`;
    const group = document.querySelector('[data-choices]')!;
    const radios = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
    const stop = setupChoices(document);
    const changes: boolean[] = [];
    const onChange = (event: Event) => changes.push(event.isTrusted);
    document.addEventListener('change', onChange);
    selectStep(radios, 1);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    expect(group.getAttribute('data-choice')).toBe('2');
    selectStep(radios, 2);
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
    expect(group.getAttribute('data-choice')).toBe('3');
    selectStep(radios, -1);
    expect(radios.map((r) => r.checked)).toEqual([false, false, false]);
    expect(group.hasAttribute('data-choice')).toBe(false);
    // Untrusted: HomeBookingPrefill sends no tier_select for them (RS2).
    expect(changes).toEqual([false, false, false]);
    document.removeEventListener('change', onChange);
    stop();
  });

  it('RS-S4 a choice on its way owns the chip through the thirds it passes, until it arrives, the scroll turns, or its time is up', () => {
    const lock = { step: 2, direction: 1, until: 1500 };
    expect(lockHolds(lock, 1, 1, 100)).toBe(true);
    expect(lockHolds(lock, 2, 1, 100)).toBe(false);
    expect(lockHolds(lock, 1, -1, 100)).toBe(false);
    expect(lockHolds(lock, 1, 1, 1500)).toBe(false);
    expect(lockHolds(null, 1, 1, 100)).toBe(false);
  });

  it('RS-S5 a chip checked before the engine (a tap before its chunk, a relatch) keeps its layer and survives the engine; the first scroll inside the pin takes over', () => {
    document.body.innerHTML = `<div data-scene="restoration"><section>
      ${['plain', 'vip', 'cip'].map((l) => `<svg data-level="${l}"></svg>`).join('')}
      ${[0, 1, 2].map((i) => `<input type="radio" name="home-tier" value="t${i}">`).join('')}
    </section><div data-pin-room=""></div></div>`;
    const el = document.querySelector<HTMLElement>('[data-scene]')!;
    const radios = Array.from(el.querySelectorAll('input'));
    const layers = Array.from(el.querySelectorAll('[data-level]'));
    radios[1]!.checked = true;
    const ctx = {
      el,
      conditions: { reduce: false, fine: true, wide: true },
      engine: { scrollTo: vi.fn() },
    } as unknown as Parameters<NonNullable<DomScene['pin']>>[0] & Parameters<DomScene['setup']>[0];
    const shown = () =>
      layers.map((layer) => g.set.mock.calls.findLast(([target]) => target === layer)?.[1].opacity);

    scene.pin!(ctx);
    expect(shown()).toEqual([0, 1, 0]);
    const cleanup = scene.setup(ctx) as () => void;
    const trigger = g.create.mock.calls[0]![0] as {
      onRefresh(self: object): void;
      onUpdate(self: object): void;
    };
    // A refresh above the pin keeps the reader's chip.
    trigger.onRefresh({ isActive: false, progress: 0, direction: 1 });
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    // The engine goes (a relatch) before the scroll entered the pin: the chosen chip stays.
    cleanup();
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);

    // Next engine: inside the pin the scroll owns the step and the layers again.
    g.set.mockClear();
    g.create.mockClear();
    scene.pin!(ctx);
    const cleanupNext = scene.setup(ctx) as () => void;
    const next = g.create.mock.calls[0]![0] as { onUpdate(self: object): void };
    next.onUpdate({ isActive: true, progress: 0.05, direction: 1 });
    expect(radios.map((r) => r.checked)).toEqual([true, false, false]);
    expect(shown()).toEqual([1, 0, 0]);
    // The scroll's own change is no choice: it scrolls nowhere.
    expect(ctx.engine.scrollTo).not.toHaveBeenCalled();
    // A chip the scroll checked is cleared with the engine (F24 without a pin).
    cleanupNext();
    expect(radios.map((r) => r.checked)).toEqual([false, false, false]);
  });

  it('RS-S6 a choice owns the chip for LOCK_MS at most: a wheel that stops the smooth scroll short hands the chip back to the scroll', () => {
    document.body.innerHTML = `<div data-scene="restoration"><section>
      ${['plain', 'vip', 'cip'].map((l) => `<svg data-level="${l}"></svg>`).join('')}
      ${[0, 1, 2].map((i) => `<input type="radio" name="home-tier" value="t${i}">`).join('')}
    </section><div data-pin-room=""></div></div>`;
    const el = document.querySelector<HTMLElement>('[data-scene]')!;
    const radios = Array.from(el.querySelectorAll('input'));
    const scrollTo = vi.fn();
    const ctx = {
      el,
      conditions: { reduce: false, fine: true, wide: true },
      engine: { scrollTo },
    } as unknown as Parameters<NonNullable<DomScene['pin']>>[0] & Parameters<DomScene['setup']>[0];
    const now = vi.spyOn(performance, 'now').mockReturnValue(10_000);
    g.create.mockClear();
    scene.pin!(ctx);
    const cleanup = scene.setup(ctx) as () => void;
    const trigger = g.create.mock.calls[0]![0] as { onUpdate(self: object): void };
    trigger.onUpdate({ isActive: true, progress: 0.05, direction: 1 });

    radios[2]!.click(); // a trusted change, as a tap or an arrow key
    // A tap: no keyboard focus, so the scroll is smooth.
    expect(scrollTo).toHaveBeenCalledWith(1750, { immediate: false });
    // On its way through VIP's third the chip stays CIP ...
    now.mockReturnValue(10_000 + LOCK_MS - 1);
    trigger.onUpdate({ isActive: true, progress: 0.5, direction: 1 });
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
    // ... until the lock's time is up: the scroll stopped in VIP's third, so the chip says VIP.
    now.mockReturnValue(10_000 + LOCK_MS);
    trigger.onUpdate({ isActive: true, progress: 0.5, direction: 1 });
    expect(radios.map((r) => r.checked)).toEqual([false, true, false]);
    cleanup();
    now.mockRestore();
  });

  it('RS-S8 a keyboard choice scrolls at once, so a fast Tab after it keeps the focus in view', () => {
    document.body.innerHTML = `<div data-scene="restoration"><section>
      ${['plain', 'vip', 'cip'].map((l) => `<svg data-level="${l}"></svg>`).join('')}
      ${[0, 1, 2].map((i) => `<input type="radio" name="home-tier" value="t${i}">`).join('')}
    </section><div data-pin-room=""></div></div>`;
    const el = document.querySelector<HTMLElement>('[data-scene]')!;
    const radios = Array.from(el.querySelectorAll('input'));
    const scrollTo = vi.fn();
    const ctx = {
      el,
      conditions: { reduce: false, fine: true, wide: true },
      engine: { scrollTo },
    } as unknown as Parameters<NonNullable<DomScene['pin']>>[0] & Parameters<DomScene['setup']>[0];
    g.create.mockClear();
    scene.pin!(ctx);
    const cleanup = scene.setup(ctx) as () => void;
    // An arrow key: the radio it checks has the keyboard focus (focus-visible).
    vi.spyOn(radios[1]!, 'matches').mockReturnValue(true);
    radios[1]!.click();
    expect(scrollTo).toHaveBeenCalledWith(1450, { immediate: true });
    cleanup();
  });

  it('RS-S7 under 1024 px the pin moves no step: the scroll a resize reflow causes before the relatch keeps the chosen chip', () => {
    document.body.innerHTML = `<div data-scene="restoration"><section>
      ${['plain', 'vip', 'cip'].map((l) => `<svg data-level="${l}"></svg>`).join('')}
      ${[0, 1, 2].map((i) => `<input type="radio" name="home-tier" value="t${i}">`).join('')}
    </section><div data-pin-room=""></div></div>`;
    const el = document.querySelector<HTMLElement>('[data-scene]')!;
    const radios = Array.from(el.querySelectorAll('input'));
    const ctx = {
      el,
      conditions: { reduce: false, fine: true, wide: true },
      engine: { scrollTo: vi.fn() },
    } as unknown as Parameters<NonNullable<DomScene['pin']>>[0] & Parameters<DomScene['setup']>[0];
    g.create.mockClear();
    scene.pin!(ctx);
    const cleanup = scene.setup(ctx) as () => void;
    const trigger = g.create.mock.calls[0]![0] as { onUpdate(self: object): void };
    radios[2]!.click();
    trigger.onUpdate({ isActive: true, progress: 0.9, direction: 1 });
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
    // The viewport goes under 1024 px; scroll anchoring moves the page before the relatch.
    media.wide = false;
    trigger.onUpdate({ isActive: true, progress: 0.2, direction: -1 });
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
    cleanup();
    expect(radios.map((r) => r.checked)).toEqual([false, false, true]);
    media.wide = true;
  });

  /** The parts the phone scroll set reads: the molar slot, the chip row and the four panels. */
  const phoneScene = (wide: boolean) => {
    document.body.innerHTML = `<div data-scene="restoration"><section>
      <div data-world-slot="molar">${['plain', 'vip', 'cip']
        .map((l) => `<svg data-level="${l}"></svg>`)
        .join('')}</div>
      <fieldset>${[0, 1, 2]
        .map((i) => `<input type="radio" name="home-tier" value="t${i}">`)
        .join('')}</fieldset>
      ${['', 't0', 't1', 't2'].map((key) => `<div data-tier-panel="${key}"></div>`).join('')}
    </section><div data-pin-room=""></div></div>`;
    const el = document.querySelector<HTMLElement>('[data-scene]')!;
    phone.motion.mockClear();
    phone.off.mockClear();
    return {
      el,
      conditions: { reduce: false, fine: false, wide },
      engine: { scrollTo: vi.fn() },
    } as unknown as Parameters<NonNullable<DomScene['pin']>>[0] & Parameters<DomScene['setup']>[0];
  };

  it('RS-S8 under 1024 px (phone spec scene 4): the molar slot settles and the chip row and the panels rise, one call to phone.ts beside the tap crossfade; the cleanup ends both', () => {
    const ctx = phoneScene(false);
    const slot = ctx.el.querySelector('[data-world-slot="molar"]')!;
    const cleanup = scene.setup(ctx) as () => void;
    expect(phone.motion).toHaveBeenCalledTimes(1);
    const targets = phone.motion.mock.calls[0]![0] as PhoneTargets;
    expect(Object.keys(targets).sort()).toEqual(['rise', 'settle']);
    expect(targets.settle).toHaveLength(1);
    expect(targets.settle?.[0]).toBe(slot);
    // The hidden panels go along; phone.ts's guard skips them (a display: none box is empty).
    expect(
      Array.from(targets.rise ?? []).map((t) => t.getAttribute('data-tier-panel') ?? t.tagName),
    ).toEqual(['FIELDSET', '', 't0', 't1', 't2']);
    expect(slot.hasAttribute('data-motion')).toBe(true);
    cleanup();
    expect(phone.off).toHaveBeenCalledTimes(1);
    expect(slot.hasAttribute('data-motion')).toBe(false);
  });

  it('RS-S9 from 1024 px the phone scroll set stays off: tier 1 has the crossfade alone and the pinned scrub owns the layers', () => {
    const ctx = phoneScene(true);
    (scene.setup(ctx) as () => void)();
    scene.pin!(ctx);
    (scene.setup(ctx) as () => void)();
    expect(phone.motion).not.toHaveBeenCalled();
  });
});
