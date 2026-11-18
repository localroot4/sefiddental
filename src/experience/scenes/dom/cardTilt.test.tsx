import { gsap } from 'gsap';
import { afterEach, describe, expect, it } from 'vitest';

import { cardTilt, MAX_DEG } from './cardTilt';

const card = (): HTMLElement => {
  const el = document.createElement('article');
  el.getBoundingClientRect = () =>
    ({ left: 100, top: 100, width: 200, height: 100, right: 300, bottom: 200 }) as DOMRect;
  document.body.append(el);
  return el;
};
const move = (el: HTMLElement, x: number, y: number, pointerType = 'mouse') =>
  el.dispatchEvent(
    Object.assign(new MouseEvent('pointermove', { clientX: x, clientY: y }), { pointerType }),
  );
/** The turn once its follow has run its course (the root timeline a second on). */
let clock = 0;
const turn = (el: HTMLElement): [number, number] => {
  clock = Math.max(clock, gsap.ticker.time) + 1;
  gsap.updateRoot(clock);
  return [Number(gsap.getProperty(el, 'rotationX')), Number(gsap.getProperty(el, 'rotationY'))];
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('cardTilt', () => {
  it('CT1 the side under the mouse goes back, at most MAX_DEG; the light follows; a leave turns it back', () => {
    const el = card();
    const cleanup = cardTilt([el], true);
    expect(el.hasAttribute('data-tilt')).toBe(true);
    move(el, 300, 200); // the bottom right corner
    const [x, y] = turn(el);
    expect(y).toBeCloseTo(MAX_DEG, 5);
    expect(x).toBeCloseTo(-MAX_DEG, 5);
    expect(el.style.getPropertyValue('--mx')).toBe('100%');
    expect(el.style.getPropertyValue('--my')).toBe('100%');
    expect(el.hasAttribute('data-lit')).toBe(true);
    // Far past the card's edge: still MAX_DEG.
    move(el, 900, 900);
    expect(turn(el)[1]).toBeCloseTo(MAX_DEG, 5);
    el.dispatchEvent(new Event('pointerleave'));
    expect(turn(el)).toEqual([0, 0]);
    expect(el.hasAttribute('data-lit')).toBe(false);
    cleanup();
  });

  it('CT2 a touch, or a page without a fine pointer, turns nothing; the cleanup takes everything back', () => {
    const el = card();
    const cleanup = cardTilt([el], true);
    move(el, 300, 200, 'touch');
    expect(turn(el)).toEqual([0, 0]);
    move(el, 300, 200);
    cleanup();
    expect(el.hasAttribute('data-tilt')).toBe(false);
    expect(el.hasAttribute('data-lit')).toBe(false);
    expect(el.style.getPropertyValue('--mx')).toBe('');
    expect(turn(el)).toEqual([0, 0]);
    move(el, 300, 200);
    expect(turn(el)).toEqual([0, 0]);
    const off = card();
    cardTilt([off], false)();
    move(off, 300, 200);
    expect(off.hasAttribute('data-tilt')).toBe(false);
    expect(turn(off)).toEqual([0, 0]);
  });
});
