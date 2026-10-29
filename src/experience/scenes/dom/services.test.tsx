import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../../engine/scrollEngine';
import type { LayoutLatch } from '../../tier/latch';
import type { SceneContext } from '../types';

import scene, { morphAt, trackDistance, wantsMorph, worldAccents, worldScrollY } from './services';

const restore = vi.fn();
const addMorphs = vi.fn((..._args: unknown[]) => restore);
vi.mock('./morph.lazy', () => ({ addMorphs: (...args: unknown[]) => addMorphs(...args) }));
/** jsdom has no `scrollIntoView`; the stub records the world it was called on. */
const scrollIntoView = vi.fn();

type Entry = { target: Element; intersectionRatio: number };
/** A fake IntersectionObserver that hands its callback and targets to the test. */
class FakeObserver {
  static instances: FakeObserver[] = [];
  targets: Element[] = [];
  disconnected = false;
  constructor(
    public callback: (entries: Entry[]) => void,
    public options: IntersectionObserverInit,
  ) {
    FakeObserver.instances.push(this);
  }
  observe(target: Element): void {
    this.targets.push(target);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

const MARKUP = `
<div data-scene="services"><section><div data-stage="">
  <h2>خدمات</h2><p>لید</p>
  <div data-mark=""><svg><path d="M0 0L1 0L1 1Z"/></svg><svg></svg><svg></svg></div>
  <div data-rail=""><div data-track="" data-worlds="cosmetic kids">
    <article><a href="/a">a</a></article><article><a href="/b">b</a></article>
  </div></div>
  <div data-progress="" aria-hidden="true" aria-valuenow="1"><div></div></div>
</div></section></div>`;

function context(over: {
  wide?: boolean;
  reduce?: boolean;
  pinned?: boolean;
  nearViewport?: SceneContext['nearViewport'];
}): SceneContext & { el: HTMLElement } {
  document.body.innerHTML = MARKUP;
  const el = document.querySelector<HTMLElement>('[data-scene]') as HTMLElement;
  const layout = {
    pinnedScenes: over.pinned ?? false,
    lenis: false,
    latchedAtTier: 1,
  } as LayoutLatch;
  return {
    id: 'services',
    el,
    layout,
    settings: {} as TierSettings,
    conditions: { reduce: over.reduce ?? false, fine: false, wide: over.wide ?? false },
    engine: { scrollTo: vi.fn() } as unknown as ScrollEngine,
    master: gsap.timeline({ paused: true }),
    label: 'services',
    segment: () => ({ start: 0, end: 0 }),
    nearViewport: over.nearViewport ?? vi.fn(() => () => {}),
  };
}

const link = (el: HTMLElement, href: string): HTMLAnchorElement =>
  el.querySelector<HTMLAnchorElement>(`a[href="${href}"]`) as HTMLAnchorElement;

/** The DOM environment matches `:focus-visible` for every focused element, so the link answers for
 * its own modality: a keyboard focus is focus-visible, a pointer focus is not. */
function focusWith(target: HTMLElement, visible: boolean): void {
  vi.spyOn(target, 'matches').mockReturnValue(visible);
  target.focus();
}
const keyboardFocus = (target: HTMLElement): void => focusWith(target, true);
const pointerFocus = (target: HTMLElement): void => focusWith(target, false);

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', FakeObserver);
  // jsdom has no matchMedia; the phone scroll set reads the pointer (coarse here).
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  FakeObserver.instances = [];
  addMorphs.mockClear();
  restore.mockClear();
  scrollIntoView.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-pins');
  document.body.innerHTML = '';
});

describe('services scene math', () => {
  it('slides the track by its overflow past the rail, never backwards', () => {
    expect(trackDistance(2600, 1300)).toBe(1300);
    expect(trackDistance(900, 1300)).toBe(0);
  });

  it('starts each morph at max(0, i/4 - 0.1) of the pin', () => {
    expect([0, 1, 2, 3, 4].map((i) => morphAt(i, 5))).toEqual([0, 0.15, 0.4, 0.65, 0.9]);
    expect(morphAt(0, 1)).toBe(0);
  });

  it('loads the morph only when wide, pinned and not reduced', () => {
    expect(wantsMorph({ wide: true, pinned: true, reduce: false })).toBe(true);
    expect(wantsMorph({ wide: false, pinned: true, reduce: false })).toBe(false);
    expect(wantsMorph({ wide: true, pinned: false, reduce: false })).toBe(false);
    expect(wantsMorph({ wide: true, pinned: true, reduce: true })).toBe(false);
  });

  it('maps a world index to its place in the pin', () => {
    expect(worldScrollY(100, 500, 0, 5)).toBe(100);
    expect(worldScrollY(100, 500, 3, 5)).toBe(400);
    expect(worldScrollY(100, 500, 4, 5)).toBe(500);
    expect(worldScrollY(100, 500, 0, 1)).toBe(100);
  });

  it('reads the worlds from the track', () => {
    const track = document.createElement('div');
    track.setAttribute('data-worlds', 'cosmetic kids');
    expect(worldAccents(track)).toEqual(['cosmetic', 'kids']);
    expect(worldAccents(document.createElement('div'))).toEqual([]);
  });
});

