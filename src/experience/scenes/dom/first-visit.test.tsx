import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import firstVisit from './first-visit';
import { PHONE_MOTION } from './phone';
import { fakeContext, killAll, registerScrollTrigger } from './sceneTest';

beforeAll(registerScrollTrigger);
afterEach(killAll);

function scene(withLayer: boolean) {
  const el = document.createElement('div');
  el.innerHTML = `${withLayer ? '<div data-warm-layer=""></div>' : ''}
    <div data-home-section="journey"><ol><li></li><li></li></ol></div>
    <div data-home-section="faq"><p></p></div>`;
  document.body.append(el);
  return {
    el,
    layer: el.querySelector<HTMLElement>('[data-warm-layer]'),
    journey: el.querySelector<HTMLElement>('[data-home-section="journey"]')!,
  };
}

const warmOn = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
    (node) => node.style.getPropertyValue('--warm') !== '',
  );

describe('scene 9 first visit', () => {
  it("FV1 scrubs --warm 0 to 1 on the warm layer only, across the journey's entrance; the cleanup removes it", () => {
    const { el, layer, journey } = scene(true);
    const ctx = fakeContext('first-visit', el);
    const cleanup = firstVisit.setup(ctx);
    expect(ctx.master.getChildren(false, true, true)).toHaveLength(0);
    // One scrub on the journey (the steps' reveal is the other trigger).
    const scrub = ScrollTrigger.getAll().find((trigger) => trigger.vars.scrub === true);
    expect(scrub?.trigger).toBe(journey);
    expect(scrub?.vars).toMatchObject({ start: 'top bottom', end: 'top top' });
    // A scrubbed target (D25): the settle window eases it when the engine starts or goes.
    expect(layer!.hasAttribute('data-scrub')).toBe(true);
    const tween = scrub!.animation!;
    tween.progress(1);
    expect(layer!.style.getPropertyValue('--warm')).toBe('1');
    expect(warmOn(el)).toEqual([layer]);
    tween.progress(0.5);
    expect(Number(layer!.style.getPropertyValue('--warm'))).toBeCloseTo(0.5, 5);
    tween.progress(0);
    expect(layer!.style.getPropertyValue('--warm')).toBe('0');
    // The steps rise once by line.
    expect(Array.from(el.querySelectorAll<HTMLElement>('li'), (li) => li.style.opacity)).toEqual([
      '0',
      '0',
    ]);
    if (typeof cleanup === 'function') cleanup();
    expect(warmOn(el)).toEqual([]);
  });

  it('FV3 under 1024 px each journey step scrubs its own Rise; the warm scrub is the same', () => {
    const { el, journey } = scene(true);
    const conditions = { reduce: false, fine: false, wide: false };
    firstVisit.setup(fakeContext('first-visit', el, { conditions }));
    const steps = Array.from(el.querySelectorAll<HTMLElement>('li'));
    for (const step of steps) {
      const trigger = ScrollTrigger.getAll().find((t) => t.trigger === step);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect(step.style.opacity).toBe('0');
    }
    const warm = ScrollTrigger.getAll().find((t) => t.trigger === journey);
    expect(warm?.vars).toMatchObject({ start: 'top bottom', end: 'top top', scrub: true });
  });

  it('FV2 without the layer no scrub is created', () => {
    const { el } = scene(false);
    firstVisit.setup(fakeContext('first-visit', el));
    expect(ScrollTrigger.getAll().some((trigger) => trigger.vars.scrub === true)).toBe(false);
  });
});
