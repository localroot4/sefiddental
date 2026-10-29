/**
 * Scene 4, the restoration levels (phase 7 report D16, C18; lane RESTORATION). Motivation: the
 * three levels are the signature differentiator; one molar changing state under the reader's
 * scroll makes the difference visible before the words.
 *
 * Tier 1 at every width, and tiers 2 and 3 under 1024 px: the tap control; `data-motion` on the
 * molar slot turns on the CSS crossfade (opacity) and scale (transform) of `MolarStepper.tsx`
 * in `--dur-4`; tier 0 and reduced motion run no scene and keep the instant switch. Under 1024 px
 * (phone spec scene 4) the molar slot also settles and the chip row and the shown panel rise as
 * they enter (phone.ts Settle and Rise, one trigger each); the scroll never checks a step there.
 * Tiers 2 and 3 from 1024 px: the section is pinned for one viewport; the pin's scrub timeline
 * crossfades the layers at the thirds, and crossing a third checks that step's radio
 * programmatically with a script `change` (untrusted: no `tier_select`; choices.ts moves the
 * group's `data-choice`, D21; one write per step, never per frame: the panel switch is a layout,
 * D12), so the CSS panel and its CTA follow the scroll. Leaving the pin upwards clears the check
 * (F24 stands outside the pin). A user choice (tap, arrow keys: a trusted `change`, which
 * HomeBookingPrefill reports as `tier_select`) scrolls to the middle of that step's third, so
 * scroll and choice never disagree; the chips stay in view because the section is pinned. A chip
 * checked before the engine (a tap before its chunk, a relatch from tier 1) keeps its layer until
 * the scroll enters the pin; a chip the reader chose survives the engine, a chip the scroll
 * checked does not.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { DomScene } from '../types';

import { phoneMotion } from './phone';

const RADIOS = 'input[name="home-tier"]';
const WIDE = '(min-width: 1024px)';
/** Inactive layer scale (a transform). */
const SCALE_OUT = 0.94;
/** Width of one crossfade in pin progress, centred on the third it crosses. */
const FADE = 0.12;
/** How long a user choice owns the chip: longer than any smooth scroll of at most one viewport. */
export const LOCK_MS = 1500;

/** The step (0-based) the pin progress selects: equal thirds, clamped. */
export function stepAt(progress: number, steps: number): number {
  return Math.min(steps - 1, Math.max(0, Math.floor(progress * steps)));
}

/** The scroll position in the middle of a step's third of the pin. */
export function stepScrollY(start: number, end: number, step: number, steps: number): number {
  return start + ((end - start) * (step + 0.5)) / steps;
}

/**
 * Checks the radio of `step` (none for -1), then dispatches one script `change` so choices.ts
 * moves `data-choice` (D21). It is untrusted, so HomeBookingPrefill sends no `tier_select` and
 * `setup` takes it for no choice: scroll is not a choice.
 */
export function selectStep(radios: readonly HTMLInputElement[], step: number): void {
  radios.forEach((radio, i) => {
    radio.checked = i === step;
  });
  (radios[step] ?? radios[0])?.dispatchEvent(new Event('change', { bubbles: true }));
}

/** A user choice on its way to its step. */
export interface Lock {
  step: number;
  direction: number;
  /** `performance.now()` after which the lock is void. */
  until: number;
}

/**
 * Whether the choice still owns the chip at `now`: the thirds passed in its direction do not
 * flip the chip until it arrives, the scroll turns, or the lock's time is up (Lenis drops a
 * programmatic scroll on wheel input, so a lock cannot wait for its step).
 */
export function lockHolds(
  lock: Lock | null,
  step: number,
  direction: number,
  now: number,
): boolean {
  return lock !== null && now < lock.until && step !== lock.step && direction === lock.direction;
}

const navHeight = (): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;

interface Pinned {
  trigger: ScrollTrigger;
  radios: HTMLInputElement[];
  steps: number;
  /** The checked step while the engine lives (scroll or choice); -1 for none. */
  current: number;
  /** `current` is the reader's own choice (a chip before the engine, a `change`), not the scroll's. */
  chosen: boolean;
  /** The inline base shows a chip checked before the engine; the first scroll inside the pin takes over. */
  seeded: boolean;
  /** A user choice on its way: the thirds passed until it arrives do not change the chip. */
  pending: Lock | null;
}

/** Set by `pin`, read by `setup` of the same engine (pins run first, in document order). */
let pinned: Pinned | null = null;

