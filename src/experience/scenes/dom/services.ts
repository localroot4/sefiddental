/**
 * Scene 3, services (phase 7 report D6, D7, D8, D12; spec scene 3; lane SERVICES).
 * Motivation: five worlds pass the reader in reading direction while the mark becomes each
 * category's icon, so the catalogue reads as one journey instead of a grid.
 *
 * - From 1024 px where the layout pins (tiers 2 and 3): the section's CSS follows
 *   `html[data-pins]` (the latch writes it before the first paint), which turns the bento into one
 *   horizontal track and makes the stage sticky under the nav through its room (+200 vh, D7);
 *   `pin` slides the track by its overflow width over that range (positive x: the worlds overflow
 *   to the left in RTL), scrubbed by its own ScrollTrigger (D8). The MorphSVG chunk loads through
 *   `nearViewport` and morphs the mark's silhouette through the five icon outlines while each
 *   icon's ink outline crossfades in by opacity (the `d` write is this scene's D12 exception). A
 *   keyboard focus in the track scrolls the page to the pin position that shows the focused world.
 * - From 1024 px without a pin (tier 1): the bento stays still. A line reveal cost 3 fps at 4x
 *   (56 against 59) and the section budget is 59, so the plan's tier-1 reveal is dropped.
 * - Under 1024 px (every tier, D6): the native snap row; a keyboard focus centres the focused
 *   world in the row (chrome/snapFocus.ts); the bar under it follows the card in view through an IntersectionObserver
 *   (`scaleX` through `applyStyle`). The row's scroll container slides in the reading direction
 *   as it enters and the mark above it settles (phone spec scene 3, phone.ts Slide and Settle);
 *   the cards, their snap positions and the row's `scrollLeft` never move with the page scroll.
 * - Tier 0 and reduced motion never reach this module: the engine does not run.
 */
import { gsap } from 'gsap';

import { applyStyle } from '../../core/applyStyle';
import type { DomScene, SceneContext } from '../types';

import { phoneMotion } from './phone';
import { pinRange } from './pinRoom';

/** A card counts as the one in view from this share of it inside the row. */
const IN_VIEW = 0.6;

/** How far the track slides: its overflow past the rail, never negative (RTL: a positive x). */
export const trackDistance = (trackWidth: number, railWidth: number): number =>
  Math.max(0, trackWidth - railWidth);

/** Pin progress at which the mark starts morphing into world `i` of `n`: max(0, i/(n-1) - 0.1). */
export const morphAt = (i: number, n: number): number => Math.max(0, i / Math.max(1, n - 1) - 0.1);

/** The morph chunk loads only where the track pins: wide, a pinned layout, motion not reduced. */
export const wantsMorph = (c: { wide: boolean; pinned: boolean; reduce: boolean }): boolean =>
  c.wide && c.pinned && !c.reduce;

/** The scrollY inside a pin from `start` to `end` that shows world `i` of `n`. */
export const worldScrollY = (start: number, end: number, i: number, n: number): number =>
  start + ((end - start) * i) / Math.max(1, n - 1);

/** The accents of the worlds in track order (`data-worlds`, written by ServicesSection). */
export const worldAccents = (track: HTMLElement): string[] =>
  (track.getAttribute('data-worlds') ?? '').split(' ').filter(Boolean);

interface Parts {
  stage: HTMLElement;
  rail: HTMLElement;
  track: HTMLElement;
  worlds: HTMLElement[];
  /** The morphing silhouette. */
  mark: SVGPathElement | null;
  /** One ink outline per world, siblings of the mark's svg. */
  outlines: SVGSVGElement[];
  bar: HTMLElement | null;
  fill: HTMLElement | null;
}

function parts(el: HTMLElement): Parts | null {
  const stage = el.querySelector<HTMLElement>('[data-stage]');
  const rail = el.querySelector<HTMLElement>('[data-rail]');
  const track = el.querySelector<HTMLElement>('[data-track]');
  if (stage === null || rail === null || track === null) return null;
  const svgs = Array.from(el.querySelectorAll<SVGSVGElement>('[data-mark] svg'));
  return {
    stage,
    rail,
    track,
    worlds: Array.from(track.children).filter((c): c is HTMLElement => c instanceof HTMLElement),
    mark: svgs[0]?.querySelector('path') ?? null,
    outlines: svgs.slice(1),
    bar: el.querySelector<HTMLElement>('[data-progress]'),
    fill: el.querySelector<HTMLElement>('[data-progress] > *'),
  };
}

/** The pin's timeline per scene element, from `pin` to `setup` of the same engine. */
const pins = new WeakMap<HTMLElement, gsap.core.Timeline>();

