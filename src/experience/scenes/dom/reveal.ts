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

/** A calm reveal (owner, 2026-11-13: no snap); the engine never runs under reduced motion. */
const DURATION_S = 0.56;
const STAGGER_S = 0.06;
const CURTAIN_S = 0.9;
const CURTAIN_SCALE = 1.06;
/** A section heading rises half its font size out of its own bottom edge (a mask), in 0.7 s. */
const HEADING_S = 0.7;
const HEADING_RISE = 0.5;

export function reveal(
  targets: ArrayLike<Element>,
  trigger: Element,
  wide: boolean,
  axis: 'y' | 'x' = 'y',
  /** From 1024 px the targets' photos open with a curtain as they rise (owner 2026-11-18). */
  curtain = false,
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
    ease: 'power2.out',
    stagger: STAGGER_S,
    scrollTrigger: { trigger, start: 'top 80%', once: true },
  });
  // The photo rises out of its own frame's bottom edge and settles from 6 % larger, on the same
  // trigger (a clip and a transform: no layout moves); cleared at rest.
  const photos = curtain ? Array.from(targets).flatMap((t) => [...t.querySelectorAll('img')]) : [];
  const opening =
    photos.length > 0
      ? gsap.from(photos, {
          clipPath: 'inset(100% 0% 0% 0%)',
          scale: CURTAIN_SCALE,
          duration: CURTAIN_S,
          ease: 'power3.out',
          stagger: STAGGER_S,
          clearProps: 'clipPath,transform',
          scrollTrigger: { trigger, start: 'top 80%', once: true },
        })
      : null;
  // A focus inside (Tab, a deep link to a control) shows the targets at once: a focused control
  // is never at opacity 0, whatever the scroll position.
  const onFocus = (): void => {
    tween.progress(1);
    opening?.progress(1);
  };
  trigger.addEventListener('focusin', onFocus);
  return () => trigger.removeEventListener('focusin', onFocus);
}

/**
 * A section's heading from 1024 px (owner 2026-11-18: «the sections come in softly»): it rises
 * HEADING_RISE of its font size out of its own bottom edge, as from behind a mask (a clip that
 * moves with the rise, so the line shows only inside its own box), and fades in, once, when it
 * reaches 85 % of the viewport. Under 1024 px, already behind the reader or with nothing to
 * reveal: nothing. A focus in its section ends it at once.
 */
export function revealHeading(heading: HTMLElement | null, wide: boolean): () => void {
  if (heading === null || !wide) return () => {};
  if (heading.getBoundingClientRect().top < window.innerHeight * 0.85) return () => {};
  const d = Math.round((parseFloat(getComputedStyle(heading).fontSize) || 16) * HEADING_RISE);
  const tween = gsap.fromTo(
    heading,
    { y: d, opacity: 0, clipPath: `inset(0px 0px ${d}px 0px)` },
    {
      y: 0,
      opacity: 1,
      clipPath: 'inset(0px 0px 0px 0px)',
      duration: HEADING_S,
      ease: 'power3.out',
      immediateRender: true,
      clearProps: 'clipPath',
      scrollTrigger: { trigger: heading, start: 'top 85%', once: true },
    },
  );
  const scope = heading.closest('section') ?? heading;
  const onFocus = (): void => {
    tween.progress(1);
  };
  scope.addEventListener('focusin', onFocus);
  return () => scope.removeEventListener('focusin', onFocus);
}
