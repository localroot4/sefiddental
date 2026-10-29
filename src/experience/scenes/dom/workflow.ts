/**
 * Scene 5, the digital workflow (phase 7 report D2 and D7; lanes WORKFLOW). Motivation: the four
 * beats of the digital method follow one diagonal line, so the reader feels the sequence instead
 * of reading a list; the step at the stage centre is the one being read, the others recede
 * (opacity and scale) so one beat is in focus at a time; the light warms from the cold scan to
 * the finished smile (one overlay per photo, opacity only), so the sequence reads as a progression
 * toward the result; at tier 1 and on phones each step arrives once as the reader reaches it,
 * so the list reads as beats, not as a wall of four cards.
 *
 * Pinned diagonal (tiers 2 and 3 from 1024 px, when the layout pins): `pin` marks the stage
 * `data-diagonal` (the section's CSS places the steps along the diagonal), pins it +200 vh and
 * scrubs one timeline on the pin trigger (D8): the path pans 0.9 x 1.2 stage sizes, so step i
 * sits at the centre at progress i/3. Transform and opacity only, no `will-change` (the pan and
 * the scales composite on their own). From 1024 px without a pin (tier 1) one
 * IntersectionObserver adds `.in` to a step the first time its top crosses 88% of the viewport,
 * from either direction (a deep link below the scene reaches it scrolling up), and its first
 * delivery also marks the stage `data-reveal`: the observer reports every step once at that
 * delivery, so a step already on screen (a reload that restores the scroll onto the scene, a
 * relatch inside it) gets `.in` in the same task as the attribute that would hide it, and never
 * shows a hidden frame. The cleanup removes both attributes and every `.in`; the timeline and its
 * trigger revert with the context.
 *
 * Under 1024 px (phone spec scene 5) the phone scroll set replaces the observer: a Rise on each
 * title and each line (one trigger each), the Fill of the timeline line over the list, and each
 * photo's warm overlay (`data-scrub`) scrubbed to its share of WARM_MAX while the photo's top
 * moves from 80 % to 40 % of the viewport. The photos never move (no Drift).
 */
import { gsap } from 'gsap';

import type { DomScene } from '../types';

import { phoneMotion, PHONE_MOTION } from './phone';

const STAGE = '[data-workflow-stage]';
const PATH = '[data-workflow-path]';
const STEP = '[data-workflow-step]';
const WARM = '[data-workflow-warm]';
const LINE = '[data-workflow-line]';

/** Share of the stage size the path pans across the pin (RTL: toward the end corner, upward). */
const PAN = { x: 0.9, y: -1.2 };
/** Each step comes into focus over 0.2 of the pin before its centre time, and recedes 0.08 after. */
const FOCUS = { in: 0.2, hold: 0.08, out: 0.12 };
/** Warm overlay opacity of the last step; the first (the scan) stays cold. */
const WARM_MAX = 0.36;
/** Phones: a photo warms while its top moves from 80 % to 40 % of the viewport. */
const WARM_RANGE = { start: 'clamp(top 80%)', end: 'clamp(top 40%)' };

/** The `--nav-h` token in pixels: the pinned stage sits under the sticky header. */
const navHeight = (): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;

/** The phone scroll set of the vertical list; the returned cleanup drops its focus listeners. */
function phoneSteps(el: HTMLElement, steps: HTMLElement[]): () => void {
  const path = el.querySelector(PATH);
  const line = el.querySelector(LINE);
  const off = phoneMotion({
    rise: steps.flatMap((step) => Array.from(step.querySelectorAll('h3, h3 + p'))),
    fill: path && line ? [{ line, list: path }] : [],
  });
  const scrub = window.matchMedia('(pointer: fine)').matches ? true : PHONE_MOTION.lagS;
  const last = steps.length - 1;
  steps.forEach((step, i) => {
    const warm = step.querySelector<HTMLElement>(WARM);
    if (i === 0 || !warm?.parentElement) return;
    warm.setAttribute('data-scrub', '');
    gsap.fromTo(
      warm,
      { opacity: 0 },
      {
        opacity: (WARM_MAX * i) / last,
        ease: 'none',
        scrollTrigger: { trigger: warm.parentElement, ...WARM_RANGE, scrub },
      },
    );
  });
  return off;
}

const scene: DomScene = {
  pin({ el }) {
    const stage = el.querySelector<HTMLElement>(STAGE);
    const path = el.querySelector<HTMLElement>(PATH);
    const steps = Array.from(el.querySelectorAll<HTMLElement>(STEP));
    if (!stage || !path || steps.length === 0) return;
    stage.setAttribute('data-diagonal', '');
    const last = steps.length - 1;
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        pin: true,
        start: () => `top ${navHeight()}px`,
        end: '+=200%',
        scrub: true,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
      defaults: { ease: 'none' },
    });
    tl.to(
      path,
      { x: () => PAN.x * stage.clientWidth, y: () => PAN.y * stage.clientHeight, duration: 1 },
      0,
    );
    steps.forEach((step, i) => {
      const at = i / last;
      if (i > 0) {
        tl.fromTo(
          step,
          { opacity: 0.15, scale: 0.94 },
          { opacity: 1, scale: 1, duration: FOCUS.in },
          at - FOCUS.in,
        );
        const warm = step.querySelector<HTMLElement>(WARM);
        if (warm)
          tl.to(warm, { opacity: (WARM_MAX * i) / last, duration: FOCUS.in }, at - FOCUS.in);
      }
      if (i < last) {
        tl.to(step, { opacity: 0.3, scale: 0.96, duration: FOCUS.out }, at + FOCUS.hold);
      }
    });
  },

  setup({ el, conditions }) {
    const stage = el.querySelector<HTMLElement>(STAGE);
    if (!stage) return;
    const steps = Array.from(el.querySelectorAll<HTMLElement>(STEP));
    if (stage.hasAttribute('data-diagonal')) {
      const scrubbed = [
        el.querySelector(PATH),
        ...steps,
        ...steps.map((step) => step.querySelector(WARM)),
      ].filter((node) => node !== null);
      return () => {
        stage.removeAttribute('data-diagonal');
        // The context revert leaves the pinned path and steps at the transforms each refresh
        // re-recorded as their originals (with the diagonal's translate folded in, as services'
        // track); the tier-0 markup has no inline style (CSP), so all of it goes.
        gsap.set(scrubbed, { clearProps: 'all' });
      };
    }
    if (!conditions.wide) return phoneSteps(el, steps);
    const observer = new IntersectionObserver(
      (entries) => {
        stage.setAttribute('data-reveal', '');
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    for (const step of steps) observer.observe(step);
    return () => {
      observer.disconnect();
      stage.removeAttribute('data-reveal');
      for (const step of steps) step.classList.remove('in');
    };
  },
};

export default scene;
