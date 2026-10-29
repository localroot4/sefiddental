/**
 * Scene 11, the footer playground (phase 7 report D9, D12, D15; prototype 0e). Motivation: the
 * brand plays with the reader at the end, and comes home on its own. At tiers 1 to 3 the six
 * lockup parts drop from the header line into the field when the stage enters (`bounce.out`,
 * one stagger), the reader drags and throws them with Draggable and InertiaPlugin inside the
 * field, a throw ends with a bounce on the field's floor, and 6 s after the last interaction
 * they drift home (`expo.out`); «پخش دوباره» replays the drop (the keyboard path). Transform
 * only: the pressed part rises through a class that sets `z-index`, once per press (D12), and
 * `will-change` is set on press and cleared when its throw completes. Tier 0, reduced motion and
 * a static playground setting run nothing and load no chunk.
 *
 * Cleanup: the Draggables are created after the lazy chunk resolved, outside the engine's
 * matchMedia context (Draggable registers with the gsap context active at its construction,
 * `gsap.core.context`; none is then), so `mm.revert()` does not reach them: the cleanup kills
 * every instance, the home timer and the tweens, and resets the parts, before anything leaves
 * the document (the debug count sees only Draggables on elements still in it).
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { TierSettings } from '@/lib/qualityTier';

import type { DomScene } from '../types';

type DraggableClass = (typeof import('./playground.lazy'))['default'];
type DraggableInstance = InstanceType<DraggableClass>;

/** The parts drift home this long after the last interaction (brief: 6 seconds). */
const HOME_AFTER_MS = 6000;
/** The drop starts this far above the part's home, past the header line (prototype 0e). */
const DROP_ABOVE_PX = 56;
/** The pressed part rises above the others (D12: a class, once per press). */
const RAISED_CLASS = 'z-10';
/** The stage enters once its top crosses this line of the viewport. */
const ENTER = 'top 80%';

/** `y` that rests a part's bottom edge on the field's bottom edge (prototype 0e). */
export function floorY(
  field: { clientHeight: number },
  part: { offsetTop: number; offsetHeight: number },
): number {
  return field.clientHeight - part.offsetTop - part.offsetHeight;
}

/**
 * The field's edges in a part's own x/y space (its transform offsets from home), read from layout
 * offsets. Numbers, not the field element: for an element Draggable reads four global matrices
 * at every press, and each one inserts a helper node into body (a style recalculation each; it
 * made the press a 300 ms task at 4x while the site CSS had active `:has()` rules, report D21).
 */
export function boundsOf(
  field: { clientWidth: number; clientHeight: number },
  part: { offsetLeft: number; offsetTop: number; offsetWidth: number; offsetHeight: number },
): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: -part.offsetLeft,
    maxX: field.clientWidth - part.offsetLeft - part.offsetWidth,
    minY: -part.offsetTop,
    maxY: floorY(field, part),
  };
}

/** DOM physics at tiers 1 to 3 ('3d' renders as DOM in phase 7); never under reduced motion. */
export function playgroundRuns(
  settings: Pick<TierSettings, 'footerPlayground'>,
  reduce: boolean,
): boolean {
  return !reduce && settings.footerPlayground !== 'static';
}

