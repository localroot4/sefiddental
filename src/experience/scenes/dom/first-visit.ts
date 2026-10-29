/**
 * Scene 9, first visit and FAQ: the light turns warm (phase 7 report, plan section 2; D12).
 * One fixed layer (`WarmLayer`, rendered before the journey section) reads `--warm` as its
 * opacity. The layer sits under every section and the journey is the only transparent one after
 * it (the FAQ, booking and the footer paint their own surface), so the tint shows through the
 * journey and, from phase 8, the world slots. `--warm` therefore scrubs 0 to 1 across the
 * journey's entrance (its top from the viewport bottom to the viewport top), on that one element,
 * and holds 1 from there through booking and the footer. Not a child of the master across the
 * `first-visit` segment: that segment starts when the wrapper's top reaches the viewport top, so
 * the child would read 0.5 as the journey's last row leaves the top, and no surface would ever
 * show the change (independent review, CR2). The journey's steps rise once by line from
 * 1024 px; under it each step scrubs its own Rise (phone spec scene 9, `reveal`'s phone branch).
 * The layer carries `data-scrub` (D25): when the engine starts or goes, its opacity eases with
 * the settle window instead of jumping. Tier 0 and reduced motion never run this module, so the
 * layer stays at 0. Motivation: the light turns warm as the journey reaches the clinic's care,
 * the storyboard's one color change.
 */
import { gsap } from 'gsap';

import type { DomScene } from '../types';

import { reveal } from './reveal';

const scene: DomScene = {
  setup(ctx) {
    const journey = ctx.el.querySelector<HTMLElement>('[data-home-section="journey"]');
    const steps = journey?.querySelectorAll('ol > li') ?? [];
    const cleanups = [reveal(steps, steps[0]?.parentElement ?? ctx.el, ctx.conditions.wide)];
    const layer = ctx.el.querySelector<HTMLElement>('[data-warm-layer]');
    if (layer && journey) {
      layer.setAttribute('data-scrub', '');
      gsap.fromTo(
        layer,
        { '--warm': 0 },
        {
          '--warm': 1,
          ease: 'none',
          scrollTrigger: { trigger: journey, start: 'top bottom', end: 'top top', scrub: true },
        },
      );
      // The context revert restores the inline style too; this is the proof T-EN3 reads.
      cleanups.push(() => layer.style.removeProperty('--warm'));
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  },
};
export default scene;
