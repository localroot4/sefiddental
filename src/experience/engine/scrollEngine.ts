/**
 * One clock, one master timeline (spec EXP 3.6). Native scroll stays the source of truth: Lenis
 * only smooths wheel input on fine pointers and never takes touch; GSAP's ticker drives Lenis,
 * ScrollTrigger and every per-frame subscriber in that order. No scroll listener in app code.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

import { coverRanges, isCovered } from '../core/gates';
import type { SceneDefinition, SceneId } from '../scenes/types';
import type { LayoutLatch } from '../tier/latch';

import { sceneBounds, sceneProgress, scrollFraction, type SceneBound } from './timelineMath';

export interface ScrollEngine {
  readonly lenis: Lenis | null;
  /** Duration 1; its progress is the document scroll fraction. Null at tier 0. */
  readonly master: gsap.core.Timeline | null;
  /** 0..1 document scroll fraction. */
  progress(): number;
  /** 0..1 inside the scene's segment. */
  sceneProgress(id: SceneId): number;
  /** px/s from the master's ScrollTrigger; 0 without a master. */
  velocity(): number;
  scrollTo(target: HTMLElement | number, opts?: { immediate?: boolean }): void;
  /** Runs after Lenis and ScrollTrigger in the same gsap tick; returns the unsubscribe. */
  onTick(cb: (timeSec: number) => void): () => void;
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

let pluginsRegistered = false;
function registerPlugins(): void {
  if (pluginsRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  // Phone address-bar resizes do not refresh the triggers.
  ScrollTrigger.config({ ignoreMobileResize: true });
  pluginsRegistered = true;
}

const maxScroll = (): number =>
  Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

const documentTop = (el: Element): number => el.getBoundingClientRect().top + window.scrollY;

export function createScrollEngine(opts: {
  root: HTMLElement;
  layout: LayoutLatch;
  scenes: readonly SceneDefinition[];
}): ScrollEngine {
  registerPlugins();
  const { root, layout, scenes } = opts;
  const known = new Set<string>(scenes.map((scene) => scene.id));
  const pinnedIds = new Set<string>(scenes.filter((s) => s.pinnedDesktop).map((s) => s.id));
  const firstPinned = scenes.find((s) => s.pinnedDesktop)?.id ?? null;

  const subscribers = new Set<(timeSec: number) => void>();
  const tick = (time: number): void => {
    for (const cb of subscribers) cb(time);
  };
  let tickAdded = false;

  let lenis: Lenis | null = null;
  let master: gsap.core.Timeline | null = null;
  let destroyed = false;

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
    const offsets = sectionElements().map((el) => ({
      id: el.getAttribute('data-scene') as SceneId,
      top: documentTop(el),
    }));
    bounds = sceneBounds(offsets, maxScroll());
  };

  const mm = gsap.matchMedia(root);
  mm.add(QUERIES, (context) => {
    const { reduce = false, fine = false } = context.conditions ?? {};
    // Tier 0 and reduced motion: no Lenis, no master timeline, no pins (spec EXP 3.8).
    if (reduce || layout.latchedAtTier === 0) return;

    let lenisRaf: ((time: number) => void) | null = null;
    let offScroll: (() => void) | null = null;
    if (fine && layout.lenis) {
      // Official integration from the Lenis 1.3.26 README ("GSAP ScrollTrigger"), with named
      // callbacks so teardown can remove them, and Lenis's raf first in the tick (prioritize).
      const instance = new Lenis({ autoRaf: false, anchors: true, stopInertiaOnNavigate: true });
      offScroll = instance.on('scroll', ScrollTrigger.update);
      lenisRaf = (time: number) => {
        instance.raf(time * 1000); // Convert time from seconds to milliseconds
      };
      gsap.ticker.add(lenisRaf, false, true);
      gsap.ticker.lagSmoothing(0);
      lenis = instance;
    }

    // Pins (scenes 3-5, wide screens with layout.pinnedScenes) are created here in phase 7, in
    // document order and before the master, so the master's end includes their spacing.

    master = gsap.timeline({
      scrollTrigger: { start: 0, end: 'max', scrub: true, invalidateOnRefresh: true },
    });
    master.to({}, { duration: 1, ease: 'none' });

    return () => {
      master = null;
      if (lenisRaf) {
        offScroll?.();
        gsap.ticker.remove(lenisRaf);
        lenis?.destroy();
        lenis = null;
        gsap.ticker.lagSmoothing(LAG_THRESHOLD_MS, LAG_ADJUSTED_MS);
      }
    };
  });

  ScrollTrigger.addEventListener('refresh', measure);
  measure();
  // Font swap after `load` changes section heights.
  void document.fonts?.ready.then(() => {
    if (!destroyed) ScrollTrigger.refresh();
  });

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

  return {
    get lenis() {
      return lenis;
    },
    get master() {
      return master;
    },
    progress,
    sceneProgress(id) {
      const bound = bounds.find((b) => b.id === id);
      return bound ? sceneProgress(progress(), bound) : 0;
    },
    velocity() {
      return master?.scrollTrigger?.getVelocity() ?? 0;
    },
    scrollTo(target, scrollOpts = {}) {
      const instant = scrollOpts.immediate === true || window.matchMedia(QUERIES.reduce).matches;
      if (lenis) {
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
      // Order (spec EXP 3.6 rule 9): tick subscribers, then triggers and timelines, then Lenis.
      subscribers.clear();
      if (tickAdded) gsap.ticker.remove(tick);
      tickAdded = false;
      ScrollTrigger.removeEventListener('refresh', measure);
      mm.revert();
    },
  };
}
