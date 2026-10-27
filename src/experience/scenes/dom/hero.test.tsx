import { gsap } from 'gsap';
import { describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../../engine/scrollEngine';
import type { LayoutLatch } from '../../tier/latch';
import type { SceneContext } from '../types';

import hero, { HERO_EXIT_PARALLAX } from './hero';

const HERO_HEIGHT = 1200;

function context(overrides: {
  wide?: boolean;
  heroExitParallax?: boolean;
  photo?: boolean;
}): SceneContext & { photo: HTMLElement | null } {
  const el = document.createElement('section');
  el.dataset.scene = 'hero';
  if (overrides.photo !== false) el.innerHTML = '<div data-hero-photo=""></div>';
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ height: HERO_HEIGHT } as DOMRect);
  const master = gsap.timeline({ paused: true });
  master.addLabel('hero', 0);
  return {
    id: 'hero',
    el,
    photo: el.querySelector<HTMLElement>('[data-hero-photo]'),
    layout: { pinnedScenes: false, lenis: true, latchedAtTier: 1 } as LayoutLatch,
    settings: { heroExitParallax: overrides.heroExitParallax ?? true } as TierSettings,
    conditions: { reduce: false, fine: true, wide: overrides.wide ?? true },
    engine: {} as ScrollEngine,
    master,
    label: 'hero',
    segment: () => ({ start: 0, end: 0.4 }),
    nearViewport: () => () => {},
  };
}

describe('scene 1 hero exit (dom/hero.ts)', () => {
  it('HS1 wide and heroExitParallax: one child at the label moves the photo by 0.15 of the hero height; the section never moves', () => {
    const ctx = context({});
    expect(hero.setup(ctx)).toBeUndefined();
    const children = ctx.master.getChildren(false, true, false);
    expect(children).toHaveLength(1);
    expect(children[0]?.startTime()).toBe(0);
    expect((children[0] as gsap.core.Tween).targets()).toEqual([ctx.photo]);
    // Promoted from setup and at both ends (force3D): no layer raster inside a scrolled frame.
    expect(ctx.photo?.style.transform).toBe('translate3d(0px, 0px, 0px)');
    ctx.master.progress(1);
    expect(ctx.photo?.style.transform).toBe(
      `translate3d(0px, ${HERO_EXIT_PARALLAX * HERO_HEIGHT}px, 0px)`,
    );
    expect(ctx.el.style.transform).toBe('');
    ctx.master.kill();
  });

  it('HS2 under 1024 px or without heroExitParallax (tier 0) nothing is added', () => {
    for (const ctx of [context({ wide: false }), context({ heroExitParallax: false })]) {
      hero.setup(ctx);
      expect(ctx.master.getChildren(false, true, false)).toHaveLength(0);
      expect(ctx.photo?.style.transform ?? '').toBe('');
      ctx.master.kill();
    }
  });

  it('HS3 a hero without the photo hook adds nothing instead of throwing', () => {
    const ctx = context({ photo: false });
    expect(() => hero.setup(ctx)).not.toThrow();
    expect(ctx.master.getChildren(false, true, false)).toHaveLength(0);
    ctx.master.kill();
  });
});
