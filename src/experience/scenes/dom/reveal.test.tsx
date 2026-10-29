import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PHONE_MOTION } from './phone';
import { reveal } from './reveal';
import { killAll, registerScrollTrigger } from './sceneTest';

beforeAll(registerScrollTrigger);
afterEach(killAll);

function section(count: number): { el: HTMLElement; items: HTMLElement[] } {
  const el = document.createElement('section');
  const items = Array.from({ length: count }, () => el.appendChild(document.createElement('p')));
  document.body.append(el);
  return { el, items };
}

describe('reveal', () => {
  it('RV1 from 1024 px hides the targets at once and rises 16 px once; under it each target scrubs its own Rise (phone.ts)', () => {
    const { el, items } = section(2);
    reveal(items, el, true);
    expect(items.map((p) => p.style.opacity)).toEqual(['0', '0']);
    expect(gsap.getTweensOf(items[0]!)[0]?.vars.y).toBe(16);
    expect(ScrollTrigger.getAll().map((t) => [t.trigger, t.vars.once])).toEqual([[el, true]]);
    const narrow = section(2);
    reveal(narrow.items, narrow.el, false);
    for (const item of narrow.items) {
      const trigger = ScrollTrigger.getAll().find((t) => t.trigger === item);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect(gsap.getProperty(item, 'y')).toBe(PHONE_MOTION.rise.y);
    }
  });

  it('RV2 a focus inside shows the targets at once; the cleanup drops that listener', () => {
    const { el, items } = section(1);
    const cleanup = reveal(items, el, true);
    el.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(items[0]!.style.opacity).toBe('1');

    const other = section(1);
    reveal(other.items, other.el, true)();
    other.el.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(other.items[0]!.style.opacity).toBe('0');
    cleanup();
  });

  it('RV3 no targets, no tween and no trigger', () => {
    const { el } = section(0);
    reveal([], el, true)();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it('RV4 an entrance already behind the reader is left in its server state: no tween, no trigger', () => {
    const { el, items } = section(1);
    el.getBoundingClientRect = () => ({ top: 100 }) as DOMRect; // innerHeight 768: past 80 %
    reveal(items, el, true)();
    expect(items[0]!.getAttribute('style')).toBeNull();
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