const scene: DomScene = {
  pin({ el, layout, conditions }) {
    const p = parts(el);
    const range = p && pinRange(p.stage);
    if (p === null || range === null) return;
    const t0 = performance.now();
    const dist = (): number =>
      trackDistance(p.track.getBoundingClientRect().width, p.rail.clientWidth);
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        ...range,
        // Lenis already smooths the wheel on fine pointers; a scrub lag on top would double it.
        scrub: layout.lenis && conditions.fine ? true : 0.6,
      },
    });
    // Explicit ends, so a refresh mid-pin re-reads the distance and never the current x.
    tl.fromTo(p.track, { x: 0 }, { x: dist, duration: 1, immediateRender: false }, 0);
    pins.set(el, tl);
    performance.measure('sefid:services-pin', { start: t0 });
  },

  setup(ctx: SceneContext) {
    const p = parts(ctx.el);
    if (p === null) return;
    const tl = pins.get(ctx.el) ?? null;
    const cleanups: (() => void)[] = [];
    const n = p.worlds.length;
    const { wide, reduce } = ctx.conditions;

    if (tl !== null) {
      // Rule B4: a link in an off-screen world scrolls nothing in a clipped rail: the page moves
      // to the pin position that shows the world. Keyboard focus only: a mousedown's focus must
      // not move the world under the pointer before the click completes. The unpinned snap row
      // is centred by the chrome (chrome/snapFocus.ts), at every tier.
      const onFocus = (event: FocusEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return;
        const i = p.worlds.findIndex((world) => world.contains(target));
        if (i < 0 || !tl.scrollTrigger) return;
        // Immediate: an animated Lenis scroll still running at the next Tab overwrote the
        // browser's own focus scroll, which left a fast Tab into restoration off screen.
        ctx.engine.scrollTo(worldScrollY(tl.scrollTrigger.start, tl.scrollTrigger.end, i, n), {
          immediate: true,
        });
      };
      p.track.addEventListener('focusin', onFocus);
      cleanups.push(() => p.track.removeEventListener('focusin', onFocus));
    }

    const mark = p.mark;
    if (wantsMorph({ wide, pinned: ctx.layout.pinnedScenes, reduce }) && tl !== null && mark) {
      let restore: (() => void) | null = null;
      let cancelled = false;
      const cancel = ctx.nearViewport(() => {
        import('./morph.lazy').then(
          (mod) => {
            if (cancelled) return;
            // The main-thread cost of the first morph (the chunk's own evaluation precedes it in
            // the same task); T-SV3 reads the long task around this measure.
            const t0 = performance.now();
            restore = mod.addMorphs(tl, mark, p.outlines, worldAccents(p.track));
            performance.measure('sefid:services-morph', { start: t0 });
          },
          (error: unknown) =>
            console.error('[experience] the services morph chunk failed; the mark stays.', error),
        );
      });
      cleanups.push(() => {
        cancelled = true;
        cancel();
        restore?.();
      });
    }

    if (!wide) {
      const markBox = ctx.el.querySelector('[data-mark]');
      cleanups.push(phoneMotion({ slide: [p.track], settle: markBox === null ? [] : [markBox] }));
    }

    if (!wide && p.bar !== null && p.fill !== null && n > 0) {
      const { bar, fill } = p;
      const show = (i: number): void => {
        applyStyle(fill, { transform: `scaleX(${(i + 1) / n})` });
        bar.setAttribute('aria-valuenow', String(i + 1));
      };
      show(0);
      applyStyle(bar, { opacity: '1' });
      bar.setAttribute('aria-hidden', 'false');
      // The furthest card in view (a tablet row shows two at once); the share of each is kept.
      const ratios = p.worlds.map(() => 0);
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const i = p.worlds.indexOf(entry.target as HTMLElement);
            if (i >= 0) ratios[i] = entry.intersectionRatio;
          }
          const furthest = ratios.findLastIndex((ratio) => ratio >= IN_VIEW);
          if (furthest >= 0) show(furthest);
        },
        { root: p.track, threshold: IN_VIEW },
      );
      for (const world of p.worlds) observer.observe(world);
      cleanups.push(() => {
        observer.disconnect();
        bar.removeAttribute('style');
        fill.removeAttribute('style');
        bar.setAttribute('aria-hidden', 'true');
        bar.setAttribute('aria-valuenow', '1');
      });
    }

    return () => {
      for (const cleanup of cleanups.reverse()) cleanup();
      // The context revert leaves the scrubbed track at `translate(0px, 0px)` (each refresh
      // re-recorded the inline transform as the original); the tier-0 page has none.
      if (tl !== null) gsap.set(p.track, { clearProps: 'transform' });
      pins.delete(ctx.el);
    };
  },
};

export default scene;
