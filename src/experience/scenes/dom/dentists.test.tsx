import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import dentists from './dentists';
import { PHONE_MOTION } from './phone';
import { fakeContext, fakeEngine, killAll, registerScrollTrigger } from './sceneTest';

beforeAll(registerScrollTrigger);
afterEach(killAll);

function section(): { el: HTMLElement; card: HTMLElement; portrait: HTMLElement } {
  const el = document.createElement('div');
  el.innerHTML =
    '<div role="region"><article><div data-portrait=""></div></article><article></article></div>';
  document.body.append(el);
  const card = el.querySelector('article')!;
  const portrait = el.querySelector<HTMLElement>('[data-portrait]')!;
  card.getBoundingClientRect = () => ({ left: 100, top: 50, width: 200, height: 250 }) as DOMRect;
  return { el, card, portrait };
}

const pointer = (card: HTMLElement, clientX: number, clientY: number) =>
  card.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY, bubbles: true }));

describe('scene 7 dentists', () => {
  it('DN1 a pointer listener only with a fine pointer, from 1024 px and with the setting', () => {
    for (const conditions of [
      { reduce: false, fine: false, wide: true },
      { reduce: false, fine: true, wide: false },
    ]) {
      const { el, card } = section();
      const add = vi.spyOn(card, 'addEventListener');
      dentists.setup(fakeContext('dentists', el, { conditions }));
      expect(add.mock.calls.map(([type]) => type)).not.toContain('pointermove');
    }
    const { el, card } = section();
    const add = vi.spyOn(card, 'addEventListener');
    const ctx = fakeContext('dentists', el);
    dentists.setup(
      fakeContext('dentists', el, { settings: { ...ctx.settings, pointerParallax: false } }),
    );
    expect(add.mock.calls.map(([type]) => type)).not.toContain('pointermove');
  });

  it('DN2 the portrait follows the pointer by at most 8 px, eased in the tick, and rests on leave', () => {
    const { el, card, portrait } = section();
    const { engine, tick, subscribed } = fakeEngine();
    dentists.setup(fakeContext('dentists', el, { engine }));
    expect(portrait.style.transform).toBe('translate3d(0px, 0px, 0) scale(1.06)');
    expect(subscribed()).toBe(false);

    pointer(card, 300, 300); // the end corner
    expect(subscribed()).toBe(true);
    tick(1 / 60);
    const [x1] = portrait.style.transform.match(/-?[\d.]+/g)!.map(Number);
    expect(x1).toBeGreaterThan(0);
    expect(x1).toBeLessThan(8);
    tick(1); // a long frame closes the distance
    expect(portrait.style.transform).toBe('translate3d(8px, 8px, 0) scale(1.06)');
    pointer(card, -500, -500); // far outside: clamped
    tick(1);
    expect(portrait.style.transform).toBe('translate3d(-8px, -8px, 0) scale(1.06)');
    expect(subscribed()).toBe(false); // settled: the tick is dropped

    card.dispatchEvent(new Event('pointerleave'));
    expect(subscribed()).toBe(true);
    tick(1);
    expect(portrait.style.transform).toBe('translate3d(0px, 0px, 0) scale(1.06)');
  });

  it('DN4 under 1024 px the rail slides in from the inline start; the cards and portraits never move and get no pointer listener', () => {
    const { el, card } = section();
    const rail = el.querySelector<HTMLElement>('[role="region"]')!;
    rail.style.direction = 'rtl';
    const add = vi.spyOn(card, 'addEventListener');
    const conditions = { reduce: false, fine: false, wide: false };
    dentists.setup(fakeContext('dentists', el, { conditions }));
    expect(ScrollTrigger.getAll().map((t) => t.trigger)).toEqual([rail]);
    expect(ScrollTrigger.getAll()[0]?.vars).toMatchObject({
      scrub: PHONE_MOTION.lagS,
      end: 'clamp(top 75%)',
    });
    expect(gsap.getProperty(rail, 'x')).toBe(PHONE_MOTION.slide.x);
    for (const node of el.querySelectorAll('article, [data-portrait]')) {
      expect(node.getAttribute('style')).toBeNull();
    }
    expect(add.mock.calls.map(([type]) => type)).not.toContain('pointermove');
  });

  it('DN3 the cleanup removes the listeners, the tick and the transform', () => {
    const { el, card, portrait } = section();
    const { engine, off, subscribed } = fakeEngine();
    const remove = vi.spyOn(card, 'removeEventListener');
    const cleanup = dentists.setup(fakeContext('dentists', el, { engine }));
    pointer(card, 300, 300);
    expect(subscribed()).toBe(true);
    if (typeof cleanup === 'function') cleanup();
    expect(off).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls.map(([type]) => type)).toEqual(['pointermove', 'pointerleave']);
    expect(portrait.style.transform).toBe('');
    pointer(card, 300, 300);
    expect(subscribed()).toBe(false);
  });
});
