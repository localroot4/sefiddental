// Shared by the scene module tests (jsdom): a scene context with a paused master timeline and a
// fake engine, plus the matchMedia stub ScrollTrigger reads at registration.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { vi } from 'vitest';

import { tierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../../engine/scrollEngine';
import type { SceneContext, SceneId } from '../types';

/** The observers the scenes created (jsdom has none); `fire` reports ratios for targets. */
export const observers: FakeIntersectionObserver[] = [];

class FakeIntersectionObserver {
  targets: Element[] = [];
  disconnected = false;
  constructor(
    readonly callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    observers.push(this);
  }
  observe(target: Element): void {
    this.targets.push(target);
  }
  unobserve(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  disconnect(): void {
    this.disconnected = true;
    this.targets = [];
  }
  fire(ratios: Map<Element, number>): void {
    const entries = Array.from(ratios, ([target, intersectionRatio]) => ({
      target,
      intersectionRatio,
    }));
    this.callback(
      entries as unknown as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

export function registerScrollTrigger(): void {
  window.matchMedia = (media: string) =>
    ({
      matches: false,
      media,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  window.IntersectionObserver = FakeIntersectionObserver as unknown as typeof IntersectionObserver;
  // jsdom lays nothing out: every element sits one viewport below, so `reveal` creates its tween
  // (RV4 moves one trigger into view by hand).
  Element.prototype.getBoundingClientRect = () =>
    ({ x: 0, y: 2000, top: 2000, bottom: 2000, left: 0, right: 0, width: 0, height: 0 }) as DOMRect;
  // A tall document: the phone scroll set clamps its ranges to the maximum scroll, which is 0 in
  // an empty jsdom page (every scrub would sit at its end).
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 10_000,
    configurable: true,
  });
  gsap.registerPlugin(ScrollTrigger);
}

export function killAll(): void {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  observers.length = 0;
  document.body.innerHTML = '';
}

/** One tick subscriber at a time, driven by hand through `tick`. */
export function fakeEngine() {
  let subscriber: ((timeSec: number, deltaSec: number) => void) | null = null;
  const off = vi.fn(() => {
    subscriber = null;
  });
  const onTick = vi.fn((cb: (timeSec: number, deltaSec: number) => void) => {
    subscriber = cb;
    return off;
  });
  return {
    engine: { onTick } as unknown as ScrollEngine,
    onTick,
    off,
    tick: (deltaSec: number) => subscriber?.(0, deltaSec),
    subscribed: () => subscriber !== null,
  };
}

export function fakeContext(
  id: SceneId,
  el: HTMLElement,
  over: Partial<Pick<SceneContext, 'conditions' | 'settings' | 'engine'>> = {},
): SceneContext {
  const conditions = over.conditions ?? { reduce: false, fine: true, wide: true };
  return {
    id,
    el,
    layout: { pinnedScenes: false, lenis: false, latchedAtTier: 1 },
    settings:
      over.settings ??
      tierSettings(
        1,
        { width: conditions.wide ? 1440 : 390, height: 900, dpr: 1 },
        conditions.fine,
      ),
    conditions,
    engine: over.engine ?? fakeEngine().engine,
    master: gsap.timeline({ paused: true }),
    label: id,
    segment: () => ({ start: 0, end: 1 }),
    nearViewport: (cb) => {
      cb();
      return () => {};
    },
  };
}
