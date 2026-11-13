import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isDockId, measureDocks, measureHeader, measureObstacles, measureViewport } from './docks';

/** Gives `el` a viewport rect (jsdom lays nothing out); `rendered: false` is `display: none`. */
function place(
  el: Element,
  rect: { top: number; left?: number; w?: number; h?: number },
  rendered = true,
) {
  const box = {
    top: rect.top,
    left: rect.left ?? 0,
    width: rect.w ?? 100,
    height: rect.h ?? 100,
    right: (rect.left ?? 0) + (rect.w ?? 100),
    bottom: rect.top + (rect.h ?? 100),
    x: rect.left ?? 0,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRect;
  Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => box });
  Object.defineProperty(el, 'getClientRects', {
    configurable: true,
    value: () => (rendered ? [box] : []),
  });
}

/** The viewport's width as the CSS breakpoints see it (matchMedia `min-width`). */
const viewWidth = (w: number) =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({ matches: w >= Number(/min-width:\s*(\d+)px/.exec(q)?.[1] ?? 0) }),
  });

const scrollTo = (y: number) =>
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });

beforeEach(() => {
  document.documentElement.style.setProperty('--nav-h', '64px');
  scrollTo(0);
});
afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.removeAttribute('style');
});

describe('measureHeader', () => {
  it('DK11 the header logo mark is D1, pinned over the whole scroll at its viewport top; the header controls but the logo are obstacles', () => {
    document.body.innerHTML = `
      <header>
        <a id="logo" href="/"><svg><svg id="mark" data-dock="header"></svg></svg></a>
        <a id="nav" href="/x">x</a><button id="menu">m</button><a id="gone" href="/y">y</a>
        <div popover><a id="mega" href="/z">z</a></div>
      </header>`;
    scrollTo(2400);
    viewWidth(1440);
    place(document.getElementById('logo')!, { top: 12, left: 1200, w: 120, h: 44 });
    place(document.getElementById('mark')!, { top: 16, left: 1290, w: 19, h: 24 });
    place(document.getElementById('nav')!, { top: 14, left: 900, w: 80, h: 44 });
    place(document.getElementById('menu')!, { top: 14, left: 40, w: 44, h: 44 });
    place(document.getElementById('gone')!, { top: 14 }, false);
    // An open mega-menu's link is no obstacle: it is gone at the next measure.
    place(document.getElementById('mega')!, { top: 80, left: 600, w: 200, h: 44 });
    const { dock, obstacles } = measureHeader();
    const pin = { start: 0, end: Infinity };
    expect(dock).toEqual({ id: 'header', left: 1290, top: 16, width: 19, height: 24, pin });
    expect(obstacles).toEqual([
      { left: 900, top: 14, width: 80, height: 44, pin },
      { left: 40, top: 14, width: 44, height: 44, pin },
    ]);
  });

  it('DK12 no logo with a dock (another page), or under 1024 px (the hero cards span the screen): no D1 and no obstacles', () => {
    viewWidth(1440);
    document.body.innerHTML = `<header><a href="/"><svg></svg></a></header>`;
    expect(measureHeader()).toEqual({ dock: null, obstacles: [] });
    document.body.innerHTML = `<header><a href="/"><svg><svg id="mark" data-dock="header"></svg></svg></a></header>`;
    place(document.getElementById('mark')!, { top: 16, left: 300, w: 19, h: 24 });
    viewWidth(1023);
    expect(measureHeader()).toEqual({ dock: null, obstacles: [] });
    viewWidth(1024);
    expect(measureHeader().dock).not.toBeNull();
  });
});

