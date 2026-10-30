// Scene 5 under 1024 px (phone spec scene 5, U-PH10): the real section markup, real gsap and
// ScrollTrigger (workflow.test.tsx mocks gsap to record the pin timeline).
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkflowSection, type WorkflowItem } from '@/components/home/sections/WorkflowSection';
import type { Media } from '@/payload-types';

import type { SceneContext } from '../types';

import { PHONE_MOTION } from './phone';
import scene from './workflow';

beforeAll(() => {
  // jsdom has no matchMedia: a coarse pointer (the phone).
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  // A tall document: a clamped range is clamped to the maximum scroll, 0 in an empty jsdom page.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    value: 10_000,
    configurable: true,
  });
  gsap.registerPlugin(ScrollTrigger);
});

const photo = (n: number) =>
  ({
    id: n,
    url: `/api/media/file/workflow-${n}.jpg`,
    alt: `گام ${n}`,
    width: 1200,
    height: 900,
    sizes: {},
  }) as unknown as Media;

// Two real photos and two placeholders (an unpopulated id): a placeholder's caption is a `<p>` too.
const items: WorkflowItem[] = [1, 2, 3, 4].map((n) => ({
  id: `s${n}`,
  title: `گام ${n}`,
  text: `خط ${n}`,
  photo: n % 2 === 0 ? n : photo(n),
}));

/** Element tops by element; the rest sit far below the viewport (jsdom lays nothing out). */
let tops: Map<Element, number>;
let observers: number;

beforeEach(() => {
  tops = new Map();
  observers = 0;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = tops.get(this) ?? 2000;
    return { top, bottom: top + 300, height: 300, left: 0, right: 0, width: 0 } as DOMRect;
  });
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor() {
        observers += 1;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // The sticky bar (64 px) and the section as the server renders it.
  document.body.innerHTML = `<nav data-sticky-bar=""></nav>${renderToStaticMarkup(
    <WorkflowSection items={items} />,
  )}`;
  Object.defineProperty(document.querySelector('[data-sticky-bar]'), 'offsetHeight', {
    value: 64,
  });
});

afterEach(() => {
  ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

const el = () => document.querySelector<HTMLElement>('[data-scene="workflow"]')!;
const all = (selector: string) => Array.from(document.querySelectorAll<HTMLElement>(selector));
const triggerOf = (target: Element): ScrollTrigger | undefined =>
  ScrollTrigger.getAll().find((t) => t.trigger === target);
const phoneCtx = () =>
  ({
    el: el(),
    conditions: { wide: false, fine: false, reduce: false },
  }) as unknown as SceneContext;

describe('scene 5 workflow under 1024 px (phone spec scene 5)', () => {
  it('WF-P1 a scrubbed Rise on each title and each line, one trigger each, from the bar top; no observer, no data-reveal, the photos never move', () => {
    const cleanup = scene.setup(phoneCtx());
    expect(typeof cleanup).toBe('function');
    expect(observers).toBe(0);
    expect(el().querySelector('[data-workflow-stage]')?.hasAttribute('data-reveal')).toBe(false);
    const texts = all('[data-workflow-step] h3, [data-workflow-step] h3 + p');
    expect(texts).toHaveLength(8);
    for (const text of texts) {
      const trigger = triggerOf(text);
      expect(trigger?.vars).toMatchObject({ scrub: PHONE_MOTION.lagS, end: 'clamp(top 80%)' });
      expect((trigger?.vars.start as () => string)()).toBe('clamp(top bottom-=64)');
      expect(gsap.getProperty(text, 'y')).toBe(PHONE_MOTION.rise.y);
      expect(text.style.opacity).toBe('0');
    }
    // The photos never move (no Drift): no inline style on a frame or anything in it but its warm
    // overlay; a placeholder's caption is no Rise target.
    const frames = all('[data-workflow-step] > div:last-child');
    expect(frames).toHaveLength(4);
    for (const still of all(
      '[data-workflow-step] > div:last-child, [data-workflow-step] > div:last-child *:not([data-workflow-warm])',
    )) {
      expect(still.getAttribute('style')).toBeNull();
    }
    // The two placeholders (their caption shows on the client preview only) are no Rise target.
    const slots = all('[data-workflow-step] [data-photo-slot]');
    expect(slots).toHaveLength(2);
    for (const slot of slots) expect(triggerOf(slot)).toBeUndefined();
    // 8 rises, the fill and three warm overlays.
    expect(ScrollTrigger.getAll()).toHaveLength(12);
  });

  it('WF-P2 the timeline line fills from its top over the list (60 % to 60 %)', () => {
    scene.setup(phoneCtx());
    const line = document.querySelector<HTMLElement>('[data-workflow-line]')!;
    const list = document.querySelector('[data-workflow-path]')!;
    expect(gsap.getProperty(line, 'scaleY')).toBe(0);
    expect(line.hasAttribute('data-scrub')).toBe(true);
    expect(triggerOf(list)?.vars).toMatchObject({
      start: 'clamp(top 60%)',
      end: 'clamp(bottom 60%)',
      scrub: PHONE_MOTION.lagS,
    });
  });

  it('WF-P3 each warm overlay after the first scrubs to WARM_MAX * i / 3 on its photo frame from 80 % to 40 %; the scan stays cold', () => {
    scene.setup(phoneCtx());
    const warm = all('[data-workflow-warm]');
    expect(warm).toHaveLength(4);
    expect(warm[0]!.hasAttribute('data-scrub')).toBe(false);
    expect(gsap.getTweensOf(warm[0]!)).toHaveLength(0);
    expect(triggerOf(warm[0]!.parentElement!)).toBeUndefined();
    warm.slice(1).forEach((overlay, k) => {
      const tween = gsap.getTweensOf(overlay)[0];
      expect(overlay.hasAttribute('data-scrub')).toBe(true);
      expect(overlay.style.opacity).toBe('0');
      expect(tween?.vars.ease).toBe('none');
      expect(Math.round((tween?.vars.opacity as number) * 100) / 100).toBe([0.12, 0.24, 0.36][k]);
      expect(triggerOf(overlay.parentElement!)?.vars).toMatchObject({
        start: 'clamp(top 80%)',
        end: 'clamp(top 40%)',
        scrub: PHONE_MOTION.lagS,
      });
    });
  });

  it('WF-P4 a title above the bar top when the scene sets up keeps its server state (rule 2.2-5)', () => {
    const [first] = all('[data-workflow-step] h3');
    tops.set(first!, 768 - 64 - 1);
    scene.setup(phoneCtx());
    expect(first!.getAttribute('style')).toBeNull();
    expect(triggerOf(first!)).toBeUndefined();
  });

  it('WF-P5 the context revert leaves the tier-0 markup: no inline style on any target', () => {
    const ctx = gsap.context(() => {
      scene.setup(phoneCtx());
    });
    ctx.revert();
    const styled = all('[data-scene="workflow"] *').filter((node) => node.style.cssText !== '');
    expect(styled.map((node) => node.outerHTML.slice(0, 60))).toEqual([]);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });
});
