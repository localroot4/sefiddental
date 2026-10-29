/**
 * The phone scroll set (phone spec section 2.1; report D21, D22, D24, D25): every primitive is a
 * ScrollTrigger scrub on native scroll under 1024 px, transform and opacity only, created in a
 * scene's `setup` inside the engine's matchMedia context, whose revert removes every trigger and
 * inline style. A scene makes one `phoneMotion` call, which reads every guard rect before its
 * first gsap write.
 *
 * - Rise: a text block or a card in a column, one trigger each: y and opacity.
 * - Slide: a snap row's scroll container, never its cards (their snap positions stay): x and
 *   opacity. The offset is on the inline-start side (RTL: +x), the side the page cannot scroll
 *   to, so no horizontal overflow appears and the row moves in the reading direction.
 * - Settle: one visual: scale and opacity.
 * - Fill: a progress line along a list: scaleY from its top.
 * - Drift: the one photo its frame clips: y over the frame's pass through the viewport, a
 *   function value re-read on every refresh, 0 from 744 px.
 *
 * Entrances (Rise, Slide, Settle) start when the target's top reaches the bar top (the sticky
 * bar's top edge, re-read on every refresh), so the whole motion happens in the visible band above
 * the bar and ends at the reading line. A target whose range has started when its scene sets up
 * (its top above the bar top) gets none: nothing on screen dims at creation (rule 2.2-5). A focus
 * inside an entrance ends its scrub at the rest state: a focused control is never transparent
 * (rule 2.2-6). Every scrub uses `ease: 'none'` and clamped ranges. Every target carries
 * `data-scrub` for the settle rule (D25); the marker outlives the revert on purpose, inert without
 * `[data-settling]`, so the targets ease back to rest while the engine is torn down.
 */
import { gsap } from 'gsap';

/** Distances, ranges and values; the step 4b owner check changes only these. [guess: all] */
export const PHONE_MOTION = {
  /** `--dur-3`: the scrub lag on coarse pointers (`true` where Lenis smooths a fine pointer). */
  lagS: 0.32,
  rise: { y: 12, end: 'top 80%' },
  /** The phone gutter: a larger offset started the first card past the screen edge. */
  slide: { x: 16, end: 'top 75%' },
  settle: { scale: 0.94, opacity: 0.6, end: 'top 60%' },
  fill: { start: 'top 60%', end: 'bottom 60%' },
  /**
   * A share of the frame height each way; none from `until`, where the photo is full-bleed. The
   * `md` breakpoint of globals.css in its own unit: the server CSS drops the 1.1 overscale there,
   * and a px query would part from it when the default font size is not 16 px.
   */
  drift: { share: 0.04, until: '(min-width: 46.5rem)' },
} as const;

export interface PhoneTargets {
  rise?: ArrayLike<Element>;
  slide?: ArrayLike<Element>;
  settle?: ArrayLike<Element>;
  fill?: ReadonlyArray<{ line: Element; list: Element }>;
  /** At most one per page (rule 2.2-2): it is the only target promoted with `force3D`. */
  drift?: { img: Element; frame: Element };
}

/**
 * The sticky bar's height, its safe area included; 0 where it is not rendered. It ignores
 * `data-hidden`: the bar hides only over the booking block and the footer, which have no
 * scrubbed entrance, and a refresh there must not move every start down.
 */
export const barPx = (): number =>
  document.querySelector<HTMLElement>('[data-sticky-bar]')?.offsetHeight ?? 0;

const fromBar = (): string => `clamp(top bottom-=${barPx()})`;

export function phoneMotion(targets: PhoneTargets): () => void {
  const { lagS, rise, slide, settle, fill, drift } = PHONE_MOTION;
  // Every read first (rule 2.1): the bar, the pointer, the guard rects and the directions.
  const barTop = window.innerHeight - barPx();
  const scrub = window.matchMedia('(pointer: fine)').matches ? true : lagS;
  const ahead = (list: ArrayLike<Element> | undefined): Element[] =>
    Array.from(list ?? []).filter((el) => el.getBoundingClientRect().top >= barTop);
  const rises = ahead(targets.rise);
  const slides = ahead(targets.slide).map((el) => ({
    el,
    rtl: getComputedStyle(el).direction === 'rtl',
  }));
  const settles = ahead(targets.settle);

  const offs: (() => void)[] = [];
  const entrance = (el: Element, from: gsap.TweenVars, to: gsap.TweenVars, end: string): void => {
    el.setAttribute('data-scrub', '');
    const tween = gsap.fromTo(el, from, {
      ...to,
      ease: 'none',
      scrollTrigger: { trigger: el, start: fromBar, end: `clamp(${end})`, scrub },
    });
    // `progress(1)` alone is not enough: the trigger and its lag tween would scrub it back.
    const onFocus = (): void => {
      const trigger = tween.scrollTrigger;
      if (!trigger) return;
      trigger.getTween()?.kill();
      trigger.kill(false, true);
      tween.progress(1);
    };
    el.addEventListener('focusin', onFocus);
    offs.push(() => el.removeEventListener('focusin', onFocus));
  };

  for (const el of rises) {
    entrance(el, { y: rise.y, opacity: 0 }, { y: 0, opacity: 1 }, rise.end);
  }
  for (const { el, rtl } of slides) {
    entrance(el, { x: rtl ? slide.x : -slide.x, opacity: 0 }, { x: 0, opacity: 1 }, slide.end);
  }
  for (const el of settles) {
    entrance(
      el,
      { scale: settle.scale, opacity: settle.opacity },
      { scale: 1, opacity: 1 },
      settle.end,
    );
  }
  for (const { line, list } of targets.fill ?? []) {
    line.setAttribute('data-scrub', '');
    gsap.fromTo(
      line,
      { scaleY: 0, transformOrigin: '50% 0%' },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: list,
          start: `clamp(${fill.start})`,
          end: `clamp(${fill.end})`,
          scrub,
        },
      },
    );
  }
  if (targets.drift) {
    const { img, frame } = targets.drift;
    const shift = (): number =>
      window.matchMedia(drift.until).matches
        ? 0
        : drift.share * frame.getBoundingClientRect().height;
    img.setAttribute('data-scrub', '');
    gsap.fromTo(
      img,
      { y: () => -shift() },
      {
        y: () => shift(),
        ease: 'none',
        force3D: true,
        scrollTrigger: {
          trigger: frame,
          start: 'clamp(top bottom)',
          end: 'clamp(bottom top)',
          scrub,
          invalidateOnRefresh: true,
        },
      },
    );
  }
  return () => {
    for (const off of offs) off();
  };
}