describe('measureDocks', () => {
  it('DK1 reads every rendered dock in document px; unknown ids and hidden boxes are left out', () => {
    document.body.innerHTML = `
      <div data-dock="services"></div>
      <div data-dock="nope"></div>
      <div data-dock="dentists"></div>
      <div data-dock="booking"></div>`;
    const [hero, nope, dentists, booking] = Array.from(document.querySelectorAll('[data-dock]'));
    scrollTo(300);
    place(hero!, { top: 700, left: 40, w: 288, h: 144 });
    place(nope!, { top: 900 });
    place(dentists!, { top: 1200 }, false);
    place(booking!, { top: 1500, w: 0, h: 0 });
    expect(measureDocks()).toEqual([
      { id: 'services', left: 40, top: 1000, width: 288, height: 144, pin: null },
    ]);
    expect(isDockId('header')).toBe(true);
    expect(isDockId('hero')).toBe(false);
    expect(isDockId('nope')).toBe(false);
    expect(isDockId(undefined)).toBe(false);
  });

  it('DK2 a dock in a stuck stage is measured at its place in flow, with the pin of its room', () => {
    document.body.innerHTML = `
      <div><div id="stage" style="position: sticky"><div data-dock="services"></div></div>
      <div id="room" data-pin-room=""></div></div>`;
    const stage = document.getElementById('stage')!;
    const room = document.getElementById('room')!;
    const dock = document.querySelector('[data-dock]')!;
    // Scrolled 600 px into the pin: the stage sits under the 64 px nav, its room scrolls on.
    scrollTo(2000);
    place(stage, { top: 64, h: 836 });
    place(dock, { top: 64 + 200, left: 300, w: 160, h: 128 });
    place(room, { top: 836 - 600 + 64, h: 1800 });
    const [measured] = measureDocks();
    // The stage's flow top: the room's document top less the stage's height.
    const flowTop = 2000 + 300 - 836;
    expect(measured).toEqual({
      id: 'services',
      left: 300,
      top: flowTop + 200,
      width: 160,
      height: 128,
      pin: { start: flowTop - 64, end: flowTop - 64 + 1800 },
    });
    // The same box measured before the pin gives the same numbers.
    scrollTo(0);
    place(stage, { top: flowTop, h: 836 });
    place(dock, { top: flowTop + 200, left: 300, w: 160, h: 128 });
    place(room, { top: flowTop + 836, h: 1800 });
    expect(measureDocks()[0]).toEqual(measured);
  });

  it('DK4 a dock moved by a transform (the thrown footer part) is measured at its home', () => {
    document.body.innerHTML = `
      <div id="field" style="position: relative">
        <div data-dock="footer" style="transform: translate(-160px, -60px)"></div>
      </div>`;
    const field = document.getElementById('field')!;
    const part = document.querySelector<HTMLElement>('[data-dock]')!;
    scrollTo(1000);
    place(field, { top: 200, left: 40, w: 1200, h: 440 });
    // Home: 1100 px in and 300 px down the field; drawn 160 px left and 60 px up of it.
    place(part, { top: 200 + 300 - 60, left: 40 + 1100 - 160, w: 96, h: 120 });
    Object.defineProperty(part, 'offsetParent', { configurable: true, value: field });
    Object.defineProperty(part, 'offsetLeft', { configurable: true, value: 1100 });
    Object.defineProperty(part, 'offsetTop', { configurable: true, value: 300 });
    expect(measureDocks()).toEqual([
      { id: 'footer', left: 1140, top: 1500, width: 96, height: 120, pin: null },
    ]);
  });

  it('DK5 the obstacles: every shown text line and control, never decorative or hidden text', () => {
    document.body.innerHTML = `
      <main id="root">
        <p id="lead">two lines</p>
        <div aria-hidden="true"><p>decorative</p></div>
        <p style="visibility: hidden">hidden</p>
        <a id="cta" href="/x"></a>
      </main>`;
    scrollTo(500);
    const lead = document.getElementById('lead')!;
    const lines = [
      { left: 100, top: 40, width: 300, height: 20, right: 400, bottom: 60 },
      { left: 100, top: 62, width: 200, height: 20, right: 300, bottom: 82 },
    ] as DOMRect[];
    // jsdom lays out no text: the lead's two lines, a small box for anything else.
    const other = [{ left: 0, top: 0, width: 50, height: 10, right: 50, bottom: 10 }] as DOMRect[];
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value(this: Range) {
        return this.startContainer.parentElement === lead ? lines : other;
      },
    });
    place(document.getElementById('cta')!, { top: 300, left: 20, w: 120, h: 44 });
    const boxes = measureObstacles(document.getElementById('root')!);
    delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    expect(boxes).toEqual([
      { left: 20, top: 800, width: 120, height: 44, pin: null },
      { left: 100, top: 540, width: 300, height: 42, pin: null },
    ]);
  });

  it('DK10 an invisible tier panel is an obstacle: the scrub shows it without a measure', () => {
    document.body.innerHTML = `
      <main id="root">
        <div data-tier-panel="vip" style="visibility: hidden"><a id="vip" href="/b"></a></div>
        <div style="visibility: hidden"><a id="other" href="/c"></a></div>
      </main>`;
    scrollTo(0);
    place(document.getElementById('vip')!, { top: 300, left: 20, w: 120, h: 44 });
    place(document.getElementById('other')!, { top: 400, left: 20, w: 120, h: 44 });
    Object.defineProperty(Range.prototype, 'getClientRects', {
      configurable: true,
      value: () => [],
    });
    const boxes = measureObstacles(document.getElementById('root')!);
    delete (Range.prototype as { getClientRects?: unknown }).getClientRects;
    expect(boxes).toEqual([{ left: 20, top: 300, width: 120, height: 44, pin: null }]);
  });

  it('DK3 the viewport is the client width, the window height and the scroll range', () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 5000,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1425,
    });
    expect(measureViewport()).toEqual({
      width: 1425,
      height: window.innerHeight,
      maxScroll: 5000 - window.innerHeight,
      insetTop: 0,
      insetBottom: 0,
    });
  });
});

describe('a scrubbed entrance measured at rest', () => {
  it('DK9 a text in a box scaled 0.94 about its centre and lifted 12 px comes back to its place', async () => {
    const { atRest } = await import('./docks');
    // The box at rest: 100..300 x 50..250, its origin its centre (100, 100 from its corner).
    const a = 0.94;
    const t = { e: 0, f: 12 };
    const origin = { x: 100, y: 100 };
    const draw = (x: number, y: number) => ({
      x: 200 + a * (x - 200) + t.e,
      y: 150 + a * (y - 150) + t.f,
    });
    const corner = draw(100, 50);
    const text = { left: 120, top: 200, right: 280, bottom: 230 };
    const tl = draw(text.left, text.top);
    const br = draw(text.right, text.bottom);
    const back = atRest(
      { left: tl.x, top: tl.y, right: br.x, bottom: br.y },
      { left: corner.x, top: corner.y },
      { a, ...t },
      origin,
    );
    expect(back.left).toBeCloseTo(text.left, 6);
    expect(back.top).toBeCloseTo(text.top, 6);
    expect(back.right).toBeCloseTo(text.right, 6);
    expect(back.bottom).toBeCloseTo(text.bottom, 6);
  });
});