describe('services scene setup', () => {
  it('under 1024 px: no pin markup, the bar follows the card in view, the cleanup restores all', () => {
    const ctx = context({ wide: false, pinned: false });
    const cleanup = scene.setup(ctx);
    expect(document.documentElement.hasAttribute('data-pins')).toBe(false);
    expect(ctx.el.querySelector('.pin-spacer')).toBeNull();
    expect(ctx.nearViewport).not.toHaveBeenCalled();

    const bar = ctx.el.querySelector<HTMLElement>('[data-progress]') as HTMLElement;
    const fill = bar.firstElementChild as HTMLElement;
    const [observer] = FakeObserver.instances;
    expect(observer?.options).toMatchObject({ threshold: 0.6 });
    expect(observer?.targets).toHaveLength(2);
    expect(bar.getAttribute('aria-hidden')).toBe('false');
    expect(bar.style.opacity).toBe('1');
    expect(fill.style.transform).toBe('scaleX(0.5)');

    const [first, second] = observer?.targets ?? [];
    observer?.callback([{ target: second as Element, intersectionRatio: 1 }]);
    expect(fill.style.transform).toBe('scaleX(1)');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    // Leaving a card (under 60 percent) changes nothing: the next card's entry does.
    observer?.callback([{ target: first as Element, intersectionRatio: 0.3 }]);
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    // Two cards in view (a tablet row): the furthest counts; the bar never moves backwards for
    // a card that merely left.
    observer?.callback([
      { target: first as Element, intersectionRatio: 1 },
      { target: second as Element, intersectionRatio: 0.2 },
    ]);
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
    observer?.callback([{ target: second as Element, intersectionRatio: 0.7 }]);
    expect(bar.getAttribute('aria-valuenow')).toBe('2');

    expect(typeof cleanup).toBe('function');
    if (typeof cleanup === 'function') cleanup();
    expect(observer?.disconnected).toBe(true);
    expect(bar.hasAttribute('style')).toBe(false);
    expect(fill.hasAttribute('style')).toBe(false);
    expect(bar.getAttribute('aria-hidden')).toBe('true');
    expect(bar.getAttribute('aria-valuenow')).toBe('1');
  });

  it('under 1024 px: a keyboard focus centres its world in the row, a pointer focus does not', () => {
    const ctx = context({ wide: false, pinned: false });
    const cleanup = scene.setup(ctx);
    pointerFocus(link(ctx.el, '/a'));
    expect(scrollIntoView).not.toHaveBeenCalled();
    keyboardFocus(link(ctx.el, '/b'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ inline: 'center', block: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(link(ctx.el, '/b').closest('article'));
    expect(ctx.engine.scrollTo).not.toHaveBeenCalled();

    if (typeof cleanup === 'function') cleanup();
    keyboardFocus(link(ctx.el, '/a'));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('wide without a pin (tier 1): no morph, no bar, no focus handling', () => {
    const ctx = context({ wide: true, pinned: false });
    scene.setup(ctx);
    expect(ctx.nearViewport).not.toHaveBeenCalled();
    expect(FakeObserver.instances).toHaveLength(0);
    expect(ctx.el.querySelector('[data-progress]')?.getAttribute('aria-hidden')).toBe('true');
    keyboardFocus(link(ctx.el, '/b'));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(ctx.engine.scrollTo).not.toHaveBeenCalled();
  });

  it('wide and pinned: the morph loads near the viewport, once, and its restore runs on cleanup', async () => {
    const nearViewport = vi.fn((cb: () => void) => {
      cb();
      return () => {};
    });
    const ctx = context({ wide: true, pinned: true, nearViewport });
    const html = document.documentElement;
    expect(html.hasAttribute('data-pins')).toBe(false);
    scene.pin?.(ctx);
    // The root had no latch attribute: the scene wrote it, so its CSS pins the track.
    expect(html.hasAttribute('data-pins')).toBe(true);
    const cleanup = scene.setup(ctx);
    expect(nearViewport).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(addMorphs).toHaveBeenCalledTimes(1));
    const [tl, path, outlines, worlds] = addMorphs.mock.calls[0] as unknown[];
    expect(tl).toBeInstanceOf(gsap.core.Timeline);
    expect((path as Element).tagName).toBe('path');
    expect(outlines).toHaveLength(2);
    expect(worlds).toEqual(['cosmetic', 'kids']);
    expect(performance.getEntriesByName('sefid:services-morph')).toHaveLength(1);

    // A keyboard focus in the second world scrolls the page to that world's place in the pin; a
    // pointer focus (a click on the stretched link) moves nothing under the pointer.
    Object.defineProperty(tl, 'scrollTrigger', { value: { start: 100, end: 500 } });
    pointerFocus(link(ctx.el, '/a'));
    expect(ctx.engine.scrollTo).not.toHaveBeenCalled();
    keyboardFocus(link(ctx.el, '/b'));
    expect(ctx.engine.scrollTo).toHaveBeenCalledTimes(1);
    expect(ctx.engine.scrollTo).toHaveBeenCalledWith(500, { immediate: true });
    expect(scrollIntoView).not.toHaveBeenCalled();

    // The context revert leaves the scrubbed track at its start transform; the cleanup clears it.
    const track = ctx.el.querySelector<HTMLElement>('[data-track]') as HTMLElement;
    gsap.set(track, { x: 10 });
    expect(track.style.transform).toContain('translate(10px');
    if (typeof cleanup === 'function') cleanup();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(track.style.transform).toBe('');
    expect(html.hasAttribute('data-pins')).toBe(false);
  });

  it("keeps the root's own html[data-pins] after the cleanup", () => {
    document.documentElement.setAttribute('data-pins', '');
    const ctx = context({ wide: true, pinned: true });
    scene.pin?.(ctx);
    const cleanup = scene.setup(ctx);
    if (typeof cleanup === 'function') cleanup();
    expect(document.documentElement.hasAttribute('data-pins')).toBe(true);
  });

  it('wide and pinned with reduced motion: no morph chunk', () => {
    const ctx = context({ wide: true, pinned: true, reduce: true });
    scene.pin?.(ctx);
    scene.setup(ctx);
    expect(ctx.nearViewport).not.toHaveBeenCalled();
  });

  it('a chunk that lands after the cleanup is ignored', async () => {
    const slot: { fire?: () => void } = {};
    const nearViewport = vi.fn((cb: () => void) => {
      slot.fire = cb;
      return () => {};
    });
    const ctx = context({ wide: true, pinned: true, nearViewport });
    scene.pin?.(ctx);
    const cleanup = scene.setup(ctx);
    slot.fire?.();
    if (typeof cleanup === 'function') cleanup();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(addMorphs).not.toHaveBeenCalled();
  });
});

describe('services scene under 1024 px, the phone scroll set (phone spec scene 3, U-PH10)', () => {
  it('the row container slides and the mark settles as they enter; the cards never move', () => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = context({ wide: false, pinned: false });
    const track = ctx.el.querySelector<HTMLElement>('[data-track]') as HTMLElement;
    const mark = ctx.el.querySelector<HTMLElement>('[data-mark]') as HTMLElement;
    // Both below the bar top at creation (jsdom lays nothing out: every other rect is at 0).
    for (const el of [track, mark]) {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 2000 } as DOMRect);
    }
    const cleanup = scene.setup(ctx);
    const triggers = ScrollTrigger.getAll();
    expect(triggers.map((t) => t.trigger)).toEqual([track, mark]);
    expect(track.hasAttribute('data-scrub')).toBe(true);
    expect(mark.hasAttribute('data-scrub')).toBe(true);
    // Slide: x from the inline start by the gutter (LTR in jsdom: -16) and opacity; Settle: scale
    // and opacity.
    expect(track.style.transform).toContain('translate(-16px');
    expect(mark.style.transform).toContain('scale(0.94');
    for (const card of track.children) expect((card as HTMLElement).style.transform).toBe('');

    if (typeof cleanup === 'function') cleanup();
    triggers.forEach((t) => t.kill());
  });

  it('a row already above the bar top at creation gets no entrance (rule 2.2-5)', () => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = context({ wide: false, pinned: false });
    scene.setup(ctx);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(ctx.el.querySelector<HTMLElement>('[data-track]')?.style.transform).toBe('');
  });

  it('from 1024 px nothing scrubs', () => {
    gsap.registerPlugin(ScrollTrigger);
    const ctx = context({ wide: true, pinned: false });
    for (const el of ctx.el.querySelectorAll('[data-track], [data-mark]')) {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 2000 } as DOMRect);
    }
    scene.setup(ctx);
    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(ctx.el.querySelectorAll('[data-scrub]')).toHaveLength(0);
  });
});
