/**
 * Scene 1, the hero exit (phase 7 report D11, D18). Motivation: the photo lags at 0.85x while
 * the scrim, the card and the band leave at 1x, so the wrapper's bottom edge crops it and it
 * gains weight against them; the strip the lag opens at the wrapper's top stays under the sticky
 * header, so nothing is uncovered here: the world window is the trust band (D18). From 1024 px
 * at tiers 1 to 3 only (`settings.heroExitParallax`): one child of the master at the hero's
 * label moves the photo layer by `0.15 * heroHeight` over the hero's own segment, so
 * `translateY = 0.15 * scroll` counted from the hero's top (72 px under the header) to its
 * bottom (the engine spans the child over the segment and re-reads the height on every refresh
 * through the master's `invalidateOnRefresh`); past the bottom the offset holds. The section
 * itself never moves: it is the render gate's cover. Tier 0 gets nothing here; the settle after
 * the intro is CSS in HomeHero.tsx. Under 1024 px (phone spec scene 1, D24) the scrim and the card
 * hold still next to the form, and the 4:5 band's `<img>` drifts inside its layer (Drift in
 * phone.ts; the layer never moves and clips it, and the img's `scale: 1.1` is server CSS under
 * 744 px at every tier, so a late engine start does not pop it); from 744 px the drift is 0, where
 * the photo is full-bleed behind the form. The photo layer is promoted at setup and kept promoted
 * (`force3D`): with gsap's default the layer is 2D at progress 0 and 1, so its raster (1440 px
 * wide) landed in the first scrolled frame and again at the hero's bottom (A/B at 4x: a 33 to
 * 50 ms frame in the hero against 16.8 without the tween). The set and the tween live in the
 * engine's matchMedia context, so there is nothing to clean up beyond its revert.
 */
import { gsap } from 'gsap';

import { scrollCssActive } from '../../core/query';
import type { DomScene } from '../types';

import { phoneMotion } from './phone';

/** The photo's share of the scroll it stays behind: 1 - 0.85. */
export const HERO_EXIT_PARALLAX = 0.15;

const scene: DomScene = {
  setup({ el, master, label, conditions, settings }) {
    const photo = el.querySelector<HTMLElement>('[data-hero-photo]');
    if (photo === null) return;
    if (!conditions.wide) {
      const img = photo.querySelector('img');
      if (img === null) return;
      // The Drift A/B (phone spec 2.5): `?scrollcss=1` hands the drift to the CSS view timeline
      // in globals.css, which keys on this attribute.
      if (scrollCssActive(window.location.search)) {
        el.setAttribute('data-scroll-css', '');
        return () => el.removeAttribute('data-scroll-css');
      }
      return phoneMotion({ drift: { img, frame: photo } });
    }
    if (!settings.heroExitParallax) return;
    gsap.set(photo, { y: 0, force3D: true });
    master.to(
      photo,
      {
        y: () => HERO_EXIT_PARALLAX * el.getBoundingClientRect().height,
        ease: 'none',
        force3D: true,
      },
      label,
    );
  },
};
export default scene;
