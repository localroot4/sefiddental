/**
 * One clock, one master timeline (spec EXP 3.6). Native scroll stays the source of truth: Lenis
 * only smooths wheel input on fine pointers and never takes touch; GSAP's ticker drives Lenis,
 * ScrollTrigger and every per-frame subscriber in that order. No scroll listener in app code.
 *
 * Phase 7 (report, plan section 3): the DOM scene modules run inside the matchMedia context,
 * pins first in document order, then the master with one label per present scene, then every
 * scene's `setup`. Labels and the children added at them are rebuilt from the measured bounds on
 * every ScrollTrigger refresh; `destroy()` runs the scene cleanups, reverts the context and
 * leaves no trigger, ticker callback, listener or observer behind.
 *
 * Under 1024 px (phone spec 1.4, D25, D28): every scene setup is a task of its own after the
 * creation task, a scene within two viewport heights at once, any other when it comes near;
 * `data-settling` on the root lets the scrubbed targets (`[data-scrub]`) ease to rest for one
 * `--dur-3` window after creation and at destroy; in phone mode no window resize refreshes the
 * triggers, the root's ResizeObserver asks for a refresh that waits for the end of the scroll.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import type { Tier, TierSettings } from '@/lib/qualityTier';

import { coverRanges, isCovered } from '../core/gates';
import { DOM_SCENES } from '../scenes/dom';
import { isSceneId } from '../scenes/registry';
import type { DomScene, SceneContext, SceneDefinition, SceneId } from '../scenes/types';
import { keyValue } from '../tier/browserEnv';
import { createFrameMonitor, type MonitorWindow } from '../tier/frameMonitor';
import type { LayoutLatch } from '../tier/latch';

import { once } from './once';
import {
  activeScene,
  sceneBounds,
  sceneProgress,
  scrollFraction,
  scrollYAt,
  type SceneBound,
  type SceneOffset,
  type ScenePlace,
} from './timelineMath';

/** Dispatched by `bookingRoute.ts` while a tier is latched; the engine answers with `scrollTo`. */
export const SCROLL_TO_EVENT = 'sefid:scroll-to';

export interface ScrollEngine {
  /** Null at tier 0, on coarse pointers, and during the engine's first frame (see creation). */
  readonly lenis: Lenis | null;
  /**
   * Duration 1; once it has its ScrollTrigger, its progress is the document scroll fraction. Null
   * at tier 0. On a phone without Lenis it gets the trigger with its first child (at creation, or
   * on the next refresh for a child added later); until then it stays paused.
   */
  readonly master: gsap.core.Timeline | null;
  /**
   * Main-thread milliseconds of `createScrollEngine` plus, when a scene pinned, the full refresh
   * those pins queue for the next frame (spacer layout, the engine's re-measure and re-placing).
   */
  readonly initMs: number;
  /** 0..1 document scroll fraction. */
  progress(): number;
  /** 0..1 inside the scene's segment. */
  sceneProgress(id: SceneId): number;
  /** The active scene (the last label at or before the position) and its progress; relatch keep-place. */
  activeScene(): ScenePlace<SceneId> | null;
  /** The master's labels in time order (one per present scene); empty without a master. */
  labels(): string[];
  /** px/s from the master's ScrollTrigger; 0 without a master or before it has its trigger. */
  velocity(): number;
  scrollTo(target: HTMLElement | number, opts?: { immediate?: boolean }): void;
  /**
   * Runs after Lenis and ScrollTrigger in the same gsap tick (time and delta in seconds); returns
   * the unsubscribe.
   */
  onTick(cb: (timeSec: number, deltaSec: number) => void): () => void;
  /** Ticker callbacks the engine owns right now: subscribers plus Lenis's raf (teardown proof). */
  tickSubscribers(): number;
  /** True while a `[data-experience-cover]` fills the viewport (render gate, spec EXP 3.4). */
  covered(): boolean;
  /** Latch inputs (freeze 3.7). */
  insidePinnedRange(): boolean;
  reachedFirstPinnedScene(): boolean;
  destroy(): void;
}

// `all` keeps the callback running when no other query matches (a phone: coarse and narrow);
// gsap.matchMedia only calls back while at least one condition is active.
const QUERIES = {
  all: 'all',
  reduce: '(prefers-reduced-motion: reduce)',
  fine: '(pointer: fine)',
  wide: '(min-width: 1024px)',
} as const;

