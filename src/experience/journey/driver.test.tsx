import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AWAY_ATTR, LIFTOFF_EVENT, STAGE_ATTR } from './attrs';
import { createJourney, type Frame } from './driver';

const triggers = vi.hoisted(() => ({
  created: [] as { onUpdate: () => void; kill: ReturnType<typeof vi.fn> }[],
}));
vi.mock('gsap/ScrollTrigger', () => ({
  ScrollTrigger: {
    create: (vars: { onUpdate: () => void }) => {
      const trigger = { onUpdate: vars.onUpdate, kill: vi.fn() };
      triggers.created.push(trigger);
      return trigger;
    },
  },
}));

function place(el: Element, top: number, height = 100, left = 0, width = 100) {
  const box = { top, left, width, height, right: left + width, bottom: top + height } as DOMRect;
  Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => box });
  Object.defineProperty(el, 'getClientRects', { configurable: true, value: () => [box] });
}

const VIEW_H = 800;
const DOC_H = 6000;
/** Lays the page out for the scroll position: every box keeps its document place. */
function layout(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  const at = (sel: string, top: number, h = 100) => place(document.querySelector(sel)!, top - y, h);
  at('[data-dock="services"]', 1000);
  at('[data-smile-photo]', 2500, 400);
  at('[data-dock="smile"]', 2500, 400);
  at('[data-home-section="booking"] > section', 4000, 900);
  at('[data-scene="footer"]', 5300, 700);
  at('[data-dock="footer"]', 5600, 120);
  at('[data-dock="restoration"]', 1800);
}

let ticks: ((t: number, dt: number) => void)[] = [];
const engine = {
  onTick: vi.fn((cb: (t: number, dt: number) => void) => {
    ticks.push(cb);
    return () => {
      ticks = ticks.filter((c) => c !== cb);
    };
  }),
};
const runTicks = (n: number) => {
  for (let i = 0; i < n; i += 1) for (const cb of [...ticks]) cb(i / 60, 1 / 60);
};

beforeEach(() => {
  triggers.created = [];
  ticks = [];
  engine.onTick.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: DOC_H,
  });
  document.body.innerHTML = `
    <div id="root">
      <div data-dock="services"></div>
      <div data-dock="restoration"></div>
      <div data-smile-photo=""></div><div data-dock="smile"></div>
      <div data-home-section="booking"><section></section></div>
      <div data-scene="footer"><div data-dock="footer"></div></div>
    </div>`;
  layout(0);
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

function start(tier = 1) {
  const frames: Frame[] = [];
  const journey = createJourney({
    root: document.getElementById('root')!,
    engine,
    tier,
    render: (frame) => frames.push(frame),
  });
  return { journey, frames, last: () => frames.at(-1)! };
}

describe('journey driver', () => {
  it('DR1 on start: stages transparent over the bands, the molar art away, the first frame drawn', () => {
    const { last, journey } = start();
    const html = document.documentElement;
    expect(html.hasAttribute(STAGE_ATTR)).toBe(true);
    expect(
      document.querySelector('[data-dock="restoration"]')!.hasAttribute('data-world-live'),
    ).toBe(true);
    expect(last().pose.dock).toBe('services');
    expect(last().bands.map((b) => b.id)).toEqual(['booking', 'footer']);
    expect(last().bands[0]).toEqual({ id: 'booking', top: 4000, height: 900 });
    // Before the smile station the photo waits for the arch.
    expect(document.querySelector<HTMLElement>('[data-smile-photo]')!.style.opacity).toBe('0');
    // The courier has not landed on the footer: the part is away.
    expect(document.querySelector('[data-dock="footer"]')!.hasAttribute(AWAY_ATTR)).toBe(true);
    journey.destroy();
    expect(html.hasAttribute(STAGE_ATTR)).toBe(false);
    expect(document.querySelector('[data-dock="footer"]')!.hasAttribute(AWAY_ATTR)).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-smile-photo]')!.style.opacity).toBe('');
    expect(triggers.created[0]!.kill).toHaveBeenCalled();
  });

  it('DR2 a scroll wakes the tick; it lets go after a few still frames (no loop at rest)', () => {
    const { frames, journey } = start();
    expect(ticks).toHaveLength(0);
    layout(2700);
    triggers.created[0]!.onUpdate();
    expect(ticks).toHaveLength(1);
    runTicks(3);
    expect(frames.at(-1)!.scrollY).toBe(2700);
    runTicks(20);
    expect(ticks).toHaveLength(0);
    journey.destroy();
  });

  it('DR3 the footer hand-off: the part shows once the courier lands, and goes home when it lifts off', () => {
    const { journey } = start();
    const part = document.querySelector<HTMLElement>('[data-dock="footer"]')!;
    const lift = vi.fn();
    part.addEventListener(LIFTOFF_EVENT, lift);
    layout(DOC_H - VIEW_H);
    journey.measure();
    expect(journey.pose().hidden).toBe(true);
    expect(part.hasAttribute(AWAY_ATTR)).toBe(false);
    expect(lift).not.toHaveBeenCalled();
    layout(3000);
    journey.measure();
    expect(part.hasAttribute(AWAY_ATTR)).toBe(true);
    expect(lift).toHaveBeenCalledTimes(1);
    journey.destroy();
  });

  it('DR4 the smile photo follows the pose; the WebGL courier takes over and hands back at the same pose', () => {
    const { journey, last } = start(2);
    layout(DOC_H - VIEW_H - 400);
    journey.measure();
    expect(document.querySelector<HTMLElement>('[data-smile-photo]')!.style.opacity).toBe('1');
    expect(last().webgl).toBe(false);
    journey.setWebgl(true);
    expect(last().webgl).toBe(true);
    expect(journey.webgl()).toBe(true);
    const pose = last().pose;
    journey.setWebgl(false);
    expect(last().webgl).toBe(false);
    expect(last().pose).toEqual(pose);
    journey.destroy();
    // A destroyed driver ignores late calls (an unmounting canvas).
    const count = journey.webgl();
    journey.setWebgl(true);
    expect(journey.webgl()).toBe(count);
  });
});
