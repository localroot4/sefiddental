// @vitest-environment jsdom
import { gsap } from 'gsap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { TierSettings } from '@/lib/qualityTier';

import type { ScrollEngine } from '../../engine/scrollEngine';
import type { SceneContext } from '../types';

import scene, { riseDistance } from './booking';

const mocks = vi.hoisted(() => ({
  triggers: [] as { vars: { onEnter: () => void }; kill: ReturnType<typeof vi.fn> }[],
}));
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: (vars: { onEnter: () => void }) => {
      const trigger = { vars, kill: vi.fn() };
      mocks.triggers.push(trigger);
      return trigger;
    },
  },
}));

let el: HTMLElement;
let card: HTMLElement;
let input: HTMLInputElement;

function ctx(): SceneContext {
  return {
    id: 'booking',
    el,
    layout: { pinnedScenes: false, lenis: true, latchedAtTier: 1 },
    settings: {} as TierSettings,
    conditions: { reduce: false, fine: true, wide: true },
    engine: {} as ScrollEngine,
    master: {} as gsap.core.Timeline,
    label: 'booking',
    segment: () => ({ start: 0.8, end: 0.9 }),
    nearViewport: () => () => {},
  };
}

/** Where the card sits: jsdom lays nothing out, so the rect is given. */
function placeCard(top: number): void {
  card.getBoundingClientRect = () =>
    ({ top, bottom: top + 600, left: 0, right: 800, width: 800, height: 600 }) as DOMRect;
}

const y = (): number => Number(gsap.getProperty(card, 'y'));

beforeEach(() => {
  el = document.createElement('div');
  el.innerHTML = '<div data-booking-card=""><form><input name="phone" /></form></div>';
  document.body.append(el);
  card = el.querySelector('[data-booking-card]')!;
  input = el.querySelector('input')!;
  mocks.triggers.length = 0;
  window.innerWidth = 1440;
});

afterEach(() => {
  gsap.killTweensOf(card);
  el.remove();
});

describe('riseDistance', () => {
  it('12 px on phones, 24 px from 744 px', () => {
    expect(riseDistance(390)).toBe(12);
    expect(riseDistance(743)).toBe(12);
    expect(riseDistance(744)).toBe(24);
    expect(riseDistance(1440)).toBe(24);
  });
});

describe('booking scene', () => {
  it('a card already on screen stays as the server drew it', () => {
    placeCard(window.innerHeight - 1);
    expect(scene.setup(ctx())).toBeUndefined();
    expect(mocks.triggers).toEqual([]);
    expect(card.style.opacity).toBe('');
  });

  it('a card below the screen waits at the start of its rise and plays on enter', () => {
    placeCard(window.innerHeight + 400);
    const cleanup = scene.setup(ctx());
    expect(typeof cleanup).toBe('function');
    expect(card.style.opacity).toBe('0');
    expect(y()).toBe(24);
    const [rise] = gsap.getTweensOf(card);
    expect(rise!.paused()).toBe(true);
    mocks.triggers[0]!.vars.onEnter();
    expect(rise!.paused()).toBe(false);
    (cleanup as () => void)();
  });

  it('focus inside the card completes the rise at once and kills the trigger', () => {
    window.innerWidth = 390;
    placeCard(window.innerHeight + 400);
    const cleanup = scene.setup(ctx());
    expect(y()).toBe(12);
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(card.style.opacity).toBe('1');
    expect(y()).toBe(0);
    expect(mocks.triggers[0]!.kill).toHaveBeenCalledTimes(1);
    (cleanup as () => void)();
  });

  it('a booking route to the block completes the rise; one to another target does not', () => {
    placeCard(window.innerHeight + 400);
    const cleanup = scene.setup(ctx());
    const route = (target: unknown) =>
      document.dispatchEvent(new CustomEvent('sefid:scroll-to', { detail: { target } }));
    route(document.body);
    route(1200);
    expect(card.style.opacity).toBe('0');
    route(card.querySelector('form'));
    expect(card.style.opacity).toBe('1');
    expect(y()).toBe(0);
    (cleanup as () => void)();
  });

  it('the rise ends before a listener added earlier (the engine) reads the target', () => {
    placeCard(window.innerHeight + 400);
    let seen = '';
    const engine = (): void => {
      seen = card.style.opacity;
    };
    document.addEventListener('sefid:scroll-to', engine);
    const cleanup = scene.setup(ctx());
    document.dispatchEvent(
      new CustomEvent('sefid:scroll-to', { detail: { target: card.querySelector('form') } }),
    );
    expect(seen).toBe('1');
    document.removeEventListener('sefid:scroll-to', engine);
    (cleanup as () => void)();
  });

  it('the cleanup removes its listeners', () => {
    placeCard(window.innerHeight + 400);
    (scene.setup(ctx()) as () => void)();
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    document.dispatchEvent(new CustomEvent('sefid:scroll-to', { detail: { target: input } }));
    expect(mocks.triggers[0]!.kill).not.toHaveBeenCalled();
    expect(card.style.opacity).toBe('0');
  });
});