// GSAP defaults restored on teardown (gsap-core lagSmoothing(500, 33)).
const LAG_THRESHOLD_MS = 500;
const LAG_ADJUSTED_MS = 33;

/** A child never gets a zero duration: a timeline's duration setter divides by it. */
const MIN_SEGMENT = 1e-6;

/** `--dur-3` plus 50 ms: one settle window of `data-settling` (D25). */
const SETTLE_MS = 370;

/**
 * D28: in phone mode no window resize refreshes the triggers. A forced refresh scrolls the
 * window to 0 and back, which stops a fling in iOS Safari, and a keyboard opening over a form
 * must not refresh while the visitor types. ScrollTrigger's default list adds `resize`.
 */
const REFRESH_EVENTS = {
  phone: 'visibilitychange,DOMContentLoaded,load',
  other: 'visibilitychange,DOMContentLoaded,load,resize',
} as const;

let pluginsRegistered = false;
let refreshEvents: string = REFRESH_EVENTS.other;
let settleTimer = 0;
/**
 * Registers ScrollTrigger once per page, and only where a trigger is made (every layout from tier
 * 1: Lenis, pins, the hero scrub and the phone scroll set). Its registration writes body's style
 * attribute and reads a 100vh probe: two full style recalculations (26 to 52 ms in one task on
 * home, Lighthouse tier 1, while the site CSS had `:has()` rules). Callers inside the engine's
 * matchMedia context go through `context.ignore`: what registration creates (ScrollTrigger's own
 * matchMedia and delayed calls) must not be reverted with that context.
 */
function registerScrollTrigger(): void {
  if (pluginsRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  // Phone address-bar resizes do not refresh the triggers.
  ScrollTrigger.config(
    refreshEvents === REFRESH_EVENTS.other
      ? { ignoreMobileResize: true }
      : { ignoreMobileResize: true, autoRefreshEvents: refreshEvents },
  );
  pluginsRegistered = true;
}

/** The refresh events of the current mode, applied now or at the registration. */
function refreshOn(events: string): void {
  if (events === refreshEvents) return;
  refreshEvents = events;
  if (pluginsRegistered) ScrollTrigger.config({ autoRefreshEvents: events });
}

/**
 * One settle window (D25): the CSS eases `[data-scrub]` targets under `[data-settling]` in
 * `--dur-3`, so a target the engine moves or releases returns to rest instead of jumping. A new
 * window (the next engine) replaces the running one.
 */
function settle(root: HTMLElement): void {
  window.clearTimeout(settleTimer);
  root.setAttribute('data-settling', '');
  settleTimer = window.setTimeout(() => root.removeAttribute('data-settling'), SETTLE_MS);
}

/** A task boundary: `scheduler.yield()` where present, else a 0 ms timer. */
function nextTask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  return typeof scheduler?.yield === 'function'
    ? scheduler.yield()
    : new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * The root calls this one frame before `createScrollEngine`, so neither task is long at 4x.
 * Every layout from tier 1 makes triggers (under 1024 px the phone scroll set scrubs, D21); the
 * tier 0 engine makes none, so it never pays the registration.
 */
export function prepareScrollEngine(layout: LayoutLatch): void {
  if (layout.latchedAtTier >= 1) registerScrollTrigger();
}

/** The master's trigger: the whole document, scrubbed, its end re-measured on every refresh. */
const masterTrigger = (): ScrollTrigger.Vars => ({
  start: 0,
  end: 'max',
  scrub: true,
  invalidateOnRefresh: true,
});

const maxScroll = (): number =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

const documentTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;

interface PresentScene {
  id: Exclude<SceneId, 'intro'>;
  el: HTMLElement;
  scene: DomScene;
}

/** The `[data-scene]` elements of the root in document order, with their modules. */
function presentScenes(root: HTMLElement): PresentScene[] {
  const out: PresentScene[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-scene]')) {
    const id = el.getAttribute('data-scene') ?? '';
    if (isSceneId(id) && id !== 'intro') out.push({ id, el, scene: DOM_SCENES[id] });
  }
  return out;
}