const scene: DomScene = {
  pin({ el, conditions }) {
    const stage = el.querySelector<HTMLElement>(':scope > section');
    const [first, ...rest] = Array.from(el.querySelectorAll<SVGSVGElement>('[data-level]'));
    const radios = Array.from(el.querySelectorAll<HTMLInputElement>(RADIOS));
    if (!stage || !first || rest.length === 0 || radios.length === 0) return;
    const layers = [first, ...rest];
    const steps = Math.min(layers.length, radios.length);
    const checked = radios.findIndex((radio) => radio.checked);

    // The base state the CSS gave the page (the checked chip's layer, else the plain one), written
    // inline so the scrub owns the layers. Explicit from values (no immediate render): a deep link
    // into the pin and a refresh mid-pin render the same state as a scroll from above.
    const base = (step: number): void =>
      layers.forEach((layer, i) =>
        gsap.set(layer, i === step ? { opacity: 1, scale: 1 } : { opacity: 0, scale: SCALE_OUT }),
      );
    base(Math.max(0, checked));
    const timeline = gsap.timeline({
      defaults: { ease: 'none', duration: FADE, immediateRender: false },
    });
    // The spine keeps the timeline at duration 1, so a third of the pin is a third of the scrub.
    timeline.to({}, { duration: 1 }, 0);
    for (let i = 1; i < steps; i += 1) {
      const at = i / steps - FADE / 2;
      const out = layers[i - 1] ?? first;
      const into = layers[i] ?? first;
      timeline.fromTo(out, { opacity: 1, scale: 1 }, { opacity: 0, scale: SCALE_OUT }, at);
      timeline.fromTo(into, { opacity: 0, scale: SCALE_OUT }, { opacity: 1, scale: 1 }, at);
    }

    // The pin exists from 1024 px only. Chromium fires the scroll a resize's reflow causes (scroll
    // anchoring) before the media query change that reverts it: that scroll moves no step.
    const wide = window.matchMedia(WIDE);
    const follow = (self: ScrollTrigger): void => {
      const state = pinned;
      if (state === null || !self.isActive || !wide.matches) return;
      if (state.seeded) {
        // The scroll owns the layers from here: the chip's layer gives way to the scrub's state
        // at this progress (the tweens it reached are rendered again, the rest show the base).
        state.seeded = false;
        base(0);
        timeline.render(timeline.time(), true, true);
      }
      const step = stepAt(self.progress, steps);
      if (lockHolds(state.pending, step, self.direction, performance.now())) return;
      state.pending = null;
      if (step === state.current) return;
      state.current = step;
      state.chosen = false;
      selectStep(radios, step);
    };
    const leave = (): void => {
      if (pinned) pinned.pending = null;
    };
    const trigger = ScrollTrigger.create({
      trigger: stage,
      pin: stage,
      start: () => `top ${navHeight()}px`,
      end: () => `+=${window.innerHeight}`,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      scrub: conditions.fine ? true : 0.6,
      animation: timeline,
      onUpdate: follow,
      onRefresh: follow,
      onLeave: leave,
      onLeaveBack() {
        leave();
        const state = pinned;
        if (state === null || state.current === -1) return;
        state.current = -1;
        state.chosen = false;
        selectStep(radios, -1);
      },
    });
    pinned = {
      trigger,
      radios,
      steps,
      current: checked,
      chosen: checked !== -1,
      seeded: checked > 0,
      pending: null,
    };
  },

  setup({ el, engine, conditions }) {
    const slot = el.querySelector<HTMLElement>('[data-world-slot="molar"]');
    const state = pinned;
    if (state === null) {
      slot?.setAttribute('data-motion', '');
      // The hidden panels have an empty rect, so phone.ts's guard gives them no entrance.
      const off = conditions.wide
        ? null
        : phoneMotion({
            settle: slot === null ? [] : [slot],
            rise: el.querySelectorAll('fieldset, [data-tier-panel]'),
          });
      return () => {
        off?.();
        slot?.removeAttribute('data-motion');
      };
    }
    const onChange = (event: Event): void => {
      const index = state.radios.indexOf(event.target as HTMLInputElement);
      if (index === -1 || !event.isTrusted) return;
      state.current = index;
      state.chosen = true;
      const y = stepScrollY(state.trigger.start, state.trigger.end, index, state.steps);
      state.pending = {
        step: index,
        direction: y < window.scrollY ? -1 : 1,
        until: performance.now() + LOCK_MS,
      };
      // A keyboard choice scrolls at once: an animated Lenis scroll still running at the next Tab
      // overwrote the browser's own focus scroll, which left the focus off screen.
      engine.scrollTo(y, { immediate: state.radios[index]?.matches(':focus-visible') === true });
    };
    el.addEventListener('change', onChange);
    return () => {
      el.removeEventListener('change', onChange);
      // No pin after this engine: F24 (no step preselected) stands again; a chosen chip stays.
      if (state.current !== -1 && !state.chosen) selectStep(state.radios, -1);
      pinned = null;
    };
  },
};

export default scene;
