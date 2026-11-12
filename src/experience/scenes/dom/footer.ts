/**
 * Scene 11, the footer playground (phase 7 report D9, D12, D15; prototype 0e). Motivation: the
 * brand plays with the reader at the end, and comes home on its own. At tiers 1 to 3 the six
 * lockup parts drop from the header line into the field when the stage enters (`bounce.out`,
 * one stagger), the reader drags and throws them with Draggable inside the field, a release
 * falls at once under gravity with the throw's speed (fallSegments) and bounces on the field's
 * floor, and 6 s after the last interaction
 * they drift home (`expo.out`); «پخش دوباره» replays the drop (the keyboard path). Transform
 * only: the pressed part rises through a class that sets `z-index`, once per press (D12), and
 * `will-change` is set on press and cleared when its fall completes. Tier 0, reduced motion and
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

import { AWAY_ATTR, LIFTOFF_EVENT } from '../../journey/attrs';
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

/** Gravity of the playground (px/s²): a part dropped from the field's height lands in ~0.45 s. */
export const GRAVITY = 4200;
/** A sideways throw slides at least this long (s), also along the floor (friction, power2.out). */
const SLIDE_S = 0.4;
/** Each bounce rises this share of the fall above it; under 3 px it is not drawn. */
const BOUNCES = [0.2, 0.05] as const;

export interface FallSegment {
  y: number;
  duration: number;
  /** A downward release's own fall: from its speed, speeding up under gravity. */
  ease: 'power1.in' | 'power1.out' | ((progress: number) => number);
}

/**
 * The way a released part moves in y under gravity (the owner: «it hangs a second before it
 * falls»): from `y` with the release velocity `vy` (px/s, down positive), up to its apex if thrown
 * upward (a quadratic slow-down, never above `top`), then down to `floor` speeding up (½ g t²),
 * then a couple of smaller bounces. Quadratic eases are the exact motion under constant gravity.
 */
