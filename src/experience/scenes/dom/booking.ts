/**
 * Scene 10, the booking stage (phase 7 report, plan section 2; spec scene 10). Motivation: the
 * form arrives as the answer to the journey, once. At tiers 1 to 3 the form card rises once when
 * it enters (translate 24 px, 12 px on phones, with opacity, 600 ms `expo.out`: the `--dur-4`
 * token); a `focusin` inside the card or a `sefid:scroll-to` whose target is the block completes
 * the tween at once, so the form is never at opacity under 1 while it holds focus. A card
 * already on screen when the engine starts (a reload, a deep link) stays as the server drew it.
 * No idle loop: the mark beside the form is phase 8 (`[data-world-slot="booking-mark"]`). Tier 0
 * and reduced motion never reach `setup` (the engine returns before the scenes).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { DomScene } from '../types';

/** Dispatched on `document` by `bookingRoute.ts` with `detail.target` (the engine's event name). */
const SCROLL_TO = 'sefid:scroll-to';
/** `--dur-4`, in seconds. */
const RISE_S = 0.6;
/** The card enters once its top crosses this line of the viewport. */
const ENTER = 'top 85%';
const PHONE_MAX_PX = 743;

/** 24 px from the tablet width up, 12 px on phones (spec: phones get 12 px distances). */
export function riseDistance(viewportWidth: number): number {
  return viewportWidth <= PHONE_MAX_PX ? 12 : 24;
}

const scene: DomScene = {
  setup({ el }) {
    const card = el.querySelector<HTMLElement>('[data-booking-card]');
    if (card === null) return;
    // Already on screen: nothing enters, nothing moves.
    if (card.getBoundingClientRect().top < window.innerHeight) return;
    // In the engine's context: its revert restores the card's styles and kills the trigger.
    const rise = gsap.fromTo(
      card,
      { y: riseDistance(window.innerWidth), opacity: 0 },
      { y: 0, opacity: 1, duration: RISE_S, ease: 'expo.out', paused: true },
    );
    const trigger = ScrollTrigger.create({
      trigger: card,
      start: ENTER,
      once: true,
      onEnter: () => {
        rise.play();
      },
    });
    const finish = (): void => {
      trigger.kill();
      rise.progress(1);
    };
    const onScrollTo = (event: Event): void => {
      const target: unknown = (event as CustomEvent<{ target?: unknown }>).detail?.target;
      if (target instanceof Node && card.contains(target)) finish();
    };
    card.addEventListener('focusin', finish);
    // Capture: the rise ends before the engine's own listener (registered earlier, bubble) reads
    // the target's place, or the scroll lands short by the rise's offset.
    document.addEventListener(SCROLL_TO, onScrollTo, true);
    return () => {
      card.removeEventListener('focusin', finish);
      document.removeEventListener(SCROLL_TO, onScrollTo, true);
    };
  },
};

export default scene;
