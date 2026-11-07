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

import { AWAY_ATTR, HERE_ATTR, LIFTOFF_EVENT, STAGE_ATTR } from './attrs';
import { measureDocks, measureObstacles, measureViewport } from './docks';
import { createFollow, type Shown } from './motion';
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
      ? requestIdleCallback(cb, { timeout: 500 })
      : window.setTimeout(() => cb({ timeRemaining: () => 8 }), 32);
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
    render({ pose, shown, scrollY, docks, bands, viewport, webgl });
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
      // Until the spring has landed on the pose (motion.ts), then the tick sleeps.
      if (still >= STILL_FRAMES && spring.settled()) {
        off?.();
        off = null;
      }
    });
  };

  let frame = 0;
  const remeasure = (): void => {
    frame = 0;
    measure();
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