export function fallSegments(y: number, vy: number, floor: number, top: number): FallSegment[] {
  const segs: FallSegment[] = [];
  let at = y;
  if (vy < 0) {
    const apex = Math.max(top, at - (vy * vy) / (2 * GRAVITY));
    if (at - apex > 0.5) {
      segs.push({ y: apex, duration: Math.sqrt((2 * (at - apex)) / GRAVITY), ease: 'power1.out' });
      at = apex;
    }
  }
  const height = floor - at;
  if (height <= 1) return segs;
  // A downward release keeps its speed: y = v0 t + ½ g t², as a share of the height over the
  // fall's time, starts at v0 (power1.in is the same motion from rest).
  const v0 = Math.max(0, vy);
  const fall = (-v0 + Math.sqrt(v0 * v0 + 2 * GRAVITY * height)) / GRAVITY;
  const lead = (v0 * fall) / height;
  segs.push({
    y: floor,
    duration: fall,
    ease: v0 > 0 ? (u: number) => lead * u + (1 - lead) * u * u : 'power1.in',
  });
  for (const share of BOUNCES) {
    const rise = height * share;
    if (rise < 3) break;
    const t = Math.sqrt((2 * rise) / GRAVITY);
    segs.push({ y: floor - rise, duration: t, ease: 'power1.out' });
    segs.push({ y: floor, duration: t, ease: 'power1.in' });
  }
  return segs;
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
    // A released part's fall, one timeline per part. Killed as a whole: a timeline whose tweens
    // alone are killed still completes on the next tick (gsap 3.15) and would arm the way home.
    const falls = new Map<HTMLElement, gsap.core.Timeline>();
    const stopFall = (part: HTMLElement): void => {
      falls.get(part)?.kill();
      falls.delete(part);
    };
    // Not `killTweensOf(parts)`: before its first render a staggered tween ignores a kill by
    // target (gsap 3.15), and the drop or the way home may be that young when it must go.
    const killAll = (): void => {
      for (const part of parts) stopFall(part);
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
      if (gone || drags.some((drag) => drag.isPressed)) return;
      homeTimer = window.setTimeout(goHome, HOME_AFTER_MS);
    };
    // The journey's courier delivers the mark (docs/experience/journey.md section 4): while it
    // has not landed, the mark part waits at home, hidden, and the enter drop leaves it out.
    const drop = (enter = false): void => {
      if (gone) return;
      const falling = enter ? parts.filter((part) => !part.hasAttribute(AWAY_ATTR)) : parts;
      if (falling.length === 0) return;
      clearHomeTimer();
      killAll();
      gsap.set(falling, {
        x: 0,
        y: (_: number, part: HTMLElement) => -(part.offsetTop + part.offsetHeight + DROP_ABOVE_PX),
      });
      gsap.to(falling, {
        y: 0,
        ease: 'bounce.out',
        duration: 1.3,
        stagger: 0.07,
        onComplete: armHome,
      });
    };
    // The courier lifts off the mark's box: the part, wherever it was thrown, waits at home.
    const onLiftoff = (event: Event): void => {
      const part = event.currentTarget as HTMLElement;
      stopFall(part);
      for (const tween of gsap.getTweensOf(part)) tween.kill();
      gsap.set(part, { x: 0, y: 0 });
    };
    for (const part of parts) part.addEventListener(LIFTOFF_EVENT, onLiftoff);
    // The pointer's last samples per part, for the release velocity (px/s).
    const samples = new Map<HTMLElement, { t: number; x: number; y: number }[]>();
    // The release velocity: from the oldest drag sample of the last 100 ms to where the pointer
    // has the part now (`end`: Draggable's own x and y, which follow every pointer move, while
    // the drawn part and the samples follow its frames). A part held still before the release has
    // no recent sample, or one where it still is, so it simply drops. With no sample, or only the
    // newest, in those 100 ms (a touch flick coalesced into one move; a host that draws a frame
    // every 100 ms or so, where the flick was never drawn) it is measured from the latest sample
    // before them, if that one is under 250 ms old: else it measured 0 px/s and the throw was lost
    // (CI runs 42377118771 and 145, T-BF10 in WebKit).
    const velocity = (
      part: HTMLElement,
      end: { x: number; y: number },
    ): { vx: number; vy: number } => {
      const now = performance.now();
      const list = samples.get(part) ?? [];
      samples.delete(part);
      let i = list.findIndex((p) => now - p.t <= 100);
      if (i === -1 || i === list.length - 1) {
        const before = i === -1 ? list.length - 1 : i - 1;
        if (before >= 0 && now - list[before]!.t <= 250) i = before;
      }
      const first = list[i];
      if (!first || now - first.t < 8 || now - first.t > 250) return { vx: 0, vy: 0 };
      const dt = (now - first.t) / 1000;
      return { vx: (end.x - first.x) / dt, vy: (end.y - first.y) / dt };
    };
    // On release the part falls at once under gravity, carrying its throw sideways (a decaying
    // x inside the field, which also slides a part thrown along the floor) and upward (it rises,
    // slows and falls); no throw is played first.
    const settle = (part: HTMLElement, end?: { x: number; y: number }): void => {
      stopFall(part);
      const drawn = {
        x: Number(gsap.getProperty(part, 'x')),
        y: Number(gsap.getProperty(part, 'y')),
      };
      const { vx, vy } = velocity(part, end ?? drawn);
      const bounds = boundsOf(field, part);
      const x = Number(gsap.getProperty(part, 'x'));
      const y = Number(gsap.getProperty(part, 'y'));
      const done = (): void => {
        falls.delete(part);
        part.style.removeProperty('will-change');
        armHome();
      };
      const fall = gsap.timeline({ paused: true, onComplete: done });
      for (const seg of fallSegments(y, vy, bounds.maxY, bounds.minY)) fall.to(part, seg);
      const xEnd = Math.min(bounds.maxX, Math.max(bounds.minX, x + vx * 0.3));
      if (Math.abs(xEnd - x) > 0.5) {
        const slide = Math.max(fall.duration(), SLIDE_S);
        fall.to(part, { x: xEnd, duration: slide, ease: 'power2.out' }, 0);
      }
      if (fall.duration() === 0) {
        fall.kill();
        done();
        return;
      }
      falls.set(part, fall);
      fall.play();
    };
    const create = (Draggable: DraggableClass): void => {
      if (gone) return;
      drags = Draggable.create(parts, {
        type: 'x,y',
        // No InertiaPlugin throw: the release starts the fall under gravity at once (settle).
        inertia: false,
        edgeResistance: 0.75,
        zIndexBoost: false,
        // Before the press is measured: the bounds of this part, fresh after any resize.
        onPressInit(this: DraggableInstance) {
          this.vars.bounds = boundsOf(field, this.target as HTMLElement);
        },
        onPress(this: DraggableInstance) {
          const part = this.target as HTMLElement;
          clearHomeTimer();
          stopFall(part);
          gsap.killTweensOf(part);
          raised?.classList.remove(RAISED_CLASS);
          part.classList.add(RAISED_CLASS);
          raised = part;
          part.style.willChange = 'transform';
        },
        onDrag(this: DraggableInstance) {
          const part = this.target as HTMLElement;
          const list = samples.get(part) ?? [];
          list.push({
            t: performance.now(),
            x: Number(gsap.getProperty(part, 'x')),
            y: Number(gsap.getProperty(part, 'y')),
          });
          if (list.length > 6) list.shift();
          samples.set(part, list);
        },
        onRelease(this: DraggableInstance) {
          // Where the pointer has the part, not yet drawn on a slow host.
          const live = Number.isFinite(this.x) && Number.isFinite(this.y);
          settle(this.target as HTMLElement, live ? { x: this.x, y: this.y } : undefined);
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
        load().then(() => drop(true), failed);
      },
    });
    const onReplay = (): void => {
      load().then(() => drop(), failed);
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
      for (const part of parts) part.removeEventListener(LIFTOFF_EVENT, onLiftoff);
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
