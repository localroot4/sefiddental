import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import compare from './compare';
import { PHONE_MOTION } from './phone';
import { fakeContext, killAll, registerScrollTrigger } from './sceneTest';

beforeAll(registerScrollTrigger);
afterEach(killAll);

describe('scene 6 compare', () => {
  it('CP1 reveals the [data-enter] elements and nothing else; the slider is untouched', () => {
    const el = document.createElement('div');
    el.innerHTML =
      '<div data-world-slot="compare" data-enter=""><input type="range"></div><div data-enter=""></div><p></p>';
    document.body.append(el);
    const cleanup = compare.setup(fakeContext('compare', el));
    const opacities = Array.from(el.children, (child) => (child as HTMLElement).style.opacity);
    expect(opacities).toEqual(['0', '0', '']);
    expect(el.querySelector('input')?.getAttribute('style')).toBeNull();
    if (typeof cleanup === 'function') cleanup();
  });

  it('CP2 under 1024 px each [data-enter] item scrubs its own Rise; a focus on the slider puts its item at rest', () => {
    const el = document.createElement('div');
    el.innerHTML =
      '<div data-world-slot="compare" data-enter=""><input type="range"></div><div data-enter=""></div>';
    document.body.append(el);
    const conditions = { reduce: false, fine: false, wide: false };
    compare.setup(fakeContext('compare', el, { conditions }));
    const [slot, text] = Array.from(el.children) as HTMLElement[];
    for (const item of [slot!, text!]) {
      const trigger = ScrollTrigger.getAll().find((t) => t.trigger === item);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect(item.style.opacity).toBe('0');
    }
    el.querySelector('input')!.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(slot!.style.opacity).toBe('1');
    expect(el.querySelector('input')?.getAttribute('style')).toBeNull();
  });
});
