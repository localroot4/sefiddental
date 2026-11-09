/**
 * The journey driver (docs/experience/journey.md sections 3 to 5): the one owner of the page side
 * of the courier at tiers 1 to 3. It measures the docks (docks.ts) on start and on every size
 * change, computes the pose (pose.ts) on scroll, and writes what the pose decides into the page:
 * the smile photo's opacity, the molar art hidden while the courier carries the tooth, the
 * footer's mark part away until the courier lands on it (the hand-off, section 4), the booking
 * and footer stages made transparent over the bands the courier layer paints, and the frame of
 * the view (the DOM courier, JourneyLayer.tsx). The WebGL courier reads the same pose and tells
 * the driver when it draws, so the DOM courier steps aside at the same pose (and comes back on a
 * lost context or a lower tier).
 *
 * No loop at rest: it follows the engine's tick only while the page scrolls or resizes, and lets
 * go after a few still frames, so an idle phone keeps a sleeping ticker (T-PH12).
 */
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { introMarkBox } from '@/lib/intro/introMark';

import { subscribeIntro } from '../core/browserSignals';

import { AWAY_ATTR, HERE_ATTR, LIFTOFF_EVENT, STAGE_ATTR } from './attrs';
import { ABOVE_ATTR, measureDocks, measureObstacles, measureViewport } from './docks';
import { createFollow, glide, type Shown } from './motion';
import {
  courierPose,
  prepareLanes,
  photoDim,
  type Lanes,
  sweepAmount,
  type Box,
  type Dock,
  type Pose,
  type Viewport,
} from './pose';
/** The molar slot's attribute that hides its SVG art (MolarStepper, phase 8 pass.ts). */
const LIVE_ATTR = 'data-world-live';
/** Still frames before the driver lets go of the tick. */
const STILL_FRAMES = 12;
/** The courier's mark is this share of its box's height (JourneyLayer.tsx draws it so). */
export const MARK_SHARE = 0.92;
/**
 * A journey that starts this soon after the intro (an engine that came late) still glides from the
 * intro mark's place: the mark the reader just saw flies on to D1.
 */
const LATE_HANDOFF_MS = 800;

/** The stages the courier passes over whose own background the layer paints (section 6). */
export const BANDS = [
  { id: 'booking', selector: '[data-home-section="booking"] > section' },
  { id: 'footer', selector: '[data-scene="footer"]' },
] as const;
export type BandId = (typeof BANDS)[number]['id'];

/** A band in document px. */
export interface Band {
  id: BandId;
  top: number;
  height: number;
}

export interface EngineTicks {
  onTick(cb: (timeSec: number, deltaSec: number) => void): () => void;
}

export interface Frame {
  pose: Pose;
  /** Where the courier shows this frame: the pose with its secondary motion (motion.ts). */
  shown: Shown;
  scrollY: number;
  docks: readonly Dock[];
  bands: readonly Band[];
  viewport: Viewport;
  /** The WebGL courier draws this frame: the DOM courier hides its own forms. */
  webgl: boolean;
  /**
   * The intro hand-off: 0 while the courier fills the intro mark's hole, rising to 1 over the
   * glide to the pose; 1 without a hand-off. The breath and the turn come in with it.
   */
  born: number;
  /** Above the cards: from the hole until the glide is over and the courier is clear of them. */
  lead: boolean;
}

export interface Journey {
  readonly tier: number;
  /** The pose at the current scroll position (computed on call; pure). */
  pose(): Pose;
  /** The place the courier shows at in the last frame the driver applied (motion.ts). */
  shown(): Shown;
  /** The lanes of the last measure (planned in idle time). */
  lanes(): Lanes | null;
  docks(): readonly Dock[];
  viewport(): Viewport;
  /** The WebGL courier has drawn (true) or stopped drawing (false). */
  setWebgl(on: boolean): void;
  /** The WebGL courier draws now (the DOM courier hides its forms). */
  webgl(): boolean;
  /** Measure again now (a test, a font load the observer missed). */
  measure(): void;
  destroy(): void;
}

function measureBands(root: ParentNode): Band[] {
  const sy = window.scrollY;
  const bands: Band[] = [];
  for (const { id, selector } of BANDS) {
    const el = root.querySelector(selector);
    if (el === null) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0) bands.push({ id, top: rect.top + sy, height: rect.height });
  }
  return bands;
}

