import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AWAY_ATTR, HERE_ATTR, LIFTOFF_EVENT, STAGE_ATTR } from './attrs';
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
    // D2 is the services mark's own box: the courier stands in for it while the journey runs.
    const servicesMark = document.querySelector('[data-dock="services"]')!;
    expect(servicesMark.hasAttribute(HERE_ATTR)).toBe(true);
    expect(last().bands.map((b) => b.id)).toEqual(['booking', 'footer']);
    expect(last().bands[0]).toEqual({ id: 'booking', top: 4000, height: 900 });
    // Before the smile station the photo waits for the arch.
    expect(document.querySelector<HTMLElement>('[data-smile-photo]')!.style.opacity).toBe('0');
    // The courier has not landed on the footer: the part is away.
    expect(document.querySelector('[data-dock="footer"]')!.hasAttribute(AWAY_ATTR)).toBe(true);
    journey.destroy();
    expect(html.hasAttribute(STAGE_ATTR)).toBe(false);
    expect(servicesMark.hasAttribute(HERE_ATTR)).toBe(false);
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

  it('DR9 no scroll tick plans a lane: the planning runs only in idle slots', () => {
    const idle: ((d: { timeRemaining(): number }) => void)[] = [];
    vi.stubGlobal('requestIdleCallback', (cb: (d: { timeRemaining(): number }) => void) => {
      idle.push(cb);
      return idle.length;
    });
    vi.stubGlobal('cancelIdleCallback', () => {});
    const { journey } = start();
    const lanes = journey.lanes()!;
    const before = lanes.stats();
    // A long scroll through every travel, ticking, with no idle slot run.
    for (let y = 0; y <= 6000; y += 150) {
      layout(y);
      triggers.created[0]!.onUpdate();
      runTicks(2);
    }
    expect(lanes.stats()).toEqual(before);
    expect(before.planned).toBe(0);
    // An idle slot plans; the next tick only reads what it planned.
    while (idle.length > 0) idle.shift()!({ timeRemaining: () => 50 });
    expect(lanes.stats().planned).toBeGreaterThan(0);
    const planned = lanes.stats();
    runTicks(3);
    expect(lanes.stats()).toEqual(planned);
    journey.destroy();
  });

  it('DR10 without an idle callback (WebKit) a slot ends after about 8 ms; it never plans every travel in one task', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.stubGlobal('cancelIdleCallback', undefined);
    // A width no other test uses: the planned lanes are kept per viewport across tests.
    const width = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 913 });
    const slots: (() => void)[] = [];
    const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(((cb: () => void) => {
      slots.push(cb);
      return slots.length;
    }) as unknown as typeof window.setTimeout);
    const { journey } = start();
    const lanes = journey.lanes()!;
    let longest = 0;
    let count = 0;
    while (slots.length > 0) {
      const t0 = performance.now();
      slots.shift()!();
      longest = Math.max(longest, performance.now() - t0);
      count += 1;
    }
    const { planned, ms } = lanes.stats();
    // The planning took several slots, none much past its 8 ms (one route step may overrun).
    expect(planned).toBeGreaterThan(0);
    expect(ms).toBeGreaterThan(40);
    expect(count).toBeGreaterThan(2);
    expect(longest).toBeLessThan(ms / 2);
    timeout.mockRestore();
    journey.destroy();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
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

  it('DR17 the header logo (D1 from 1024 px): its mark is away only while the courier is out of it; the footer part keeps its own state; under 1024 px the logo keeps its mark', () => {
    const header = document.createElement('header');
    header.innerHTML = '<a href="/"><svg><svg data-dock="header"></svg></svg></a>';
    document.body.prepend(header);
    const mark = header.querySelector('[data-dock="header"]')!;
    place(mark, 20, 24, 1290, 19);
    const width = (w: number) =>
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (q: string) => ({
          matches: w >= Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0),
        }),
      });
    const part = document.querySelector('[data-dock="footer"]')!;
    width(1440);
    const { journey } = start();
    // At the top the courier is home in the logo: both marks in place (the footer's away).
    expect(journey.pose()).toMatchObject({ dock: 'header', hidden: true });
    expect(mark.hasAttribute(AWAY_ATTR)).toBe(false);
    expect(part.hasAttribute(AWAY_ATTR)).toBe(true);
    // Out of the logo: the logo's mark is away.
    layout(400);
    journey.measure();
    expect(journey.pose().hidden).toBe(false);
    expect(mark.hasAttribute(AWAY_ATTR)).toBe(true);
    // Home in the footer: the footer part has it, the logo still not.
    layout(DOC_H - VIEW_H);
    journey.measure();
    expect(journey.pose()).toMatchObject({ dock: 'footer', hidden: true });
    expect(part.hasAttribute(AWAY_ATTR)).toBe(false);
    expect(mark.hasAttribute(AWAY_ATTR)).toBe(true);
    journey.destroy();
    expect(mark.hasAttribute(AWAY_ATTR)).toBe(false);
    // Under 1024 px the logo is no dock: its mark never steps aside.
    width(1023);
    layout(0);
    const narrow = start();
    layout(400);
    narrow.journey.measure();
    expect(narrow.journey.pose().hidden).toBe(false);
    expect(mark.hasAttribute(AWAY_ATTR)).toBe(false);
    narrow.journey.destroy();
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

  describe('the intro hand-off', () => {
    afterEach(() => {
      delete document.documentElement.dataset.intro;
      performance.clearMarks('intro:end');
      document.getElementById('intro')?.remove();
    });

    it("DR11 born in the intro mark's hole above the cards, it glides to the pose once the overlay lifts; a long frame slows the glide, never skips it", () => {
      document.documentElement.dataset.intro = 'playing';
      document.body.insertAdjacentHTML(
        'beforeend',
        '<dialog id="intro" open><svg class="i-m"></svg></dialog>',
      );
      place(document.querySelector('#intro .i-m')!, 300, 166, 650, 134);
      const { journey, last } = start();
      expect(last()).toMatchObject({ lead: true, born: 0 });
      expect(last().shown.x).toBeCloseTo(717, 6);
      expect(last().shown.y).toBeCloseTo(383, 6);
      expect(last().shown.scale).toBeCloseTo(166 / 0.92, 6);
      // The overlay lifts.
      document.documentElement.dataset.intro = 'done';
      document.dispatchEvent(new CustomEvent('sefid:intro-end'));
      expect(ticks).toHaveLength(1);
      // One long frame (a busy main thread): a 30 fps step of the glide, not half a second.
      for (const cb of [...ticks]) cb(0, 0.5);
      expect(last().born).toBeGreaterThan(0);
      expect(last().born).toBeLessThan(0.1);
      runTicks(9);
      const mid = last();
      expect(mid.born).toBeGreaterThan(0.3);
      expect(mid.born).toBeLessThan(1);
      expect(mid.lead).toBe(true);
      expect(Math.abs(mid.shown.x - mid.pose.x)).toBeGreaterThan(1);
      runTicks(40);
      expect(last()).toMatchObject({ lead: false, born: 1 });
      expect(last().shown.x).toBeCloseTo(last().pose.x, 6);
      // Then the tick sleeps again.
      runTicks(20);
      expect(ticks).toHaveLength(0);
      journey.destroy();
    });

    it("DR12 a journey that comes up to 800 ms after the intro glides from the mark's place; later, or with no intro, none", () => {
      const width = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 913 });
      document.documentElement.dataset.intro = 'done';
      performance.mark('intro:end');
      const late = start();
      // 913 px: the lockup at .42 (introMark.ts), its mark at (50 %, 42 %) of the viewport.
      expect(late.last()).toMatchObject({ lead: true, born: 0 });
      expect(late.last().shown.x).toBeCloseTo(456.5, 6);
      expect(late.last().shown.y).toBeCloseTo(0.42 * VIEW_H, 6);
      expect(late.last().shown.scale).toBeCloseTo((331.68 * 0.42) / 0.92, 6);
      expect(ticks).toHaveLength(1);
      runTicks(40);
      expect(late.last()).toMatchObject({ lead: false, born: 1 });
      late.journey.destroy();
      // Long after the intro, and with no intro at all: the courier starts on its pose.
      const ended = performance.getEntriesByName('intro:end')[0]!.startTime;
      const now = vi.spyOn(performance, 'now').mockReturnValue(ended + 2000);
      const after = start();
      expect(after.last()).toMatchObject({ lead: false, born: 1 });
      after.journey.destroy();
      now.mockRestore();
      delete document.documentElement.dataset.intro;
      const none = start();
      expect(none.last()).toMatchObject({ lead: false, born: 1 });
      none.journey.destroy();
      // A phone (D1 below the first screen): never a glide, late or not.
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      document.documentElement.dataset.intro = 'done';
      performance.clearMarks('intro:end');
      performance.mark('intro:end');
      const phone = start();
      expect(phone.last()).toMatchObject({ lead: false, born: 1 });
      expect(phone.journey.handoff()).toBeNull();
      expect(ticks).toHaveLength(0);
      phone.journey.destroy();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    });

    /** The intro playing with its dialog, the mark's box at (650, 300) 134 by 166. */
    const playing = () => {
      document.documentElement.dataset.intro = 'playing';
      document.body.insertAdjacentHTML(
        'beforeend',
        '<dialog id="intro" open><svg class="i-m"></svg></dialog>',
      );
      place(document.querySelector('#intro .i-m')!, 300, 166, 650, 134);
    };
    const lift = (detail: { skipped: boolean; reduced: boolean } | null = null) => {
      document.documentElement.dataset.intro = 'done';
      document.dispatchEvent(new CustomEvent('sefid:intro-end', { detail }));
    };
    const opens = async () => {
      document.getElementById('intro')!.classList.add('s3');
      // The frame's opening reaches the driver through a mutation observer (a microtask).
      await Promise.resolve();
    };

    it('DR13 in the hole the tick sleeps: a planning slot wakes it, and it lets go after a few still frames', () => {
      vi.stubGlobal('requestIdleCallback', undefined);
      vi.stubGlobal('cancelIdleCallback', undefined);
      const slots: (() => void)[] = [];
      const timeout = vi.spyOn(window, 'setTimeout').mockImplementation(((cb: () => void) => {
        slots.push(cb);
        return slots.length;
      }) as unknown as typeof window.setTimeout);
      playing();
      const { journey } = start();
      expect(journey.handoff()).toBe('hole');
      // The idle (here the timer) slot plans and wakes the tick.
      while (slots.length > 0) slots.shift()!();
      expect(ticks).toHaveLength(1);
      runTicks(20);
      expect(journey.handoff()).toBe('hole');
      expect(ticks).toHaveLength(0);
      timeout.mockRestore();
      journey.destroy();
    });

    it('DR14 a phone: the mark fades out in the hole as the frame opens, then the courier is on its pose, no glide', async () => {
      const width = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      playing();
      const { journey, last } = start();
      expect(last()).toMatchObject({ lead: true, born: 0, holeOut: false });
      await opens();
      expect(journey.handoffMode()).toBe('fade');
      expect(last()).toMatchObject({ lead: true, born: 0, holeOut: true });
      const after = vi.fn();
      journey.afterHandoff(after);
      lift();
      expect(after).toHaveBeenCalledOnce();
      expect(last()).toMatchObject({ lead: false, born: 1, holeOut: false });
      expect(last().shown.x).toBeCloseTo(last().pose.x, 6);
      expect(journey.handoff()).toBeNull();
      expect(ticks).toHaveLength(0);
      journey.destroy();
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    });

    it('DR15 a card on the way: no glide frame may touch it, so the mark fades in the hole', async () => {
      document
        .getElementById('root')!
        .insertAdjacentHTML(
          'afterbegin',
          '<div data-above-courier=""><div class="card"></div></div>',
        );
      // Across the way from the hole (717, 383) down to the services dock.
      place(document.querySelector('.card')!, 500, 60, 0, 1024);
      playing();
      const { journey, last } = start();
      await opens();
      expect(journey.handoffMode()).toBe('fade');
      lift();
      expect(last()).toMatchObject({ lead: false, born: 1 });
      journey.destroy();
    });

    it('DR16 reduced motion switched on during the intro: no glide; a resize mid-glide ends it', async () => {
      playing();
      const reduced = start();
      await opens();
      expect(reduced.journey.handoffMode()).toBe('glide');
      lift({ skipped: true, reduced: true });
      expect(reduced.last()).toMatchObject({ born: 1 });
      expect(reduced.journey.handoff()).toBeNull();
      expect(ticks).toHaveLength(0);
      reduced.journey.destroy();
      document.getElementById('intro')!.remove();
      playing();
      const resized = start();
      lift();
      runTicks(5);
      expect(resized.journey.handoff()).toBe('glide');
      expect(resized.last().born).toBeLessThan(1);
      resized.journey.measure();
      expect(resized.journey.handoff()).toBeNull();
      expect(resized.last().born).toBe(1);
      expect(resized.last().shown.x).toBeCloseTo(resized.last().pose.x, 6);
      resized.journey.destroy();
    });
  });
});