function measureBounds(root: HTMLElement): SceneBound<SceneId>[] {
  const offsets: SceneOffset<SceneId>[] = presentScenes(root).map(({ id, el }) => {
    const rect = el.getBoundingClientRect();
    return { id, top: rect.top + window.scrollY, height: rect.height };
  });
  return sceneBounds(offsets, maxScroll());
}

/**
 * The scrollY that keeps a reader at `place` in the current document (measured now, after the
 * previous engine reverted its pins); null when that scene is gone.
 */
export function placeScrollY(root: HTMLElement, place: ScenePlace<SceneId>): number | null {
  return scrollYAt(place, measureBounds(root), maxScroll());
}

/** The reader's place in the current document, measured now; null above the first scene. */
export function placeNow(root: HTMLElement): ScenePlace<SceneId> | null {
  return activeScene(scrollFraction(window.scrollY, maxScroll()), measureBounds(root));
}

/** A reader's place: in a scene's segment, or (`pin`) in the range of the scene's pin. */
export type KeptPlace = ScenePlace<SceneId> & { pin?: true };

/** sessionStorage: the pin the reader was inside when the page was left, and the progress. */
export const PIN_PLACE_KEY = 'sefid-pin-place';
const session = keyValue(() => window.sessionStorage);

/**
 * At `pagehide`. A reload restores its scroll in the document without pins, where a pin range
 * has no height, so no place read there maps back into it (a reload at services 2010 landed at
 * 3410, at restoration 4381 at 7684).
 */
export function savePinPlace(): void {
  const pin = ScrollTrigger.getAll().find((trigger) => trigger.pin && trigger.isActive);
  const id = pin?.pin?.closest('[data-scene]')?.getAttribute('data-scene');
  if (pin && id) session.set(PIN_PLACE_KEY, JSON.stringify({ id, progress: pin.progress }));
  else session.remove(PIN_PLACE_KEY);
}

/** The place `savePinPlace` kept, read once; only a reload or a history visit restores it. */
export function takePinPlace(): KeptPlace | null {
  const raw = session.get(PIN_PLACE_KEY);
  session.remove(PIN_PLACE_KEY);
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  if (raw === null || (nav?.type !== 'reload' && nav?.type !== 'back_forward')) return null;
  try {
    const { id, progress } = JSON.parse(raw) as Record<string, unknown>;
    if (typeof id === 'string' && isSceneId(id) && typeof progress === 'number') {
      if (progress >= 0 && progress <= 1) return { id, progress, pin: true };
    }
  } catch {
    // Not JSON (another writer, a manual edit): no place, the fallback applies.
  }
  return null;
}

/**
 * The frame monitor while no canvas renders (D5, phone spec D26): the same sampler and step rule
 * as the canvas probe, fed only while the page scrolls. Its own requestAnimationFrame loop runs
 * from ScrollTrigger's `scrollStart` to `scrollEnd`, so at rest nothing runs, and a frame counts
 * only when the page moved since the frame before: `scrollEnd` comes 200 to 450 ms after the last
 * scroll (its 250 ms check) and never while a finger rests, and those still frames are fast, so
 * counted they made good windows that reset the slow time (at 20x the step never came). The frame
 * time is the frame clock (the rAF timestamp, wall clock), not the gsap ticker: gsap's
 * lag-smoothed delta reports a 600 ms freeze as 33 ms, and gsap dispatches its listeners at most
 * once per 4 ms of `Date.now()`, so two frames whose callbacks run close together (a late main
 * thread) reach a ticker listener as one 33 ms frame; counted that way, a 60 fps scroll on the 4x
 * phone profile read 40 to 52 fps and stepped down (step 4b measurement). The first frame after a
 * start holds the idle gap and is dropped; a partial window at the end is dropped; the warm-up
 * runs once, from here. Returns the stop.
 */