export function createJourney(opts: {
  root: HTMLElement;
  engine: EngineTicks;
  tier: number;
  /** The view: called with every frame the driver applies. */
  render(frame: Frame): void;
}): Journey {
  const { root, engine, tier, render } = opts;
  const html = document.documentElement;
  let docks: Dock[] = [];
  let obstacles: Box[] = [];
  let lanes: Lanes | null = null;
  let planning = 0;
  let bands: Band[] = [];
  let viewport: Viewport = { width: 0, height: 0, maxScroll: 0 };
  let webgl = false;
  let destroyed = false;

  const photo = root.querySelector<HTMLElement>('[data-smile-photo]');
  const molar = root.querySelector<HTMLElement>('[data-dock="restoration"]');
  const part = root.querySelector<HTMLElement>('[data-dock="footer"]');
  const servicesMark = root.querySelector<HTMLElement>('[data-dock="services"]');
  const team = root.querySelector<HTMLElement>('[data-home-section="dentists"]');
  // The courier carries the tooth: the slot's own art steps aside (tier 0 keeps it).
  molar?.setAttribute(LIVE_ATTR, '');
  // D2 is the services mark's own box: one mark on screen, the courier (tier 0 keeps the SVG).
  servicesMark?.setAttribute(HERE_ATTR, '');
  html.setAttribute(STAGE_ATTR, '');

  // The lanes are planned in idle time after a measure, the travel nearest the reader first;
  // never in a scroll tick (route.ts costs tens of ms a travel). Until a travel's lane is in, it
  // keeps its eased path.
  const idle = (cb: (deadline: { timeRemaining(): number }) => void): number =>
    typeof requestIdleCallback === 'function'
      ? requestIdleCallback(cb, { timeout: 120 })
      : window.setTimeout(() => {
          // WebKit has no idle callback: an 8 ms slot that really runs out (a constant would
          // plan every travel in one long task).
          const end = performance.now() + 8;
          cb({ timeRemaining: () => Math.max(0, end - performance.now()) });
        }, 32);
  const unidle = (id: number): void => {
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(id);
    else window.clearTimeout(id);
  };
  const plan = (deadline: { timeRemaining(): number }): void => {
    planning = 0;
    if (destroyed || lanes === null) return;
    // A few samples of a travel at least, more while the idle slot lasts.
    const more = lanes.next(window.scrollY, () => deadline.timeRemaining());
    lanes.use(window.scrollY);
    follow();
    if (more) planning = idle(plan);
  };
  const measure = (): void => {
    docks = measureDocks(root);
    obstacles = measureObstacles(root);
    bands = measureBands(root);
    viewport = measureViewport();
    lanes = prepareLanes(docks, viewport, obstacles);
    lanes.use(window.scrollY);
    if (planning !== 0) unidle(planning);
    planning = idle(plan);
  };

  // The intro hand-off: born in the intro mark's hole while the overlay is up (the frame's hole
  // at its first scale is exactly the mark's box), it glides to the pose once the overlay lifts.
  // Only when the intro plays: never at tier 0 or under reduced motion.
  let hole: { x: number; y: number; scale: number } | null = null;
  // The overlay itself, not isIntroDone(): its cap from navigation start would end the hole early
  // on a page that started the intro late.
  const playing = (): boolean => html.dataset.intro === 'playing';
  const ended = performance.getEntriesByName('intro:end')[0]?.startTime;
  const late =
    html.dataset.intro === 'done' &&
    ended !== undefined &&
    performance.now() - ended < LATE_HANDOFF_MS;
  /** 'hole' while the overlay is up, the glide's time so far (s) after it, null without one. */
  let handoff: 'hole' | number | null = playing() ? 'hole' : late ? 0 : null;
  let lead = handoff !== null;
  // The cards themselves, as the lanes see them (docks.ts measureObstacles).
  const cards = [...root.querySelectorAll<HTMLElement>(`[${ABOVE_ATTR}] > :not([data-dock])`)];
  const measureHole = (): void => {
    const mark = document.querySelector('#intro[open] .i-m')?.getBoundingClientRect();
    if (!mark || !(mark.height > 0)) return;
    hole = {
      x: mark.left + mark.width / 2,
      y: mark.top + mark.height / 2,
      scale: mark.height / MARK_SHARE,
    };
  };
  const overCards = (at: Shown): boolean => {
    const half = at.scale / 2;
    return cards.some((card) => {
      const c = card.getBoundingClientRect();
      return (
        at.x - half < c.right &&
        at.x + half > c.left &&
        at.y - half < c.bottom &&
        at.y + half > c.top
      );
    });
  };

  const spring = createFollow();
  let shown: Shown = { x: 0, y: 0, scale: 0, tilt: 0, sx: 1, sy: 1 };
  let lastOpacity = '';
  let lastSweep = '';
  let away: boolean | null = null;
  const apply = (dt = 0): void => {
    const scrollY = window.scrollY;
    lanes?.use(scrollY);
    const pose = courierPose(scrollY, docks, viewport, tier, lanes);
    shown = spring.step(pose, dt, viewport.height);
    let born = 1;
    if (handoff !== null) {
      // Frame time, at most a 30 fps frame each: a long frame slows the glide, never skips it.
      if (handoff !== 'hole') handoff += Math.min(dt, 1 / 30);
      born = handoff === 'hole' ? 0 : glide(handoff);
      if (born >= 1 || hole === null || pose.hidden) {
        handoff = null;
        born = 1;
      } else {
        const mix = (a: number, b: number): number => a + (b - a) * born;
        shown = {
          x: mix(hole.x, shown.x),
          y: mix(hole.y, shown.y),
          scale: mix(hole.scale, shown.scale),
          tilt: shown.tilt * born,
          sx: mix(1, shown.sx),
          sy: mix(1, shown.sy),
        };
      }
    }
    // Back under the cards only once clear of them.
    if (lead && handoff === null && !overCards(shown)) lead = false;
    const dim = Math.round(photoDim(pose) * 1000) / 1000;
    const opacity = `${Math.round(pose.smile * 1000) / 1000}|${dim}`;
    if (photo && opacity !== lastOpacity) {
      photo.style.opacity = String(Math.round(pose.smile * 1000) / 1000);
      // The D5 hand-off: the photo dims and settles back as the tooth lifts off it.
      photo.style.filter = dim > 0 ? `brightness(${1 - 0.18 * dim})` : '';
      photo.style.transform = dim > 0 ? `scale(${1 - 0.02 * dim})` : '';
      lastOpacity = opacity;
    }
    // D6: the light that sweeps the dentists' cards as the mark arrives (globals.css).
    const sweep = String(Math.round(sweepAmount(pose) * 1000) / 1000);
    if (team && sweep !== lastSweep) {
      team.style.setProperty('--sweep', sweep);
      lastSweep = sweep;
    }
    const nextAway = !pose.hidden;
    if (part && nextAway !== away) {
      part.toggleAttribute(AWAY_ATTR, nextAway);
      // Lifting off a part the reader may have thrown: it goes home while it is hidden.
      if (nextAway && away === false) part.dispatchEvent(new CustomEvent(LIFTOFF_EVENT));
      away = nextAway;
    }
    render({ pose, shown, scrollY, docks, bands, viewport, webgl, born, lead });
  };

  // Follow the tick while something moves; let go after a few still frames.
  let off: (() => void) | null = null;
  let still = 0;
  let lastY = Number.NaN;
  const follow = (): void => {
    still = 0;
    if (off !== null || destroyed) return;
    off = engine.onTick((_time, delta) => {
      const y = window.scrollY;
      if (y === lastY) still += 1;
      else still = 0;
      lastY = y;
      apply(delta);
      // Until the spring has landed on the pose (motion.ts) and the intro glide is over, then
      // the tick sleeps.
      if (still >= STILL_FRAMES && spring.settled() && handoff === null) {
        off?.();
        off = null;
      }
    });
  };

  let frame = 0;
  const remeasure = (): void => {
    frame = 0;
    measure();
    if (handoff === 'hole') measureHole();
    apply();
  };
  const schedule = (): void => {
    if (frame === 0) frame = requestAnimationFrame(remeasure);
    follow();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(html);
  window.addEventListener('resize', schedule);
  // The engine registered ScrollTrigger before it was created (every tier from 1): a trigger over
  // the whole page wakes the driver on scroll.
  const scroll = ScrollTrigger.create({ start: 0, end: 'max', onUpdate: follow });
  // A chip of the restoration levels changes the tooth without a scroll.
  root.addEventListener('change', follow);

  measure();
  if (handoff === 'hole') measureHole();
  else if (late) {
    // The dialog is gone: the mark's place from the intro's own geometry (introMark.ts).
    const mark = introMarkBox(window.innerWidth, window.innerHeight);
    hole = { x: mark.x, y: mark.y, scale: mark.h / MARK_SHARE };
  }
  if (hole === null) {
    handoff = null;
    lead = false;
  }
  const unsubscribeIntro =
    handoff === 'hole'
      ? subscribeIntro(() => {
          if (handoff !== 'hole' || playing()) return;
          handoff = 0;
          follow();
        })
      : null;
  if (late) follow();
  apply();

  return {
    tier,
    pose: () => courierPose(window.scrollY, docks, viewport, tier, lanes),
    lanes: () => lanes,
    shown: () => shown,
    docks: () => docks,
    viewport: () => viewport,
    setWebgl(on) {
      if (on === webgl || destroyed) return;
      webgl = on;
      apply();
    },
    webgl: () => webgl,
    measure: remeasure,
    destroy() {
      destroyed = true;
      unsubscribeIntro?.();
      off?.();
      off = null;
      if (frame !== 0) cancelAnimationFrame(frame);
      if (planning !== 0) unidle(planning);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      scroll.kill();
      root.removeEventListener('change', follow);
      molar?.removeAttribute(LIVE_ATTR);
      servicesMark?.removeAttribute(HERE_ATTR);
      html.removeAttribute(STAGE_ATTR);
      part?.removeAttribute(AWAY_ATTR);
      photo?.style.removeProperty('opacity');
      photo?.style.removeProperty('filter');
      photo?.style.removeProperty('transform');
      team?.style.removeProperty('--sweep');
    },
  };
}
