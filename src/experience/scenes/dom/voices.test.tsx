import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PHONE_MOTION } from './phone';
import { fakeContext, killAll, observers, registerScrollTrigger } from './sceneTest';
import voices from './voices';

beforeAll(registerScrollTrigger);
afterEach(killAll);

function section(direction: 'rtl' | 'ltr') {
  const el = document.createElement('div');
  // The server state (VoicesSection): the row focusable, the buttons' box invisible and inert.
  el.innerHTML = `<ul data-world-slot="voices" tabindex="0"><li></li><li></li></ul>
    <div data-voices-nav class="invisible" inert><button data-dir="-1"></button><button data-dir="1"></button></div>`;
  document.body.append(el);
  const row = el.querySelector<HTMLElement>('ul')!;
  row.style.direction = direction;
  row.style.columnGap = '16px';
  const [first, last] = Array.from(row.children);
  first!.getBoundingClientRect = () => ({ width: 300 }) as DOMRect;
  const scrollBy = vi.fn();
  row.scrollBy = scrollBy as unknown as HTMLElement['scrollBy'];
  const nav = el.querySelector<HTMLElement>('[data-voices-nav]')!;
  const [prev, next] = Array.from(nav.querySelectorAll('button'));
  return { el, row, nav, first: first!, last: last!, prev: prev!, next: next!, scrollBy };
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The buttons as the reader meets them: [hidden, invisible, inert]. */
const navState = (nav: HTMLElement) => [
  nav.hidden,
  nav.classList.contains('invisible'),
  nav.hasAttribute('inert'),
];

/** The observer of the last `setup`, with the first card in full view and the last one not. */
function observed(first: Element, last: Element) {
  const observer = observers.at(-1)!;
  observer.fire(
    new Map([
      [first, 1],
      [last, 0.4],
    ]),
  );
  return observer;
}

describe('scene 8 voices', () => {
  it('VC1 becomes a focusable snap row with buttons that move it by one card, in reading direction', async () => {
    const { el, row, nav, first, last, prev, next, scrollBy } = section('rtl');
    const cleanup = voices.setup(fakeContext('voices', el));
    // The switch waits one frame: the engine's creation task forces no layout, and its resize
    // observer reports the new height after its first report.
    expect(row.hasAttribute('data-carousel')).toBe(false);
    await Promise.resolve();
    expect(row.hasAttribute('data-carousel')).toBe(false);
    await frame();
    expect(row.hasAttribute('data-carousel')).toBe(true);
    expect(Array.from(row.children, (li) => (li as HTMLElement).style.opacity)).toEqual(['0', '0']);
    // From 1024 px the buttons wait for the observer: hidden until the row reports an overflow.
    expect(navState(nav)).toEqual([true, false, false]);
    observed(first, last);
    expect(navState(nav)).toEqual([false, false, false]);
    next.click();
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -316, behavior: 'smooth' });
    prev.disabled = false;
    prev.click();
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 316, behavior: 'smooth' });

    const ltr = section('ltr');
    voices.setup(fakeContext('voices', ltr.el));
    await frame();
    observed(ltr.first, ltr.last);
    ltr.next.click();
    expect(ltr.scrollBy).toHaveBeenLastCalledWith({ left: 316, behavior: 'smooth' });

    if (typeof cleanup === 'function') cleanup();
    expect(row.hasAttribute('data-carousel')).toBe(false);
    expect(row.tabIndex).toBe(0); // the server's, untouched
    expect(navState(nav)).toEqual([false, true, true]); // the server state again
    next.click();
    expect(scrollBy).toHaveBeenCalledTimes(2);
  });

  it('VC2 a cleanup before the frame cancels the switch', async () => {
    const { el, row, nav, next, scrollBy } = section('rtl');
    const cleanup = voices.setup(fakeContext('voices', el));
    if (typeof cleanup === 'function') cleanup();
    await frame();
    expect(row.hasAttribute('data-carousel')).toBe(false);
    expect(navState(nav)).toEqual([false, true, true]);
    expect(observers).toHaveLength(0);
    next.click();
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it('VC3 without the row or the buttons the scene does nothing', () => {
    const el = document.createElement('div');
    el.innerHTML = '<ul data-world-slot="voices"><li></li></ul>';
    document.body.append(el);
    expect(voices.setup(fakeContext('voices', el))).toBeUndefined();
    expect((el.querySelector('li') as HTMLElement).style.opacity).toBe('');
  });

  it('VC4 the ends: the button at an end in full view is disabled, both ends in view hide the buttons; the cleanup restores them', async () => {
    const { el, row, nav, first, last, prev, next } = section('rtl');
    const cleanup = voices.setup(fakeContext('voices', el));
    await frame();
    expect(nav.hidden).toBe(true); // nothing reported yet: no layout was forced for it
    const observer = observers.at(-1)!;
    expect(observer.options).toEqual({ root: row, threshold: 0.99 });
    expect(observer.targets).toEqual([first, last]);
    observer.fire(
      new Map([
        [first, 1],
        [last, 0.4],
      ]),
    );
    expect([nav.hidden, prev.disabled, next.disabled]).toEqual([false, true, false]);
    observer.fire(
      new Map([
        [first, 0],
        [last, 1],
      ]),
    );
    expect([nav.hidden, prev.disabled, next.disabled]).toEqual([false, false, true]);
    observer.fire(new Map([[first, 0.995]]));
    expect([nav.hidden, prev.disabled, next.disabled]).toEqual([true, true, true]);
    if (typeof cleanup === 'function') cleanup();
    expect(observer.disconnected).toBe(true);
    expect([prev.disabled, next.disabled]).toEqual([false, false]);
    expect(navState(nav)).toEqual([false, true, true]);
  });

  it('VC5 under 1024 px (D24): no carousel switch, the row slides in from the inline start, the buttons show and work at the ends without ever hiding', async () => {
    const { el, row, nav, first, last, prev, next, scrollBy } = section('rtl');
    const conditions = { reduce: false, fine: false, wide: false };
    const cleanup = voices.setup(fakeContext('voices', el, { conditions }));
    // Slide: the row's scroll container, never its cards.
    expect(ScrollTrigger.getAll().map((t) => t.trigger)).toEqual([row]);
    expect(ScrollTrigger.getAll()[0]?.vars).toMatchObject({
      scrub: PHONE_MOTION.lagS,
      end: 'clamp(top 75%)',
    });
    expect(gsap.getProperty(row, 'x')).toBe(PHONE_MOTION.slide.x);
    expect(Array.from(row.children, (li) => li.getAttribute('style'))).toEqual([null, null]);
    await frame();
    expect(row.hasAttribute('data-carousel')).toBe(false);
    expect(navState(nav)).toEqual([false, false, false]);
    const observer = observers.at(-1)!;
    observer.fire(
      new Map([
        [first, 1],
        [last, 1],
      ]),
    );
    // Every voice in view: both ends disabled, and the box stays.
    expect([nav.hidden, prev.disabled, next.disabled]).toEqual([false, true, true]);
    observer.fire(new Map([[last, 0.3]]));
    next.click();
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -316, behavior: 'smooth' });
    if (typeof cleanup === 'function') cleanup();
    expect(navState(nav)).toEqual([false, true, true]);
  });
});
