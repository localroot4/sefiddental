/**
 * Entrance shared by scenes 6 to 9 (phase 7 report, plan section 2). From 1024 px the targets
 * rise 16 px by transform and opacity once, when `trigger` reaches 80 % of the viewport, by line
 * (one target per line or card, never per letter), in `--dur-3`. Under 1024 px (phone spec 2.1)
 * they are scrubbed instead, one trigger per target through `phoneMotion`: Rise, or Slide with
 * `axis` 'x' (pass the row's scroll container, never its cards). The tweens and their
 * ScrollTriggers live in the engine's matchMedia context, which reverts their inline styles; the
 * returned cleanup removes the listeners this adds.
 */
import { gsap } from 'gsap';

import { phoneMotion } from './phone';

/** `--dur-3` (320 ms), the reveal token; the engine never runs under reduced motion. */
const DURATION_S = 0.32;
const STAGGER_S = 0.06;

export function reveal(
  targets: ArrayLike<Element>,
  trigger: Element,
  wide: boolean,
  axis: 'y' | 'x' = 'y',
): () => void {
  if (targets.length === 0) return () => {};
  if (!wide) return phoneMotion(axis === 'x' ? { slide: targets } : { rise: targets });
  // An entrance already behind the reader (a reload with scroll restoration, a deep link, a
  // relatch while reading) is not played: the server state stays and nothing blinks. One read,
  // before this scene's write.
  if (trigger.getBoundingClientRect().top < window.innerHeight * 0.8) return () => {};
  const tween = gsap.from(Array.from(targets), {
    y: 16,
    opacity: 0,
    duration: DURATION_S,
    ease: 'expo.out',
    stagger: STAGGER_S,
    scrollTrigger: { trigger, start: 'top 80%', once: true },
  });
  // A focus inside (Tab, a deep link to a control) shows the targets at once: a focused control
  // is never at opacity 0, whatever the scroll position.
  const onFocus = (): void => {
    tween.progress(1);
  };
  trigger.addEventListener('focusin', onFocus);
  return () => trigger.removeEventListener('focusin', onFocus);
}