const scene: DomScene = {
  setup({ el, settings, conditions, nearViewport }) {
    const field = el.querySelector<HTMLElement>('[data-playground-field]');
    const replay = el.querySelector<HTMLElement>('[data-playground-replay]');
    if (field === null || replay === null || !playgroundRuns(settings, conditions.reduce)) return;
    const parts = Array.from(field.querySelectorAll<HTMLElement>('[data-playground-part]'));
    if (parts.length === 0) return;

    let gone = false;
    let armFrame = 0;
    let drags: DraggableInstance[] = [];
    let homeTimer = 0;
    let raised: HTMLElement | null = null;
    let chunk: Promise<DraggableClass> | null = null;
    const load = (): Promise<DraggableClass> =>
      (chunk ??= import('./playground.lazy').then((mod) => mod.default));
    // A failed import is not kept: the next enter or replay requests the chunk again.
    const failed = (error: unknown): void => {
      chunk = null;
      console.error('[experience] playground chunk failed to load; the parts stay home.', error);
    };

    const clearHomeTimer = (): void => {
      window.clearTimeout(homeTimer);
      homeTimer = 0;
    };
    // Not `killTweensOf(parts)`: before its first render a staggered tween ignores a kill by
    // target (gsap 3.15), and the drop or the way home may be that young when it must go.
    const killAll = (): void => {
      for (const tween of gsap.getTweensOf(parts)) tween.kill();
    };
    const goHome = (): void => {
      homeTimer = 0;
      gsap.to(parts, { x: 0, y: 0, ease: 'expo.out', duration: 1.2, stagger: 0.04 });
    };
    // Not while a part is held: the drop or another part's floor bounce may complete under a
    // press, and the way home must never write x/y against the pointer; that press re-arms it.
    const armHome = (): void => {
      clearHomeTimer();
      if (drags.some((drag) => drag.isPressed)) return;
      homeTimer = window.setTimeout(goHome, HOME_AFTER_MS);
    };
    const drop = (): void => {
      if (gone) return;
      clearHomeTimer();
      killAll();
      gsap.set(parts, {
        x: 0,
        y: (_: number, part: HTMLElement) => -(part.offsetTop + part.offsetHeight + DROP_ABOVE_PX),
      });
      gsap.to(parts, {
        y: 0,
        ease: 'bounce.out',
        duration: 1.3,
        stagger: 0.07,
        onComplete: armHome,
      });
    };
    const settle = (part: HTMLElement): void => {
      part.style.removeProperty('will-change');
      const floor = floorY(field, part);
      const y = Number(gsap.getProperty(part, 'y'));
      if (y < floor - 2) {
        gsap.to(part, {
          y: floor,
          ease: 'bounce.out',
          duration: 0.5 + (floor - y) / 900,
          onComplete: armHome,
        });
      } else armHome();
    };
    const create = (Draggable: DraggableClass): void => {
      if (gone) return;
      drags = Draggable.create(parts, {
        type: 'x,y',
        inertia: true,
        edgeResistance: 0.75,
        throwResistance: 2200,
        zIndexBoost: false,
        // Before the press is measured: the bounds of this part, fresh after any resize.
        onPressInit(this: DraggableInstance) {
          this.vars.bounds = boundsOf(field, this.target as HTMLElement);
        },
        onPress(this: DraggableInstance) {
          const part = this.target as HTMLElement;
          clearHomeTimer();
          gsap.killTweensOf(part);
          raised?.classList.remove(RAISED_CLASS);
          part.classList.add(RAISED_CLASS);
          raised = part;
          part.style.willChange = 'transform';
        },
        onRelease(this: DraggableInstance) {
          // A click or a tap without a drag: no throw follows, so the timer arms here.
          if (!this.isThrowing) settle(this.target as HTMLElement);
        },
        onThrowComplete(this: DraggableInstance) {
          settle(this.target as HTMLElement);
        },
      });
    };

    // One frame after the chunk evaluated: its evaluation and the six instances each end in a
    // full style recalculation of the page (Draggable measures a helper node it inserts into
    // body at registration; the first computed-style read of a part pays for its removal), so
    // the two never share one task at 4x.
    const arm = (Draggable: DraggableClass): void => {
      if (gone) return;
      armFrame = requestAnimationFrame(() => {
        armFrame = 0;
        create(Draggable);
      });
    };
    const cancelNear = nearViewport(() => {
      load().then(arm, failed);
    });
    // Created in the context (killed by its revert); the drop waits for the chunk.
    const enter = ScrollTrigger.create({
      trigger: el,
      start: ENTER,
      once: true,
      onEnter: () => {
        load().then(drop, failed);
      },
    });
    const onReplay = (): void => {
      load().then(drop, failed);
    };
    replay.addEventListener('click', onReplay);
    // Its box is there at every tier (D24): only its visibility and its inertness change.
    replay.classList.remove('invisible');
    replay.removeAttribute('inert');

    return () => {
      gone = true;
      cancelNear();
      cancelAnimationFrame(armFrame);
      enter.kill();
      clearHomeTimer();
      replay.removeEventListener('click', onReplay);
      replay.classList.add('invisible');
      replay.setAttribute('inert', '');
      for (const drag of drags) drag.kill();
      drags = [];
      killAll();
      raised?.classList.remove(RAISED_CLASS);
      raised = null;
      for (const part of parts) part.style.removeProperty('will-change');
      gsap.set(parts, { clearProps: 'transform' });
    };
  },
};

export default scene;