export function monitorFrames(opts: {
  tier: Tier;
  /** Phone mode: 1000 ms of slow time goes to tier 0. */
  phone: boolean;
  onStepDown: () => void;
  onWindow?: (window: MonitorWindow) => void;
  /** Every frame of the loop, sampled or not: the idle-ticker proof counts them (T-PH12). */
  onFrame?: () => void;
}): () => void {
  const monitor = createFrameMonitor({
    tier: opts.tier,
    mode: 'auto',
    phone: opts.phone,
    onStepDown: () => opts.onStepDown(),
    onWindow: opts.onWindow,
  });
  monitor.reset(performance.now());
  let last: number | null = null;
  let lastY = 0;
  let frame = 0;
  const onFrame = (now: number): void => {
    opts.onFrame?.();
    const y = window.scrollY;
    if (last !== null && y !== lastY) monitor.push((now - last) / 1000, now);
    last = now;
    lastY = y;
    frame = requestAnimationFrame(onFrame);
  };
  const onScrollStart = (): void => {
    if (frame !== 0) return;
    last = null;
    lastY = window.scrollY;
    frame = requestAnimationFrame(onFrame);
  };
  const onScrollEnd = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    monitor.cut();
  };
  // scrollStart and scrollEnd come from ScrollTrigger's document scroll listener.
  registerScrollTrigger();
  ScrollTrigger.addEventListener('scrollStart', onScrollStart);
  ScrollTrigger.addEventListener('scrollEnd', onScrollEnd);
  // rAF stops in a background tab; the pause must not count as slow frames.
  const onVisibility = (): void => {
    if (document.visibilityState === 'visible') monitor.reset(performance.now());
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    ScrollTrigger.removeEventListener('scrollStart', onScrollStart);
    ScrollTrigger.removeEventListener('scrollEnd', onScrollEnd);
    cancelAnimationFrame(frame);
    frame = 0;
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

export function createScrollEngine(opts: {
  root: HTMLElement;
  layout: LayoutLatch;
  settings: TierSettings;
  scenes: readonly SceneDefinition[];
  /**
   * Keep-place across a relatch, the place the browser restored for a first engine, or the pin
   * place a reload kept at `pagehide`: applied again by the refresh the new pins queue, run in
   * the creation task.
   */
  restore?: KeptPlace;
}): ScrollEngine {
  const t0 = performance.now();
  const { root, layout, settings, scenes, restore } = opts;
  const known = new Set<string>(scenes.map((scene) => scene.id));
  const pinnedIds = new Set<string>(scenes.filter((s) => s.pinnedDesktop).map((s) => s.id));
  const firstPinned = scenes.find((s) => s.pinnedDesktop)?.id ?? null;

  const subscribers = new Set<(timeSec: number, deltaSec: number) => void>();
  const tick = (time: number, deltaMs: number): void => {
    for (const cb of subscribers) cb(time, deltaMs / 1000);
  };
  let tickAdded = false;

  let lenis: Lenis | null = null;
  let lenisRaf: ((time: number) => void) | null = null;
  let master: gsap.core.Timeline | null = null;
  let spine: gsap.core.Animation | null = null;
  // Direct children of the master by the scene whose label they were added at.
  const children = new Map<gsap.core.Animation, SceneId>();
  let present: PresentScene[] = [];
  let destroyed = false;
  let initMs = 0;
  // Keep-place (report section 3): the root scrolls to `restore` before creation, in the document
  // without pins; the spacers the new pins add move the content on the refresh those pins queue
  // (ScrollTrigger 3.15 `_queueRefreshAll`), so the place is applied again from the bounds that
  // refresh measures. That refresh also counts in `initMs`.
  let pending: KeptPlace | null = null;
  let pinRefresh = false;
  let refreshStart = 0;

  // Measured on every ScrollTrigger refresh (pins add spacers) and once at creation.
  let covers: { top: number; height: number }[] = [];
  let bounds: SceneBound<SceneId>[] = [];

  const sectionElements = (): Element[] =>
    Array.from(root.querySelectorAll('[data-scene]')).filter((el) =>
      known.has(el.getAttribute('data-scene') ?? ''),
    );

  const measure = (): void => {
    covers = Array.from(root.querySelectorAll('[data-experience-cover]')).map((el) => {
      const rect = el.getBoundingClientRect();
      // Ceil: a 100dvh cover can measure a fraction under the integer viewport height.
      return { top: rect.top + window.scrollY, height: Math.ceil(rect.height) };
    });
    bounds = measureBounds(root);
  };

  /**
   * Native scroll, not Lenis: Lenis clamps to the limit its observer measured before the spacers.
   * A pin place reads the pin's own range: a segment's share of the document moves with every
   * height change after the measure (a restoration step switch moved it 14 px).
   */
  const apply = (place: KeptPlace): void => {
    const el = place.pin ? root.querySelector(`[data-scene="${place.id}"]`) : null;
    const pin = el && ScrollTrigger.getAll().find((t) => t.pin && el.contains(t.pin));
    const y = pin
      ? pin.start + place.progress * (pin.end - pin.start)
      : scrollYAt(place, bounds, maxScroll());
    if (y !== null) window.scrollTo(0, y);
  };

  const segmentOf = (id: SceneId): { start: number; end: number } => {
    const bound = bounds.find((b) => b.id === id);
    return bound ? { start: bound.start, end: bound.end } : { start: 0, end: 0 };
  };

  const placeLabels = (): void => {
    if (master === null) return;
    for (const bound of bounds) master.addLabel(bound.id, bound.start);
  };

  /** A child added at a label after `setup` (a lazy chunk) belongs to the scene of that label. */
  const adopt = (): void => {
    if (master === null) return;
    for (const child of master.getChildren(false, true, true)) {
      if (child === spine || children.has(child)) continue;
      const owner = present.find(({ id }) => master?.labels[id] === child.startTime());
      if (owner) children.set(child, owner.id);
    }
  };

  const placeChildren = (): void => {
    if (master === null) return;
    for (const [child, id] of children) {
      const segment = segmentOf(id);
      child.startTime(segment.start);
      if (child.duration() > 0) child.duration(Math.max(segment.end - segment.start, MIN_SEGMENT));
    }
    master.render(master.totalTime(), true, true);
  };

  /**
   * The master scrubs once it has a child. Created outside the context (the caller's job, like
   * the registration): the context's revert kills the master and, with it, this trigger.
   */
  const triggerMaster = (): void => {
    if (master === null || master.scrollTrigger || children.size === 0) return;
    registerScrollTrigger();
    ScrollTrigger.create({ ...masterTrigger(), animation: master });
  };

  /**
   * A refresh must not move the reader. ScrollTrigger scrolls to 0 to measure and then restores
   * the position it recorded at `refreshInit`; after a context revert (the previous engine's
   * teardown on a relatch) it skips that record and restores 0, so the page would jump to the
   * top. Both events run in one task, so putting the reader back here is never visible.
   */
  let scrollAtRefreshInit = 0;
  const onRefreshInit = (): void => {
    scrollAtRefreshInit = window.scrollY;
    refreshStart = performance.now();
  };

  /** Refresh: re-measure, then re-place labels, children and the pending reader place. */
  const onRefresh = (): void => {
    adopt();
    measure();
    placeLabels();
    placeChildren();
    if (pending !== null) apply(pending);
    else if (window.scrollY !== scrollAtRefreshInit) window.scrollTo(0, scrollAtRefreshInit);
    pending = null;
    if (pinRefresh) {
      pinRefresh = false;
      initMs += performance.now() - refreshStart;
      performance.measure('sefid:engine-first-refresh', { start: refreshStart });
    }
  };

  const progress = (): number => {
    const trigger = master?.scrollTrigger;
    return trigger ? trigger.progress : scrollFraction(window.scrollY, maxScroll());
  };

  const pinnedRanges = (): { start: number; end: number }[] =>
    sectionElements()
      .filter((el) => pinnedIds.has(el.getAttribute('data-scene') ?? ''))
      .map((el) => {
        const top = documentTop(el);
        return { start: top, end: top + el.getBoundingClientRect().height - window.innerHeight };
      });

  const api: ScrollEngine = {
    get lenis() {
      return lenis;
    },
    get master() {
      return master;
    },
    get initMs() {
      return initMs;
    },
    progress,
    sceneProgress(id) {
      const bound = bounds.find((b) => b.id === id);
      return bound ? sceneProgress(progress(), bound) : 0;
    },
    activeScene() {
      return activeScene(progress(), bounds);
    },
    labels() {
      const labels = master?.labels ?? {};
      return Object.keys(labels).sort((a, b) => (labels[a] ?? 0) - (labels[b] ?? 0));
    },
    velocity() {
      return master?.scrollTrigger?.getVelocity() ?? 0;
    },
    scrollTo(target, scrollOpts = {}) {
      const instant = scrollOpts.immediate === true || window.matchMedia(QUERIES.reduce).matches;
      if (lenis) {
        // A native scroll earlier in this same task (a focus, a test runner's scroll into view)
        // reaches Lenis only with the scroll event of the next frame; until then scrollTo adds the
        // element's rect to a stale animatedScroll and lands that far off (T-EN7 on CI, 458 px).
        // resize() syncs animatedScroll and the limit to the real position first.
        lenis.resize();
        // Lenis 1.3.26 applies the root's scroll-padding and the target's scroll-margin itself.
        lenis.scrollTo(target, { immediate: instant });
        return;
      }
      const behavior: ScrollBehavior = instant ? 'instant' : 'smooth';
      if (typeof target === 'number') window.scrollTo({ top: target, behavior });
      else target.scrollIntoView({ block: 'start', behavior });
    },
    onTick(cb) {
      subscribers.add(cb);
      if (!tickAdded && !destroyed) {
        gsap.ticker.add(tick);
        tickAdded = true;
      }
      return () => {
        subscribers.delete(cb);
        if (subscribers.size === 0 && tickAdded) {
          gsap.ticker.remove(tick);
          tickAdded = false;
        }
      };
    },
    tickSubscribers() {
      return subscribers.size + (lenisRaf ? 1 : 0);
    },
    covered() {
      return isCovered(window.scrollY, coverRanges(covers, window.innerHeight));
    },
    insidePinnedRange() {
      const y = window.scrollY;
      return pinnedRanges().some((range) => y >= range.start && y <= range.end);
    },
    reachedFirstPinnedScene() {
      if (firstPinned === null) return false;
      const el = root.querySelector(`[data-scene="${firstPinned}"]`);
      return el !== null && el.getBoundingClientRect().top < window.innerHeight;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      // Before the revert, so the scrubbed targets ease back to rest in the same style pass.
      settle(root);
      // Order (spec EXP 3.6 rule 9): tick subscribers, then triggers and timelines, then Lenis.
      subscribers.clear();
      if (tickAdded) gsap.ticker.remove(tick);
      tickAdded = false;
      resize.disconnect();
      if (refreshFrame !== 0) cancelAnimationFrame(refreshFrame);
      ScrollTrigger.removeEventListener('refreshInit', onRefreshInit);
      ScrollTrigger.removeEventListener('refresh', onRefresh);
      mm.revert();
    },
  };

  // Reads before writes: the measure runs on the clean tree of the last frame (the root waits
  // two frames after its commit and registers ScrollTrigger in between), and Lenis waits one
  // more frame (below), so this task forces no full style recalculation (three of them cost
  // 25 of 33 ms at 1x, 160 to 240 ms at 4x, measured before the split).
  measure();
  settle(root);
  ScrollTrigger.addEventListener('refreshInit', onRefreshInit);
  ScrollTrigger.addEventListener('refresh', onRefresh);
  let phoneMode = false;

  const mm = gsap.matchMedia(root);
  mm.add(QUERIES, (context) => {
    const { reduce = false, fine = false, wide = false } = context.conditions ?? {};
    // Before the tier-0 return: after a phone step-down ScrollTrigger stays registered, and a
    // resize refresh would still scroll the window to 0 and back (D28).
    phoneMode = !fine && !wide;
    refreshOn(phoneMode ? REFRESH_EVENTS.phone : REFRESH_EVENTS.other);
    // Tier 0 and reduced motion: no Lenis, no master timeline, no pins (spec EXP 3.8).
    if (reduce || layout.latchedAtTier === 0) return () => refreshOn(REFRESH_EVENTS.other);
    let live = true;

    let offScroll: (() => void) | null = null;
    let lenisFrame = 0;
    if (fine && layout.lenis) {
      context.ignore(registerScrollTrigger);
      // One frame later: Lenis reads the document size and adds classes to <html>, which makes
      // the next layout read recalculate every element's style; after a rendered frame that
      // recalculation rides the frame instead of the creation task. Scroll keeps working
      // natively until then; `engine.lenis` is null for that frame.
      lenisFrame = requestAnimationFrame(() => {
        lenisFrame = 0;
        // Official integration from the Lenis 1.3.26 README ("GSAP ScrollTrigger"), with named
        // callbacks so teardown can remove them, and Lenis's raf first in the tick (prioritize).
        // No `stopInertiaOnNavigate`: its click listener resets the scroll on any link to another
        // path, which kills the engine's own scroll for the in-page booking routes (every CTA
        // links to /رزرو-نوبت); a link that does navigate unloads the document anyway.
        const instance = new Lenis({ autoRaf: false, anchors: true });
        // Lenis 1.3.26 rewrites html's class list at every scroll start and stop
        // (`lenis-scrolling`, `lenis-smooth`); each rewrite forces a full style recalculation of
        // the page on the next layout read, 60 to 110 ms at 4x on home (the 83 ms hero frame of
        // step 1, traced 2026-10-27). Nothing styles those classes: the instance keeps only the
        // `lenis` class its constructor added.
        (instance as unknown as { updateClassName(): void }).updateClassName = () => {};
        offScroll = instance.on('scroll', ScrollTrigger.update);
        const raf = (time: number) => {
          instance.raf(time * 1000); // Convert time from seconds to milliseconds
        };
        gsap.ticker.add(raf, false, true);
        gsap.ticker.lagSmoothing(0);
        lenisRaf = raf;
        lenis = instance;
      });
    }

    // The booking routes scroll through the engine while a tier is latched (report section 3).
    const onScrollTo = (event: Event): void => {
      const target: unknown = (event as CustomEvent<{ target?: unknown }>).detail?.target;
      if (!(target instanceof HTMLElement) && typeof target !== 'number') return;
      event.preventDefault();
      api.scrollTo(target);
    };
    document.addEventListener(SCROLL_TO_EVENT, onScrollTo);

    const conditions = { reduce, fine, wide };
    const nearViewport =
      (el: HTMLElement) =>
      (cb: () => void): (() => void) => {
        // One guard for the immediate check and the trigger's onEnter: a deep link or a reload
        // past `start` fires onEnter on the first refresh too (C13). What `cb` creates at once
        // joins this context; what it creates after a chunk load is the scene's own cleanup.
        let trigger: ScrollTrigger | null = null;
        const fire = once(() => {
          trigger?.kill();
          trigger = null;
          context.add(cb);
        });
        context.ignore(registerScrollTrigger);
        trigger = ScrollTrigger.create({
          trigger: el,
          start: 'top bottom+=100%',
          once: true,
          onEnter: fire,
        });
        if (el.getBoundingClientRect().top <= window.innerHeight * 2) fire();
        return () => {
          trigger?.kill();
          trigger = null;
        };
      };

    present = presentScenes(root);
    const cleanups: (() => void)[] = [];
    const base = { layout, settings, conditions, engine: api };

    // Pins in document order before the master, so the master's end includes their spacing;
    // their spacers land in the bounds on the full refresh every pin queues (ScrollTrigger),
    // through `onRefresh`, so the creation task reads nothing after they wrote.
    if (layout.pinnedScenes && wide) {
      context.ignore(registerScrollTrigger);
      for (const { id, el, scene } of present) {
        scene.pin?.({ id, el, ...base, nearViewport: nearViewport(el) });
      }
    }
    if (ScrollTrigger.getAll().some((trigger) => trigger.pin)) {
      pending = restore ?? null;
      pinRefresh = true;
    }

    // Without Lenis under 1024 px (a phone) the master stays paused until a scene adds a child
    // (the phone scroll set makes triggers of its own); `progress()` reads the native scroll
    // meanwhile.
    const timeline = gsap.timeline(
      pluginsRegistered && (wide || (fine && layout.lenis))
        ? { scrollTrigger: masterTrigger() }
        : { paused: true },
    );
    // The spine keeps the master at duration 1 whatever the children do. `to` returns the
    // timeline; `recent()` is the tween, which adopt() must never take for a scene's child.
    spine = timeline.to({}, { duration: 1, ease: 'none' }).recent() as gsap.core.Tween;
    master = timeline;
    placeLabels();

    /** One scene's setup; true when it added a child to the master. */
    const setupScene = ({ id, el, scene }: PresentScene): boolean => {
      const before = new Set(timeline.getChildren(false, true, true));
      const ctx: SceneContext = {
        id,
        el,
        ...base,
        master: timeline,
        label: id,
        segment: () => segmentOf(id),
        nearViewport: nearViewport(el),
      };
      const cleanup = scene.setup(ctx);
      let added = false;
      for (const child of timeline.getChildren(false, true, true)) {
        if (before.has(child)) continue;
        children.set(child, id);
        added = true;
      }
      if (typeof cleanup === 'function') cleanups.push(cleanup);
      return added;
    };

    if (wide) {
      for (const scene of present) setupScene(scene);
    } else {
      // Under 1024 px (phone spec 1.4 step 4, rule 2.2-10): the creation cost of the far scenes
      // waits until they come near, and each setup is its own task, the first one too, so no task
      // of the creation is long at 4x (Lighthouse mobile runs this branch). The hero's Drift (a
      // ScrollTrigger and its first refresh, 13 to 28 ms at 4x) made the creation task 52 to 64 ms
      // when it ran inline; the settle window opened above covers its first render.
      const whenNear = (scene: PresentScene): void => {
        const run = (): void => {
          if (!setupScene(scene)) return;
          placeChildren();
          context.ignore(triggerMaster);
        };
        // Near now: no waiting trigger at all.
        if (scene.el.getBoundingClientRect().top <= window.innerHeight * 2) run();
        else cleanups.push(nearViewport(scene.el)(run));
      };
      void (async () => {
        for (const scene of present) {
          await nextTask();
          if (!live) return;
          context.add(() => whenNear(scene));
        }
      })();
    }
    placeChildren();
    context.ignore(triggerMaster);
    // A place to keep: the refresh the pins queued runs now instead of on the next frame, which
    // would paint the content their spacers pushed into view (clsAll 1 on a reload at desktop
    // tier 2); a synchronous refresh makes the queued one a no-op.
    if (pending !== null) ScrollTrigger.refresh();

    return () => {
      live = false;
      refreshOn(REFRESH_EVENTS.other);
      // The scene cleanups first (listeners, observers, Draggables, classes), newest first, then
      // the master, then Lenis; the context revert that follows kills every trigger and tween.
      for (const cleanup of cleanups.splice(0).reverse()) cleanup();
      children.clear();
      present = [];
      spine = null;
      master = null;
      document.removeEventListener(SCROLL_TO_EVENT, onScrollTo);
      if (lenisFrame !== 0) cancelAnimationFrame(lenisFrame);
      if (lenisRaf) {
        offScroll?.();
        gsap.ticker.remove(lenisRaf);
        lenisRaf = null;
        lenis?.destroy();
        lenis = null;
        gsap.ticker.lagSmoothing(LAG_THRESHOLD_MS, LAG_ADJUSTED_MS);
      }
    };
  });

  // A child a lazy chunk added at a label since gives the master its trigger first. Without a
  // trigger the engine measures itself: `ScrollTrigger.refresh()` would register ScrollTrigger,
  // and once registered it scrolls the window to 0 and back even with no trigger to measure (the
  // tier-0 engine after a phone step-down; on iOS that stops a fling).
  const refresh = (): void => {
    adopt();
    triggerMaster();
    // Phone mode (D28): `refresh(true)` debounces 200 ms and then waits for the scroll to end.
    if (pluginsRegistered && ScrollTrigger.getAll().length > 0) ScrollTrigger.refresh(phoneMode);
    else {
      measure();
      placeLabels();
    }
  };

  // Any height change of the root (images, FAQ toggles, the tier attribute, theme CSS, pin
  // spacers) refreshes the triggers, once per frame. The observer's first callback reports the
  // initial size, which the creation just measured.
  let refreshFrame = 0;
  let observed = false;
  const resize = new ResizeObserver(() => {
    if (!observed) {
      observed = true;
      return;
    }
    if (refreshFrame !== 0) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      if (!destroyed) refresh();
    });
  });
  resize.observe(root);
  // A font still loading after `load` changes section heights when it swaps; fonts already
  // loaded were measured above (a redundant full refresh costs two recalculations).
  if (document.fonts?.status === 'loading') {
    void document.fonts.ready.then(() => {
      if (!destroyed) refresh();
    });
  }

  initMs = performance.now() - t0;
  performance.measure('sefid:engine-init', { start: t0, duration: initMs });
  return api;
}
