/**
 * The scroll range of a pinned stage (phase 7 F2, F3). The stage is sticky under the nav from
 * the CSS of `html[data-pins]`, with its room (`PinRoom`, the stage's next sibling) as the scroll
 * distance, so the pinned geometry exists before the engine: the browser restores a reload and
 * places an anchor in it, and the engine inserts no spacer that would move the page. A scene
 * scrubs over this range instead of pinning.
 */
import type { ScrollTrigger } from 'gsap/ScrollTrigger';

/** The `--nav-h` token in pixels, read on every refresh. */
const navHeight = (): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 0;

/**
 * From the stage's top under the nav through the room's height; null without a room. Measured on
 * the room, which never sticks: a single trigger's refresh reads at the current scroll, where a
 * stuck stage reads its stuck place.
 */
export function pinRange(
  stage: HTMLElement,
): Pick<ScrollTrigger.Vars, 'trigger' | 'start' | 'end' | 'invalidateOnRefresh'> | null {
  const room = stage.nextElementSibling;
  if (!(room instanceof HTMLElement) || !room.hasAttribute('data-pin-room')) return null;
  return {
    trigger: room,
    start: () => `top ${navHeight() + stage.offsetHeight}px`,
    end: () => `+=${room.offsetHeight}`,
    invalidateOnRefresh: true,
  };
}
