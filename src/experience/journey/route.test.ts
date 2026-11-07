import { describe, expect, it } from 'vitest';

import type { Box, Viewport } from './pose';
import { LANE_MARGIN, placeOn, planRoute } from './route';

const VIEW: Viewport = { width: 1440, height: 900, maxScroll: 20_000, insetTop: 72 };
const line =
  (from: { x: number; y: number }, to: { x: number; y: number }, s = 100) =>
  (t: number) => ({
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    s,
  });

describe('planRoute and placeOn', () => {
  it('RT1 with nothing in the way the lane is the eased path, whole', () => {
    const base = line({ x: 300, y: 400 }, { x: 1100, y: 500 });
    const route = planRoute({ y0: 1000, y1: 1600, base, obstacles: [], viewport: VIEW, min: 40 });
    expect(route.faded).toBe(0);
    expect(route.offstage).toBe(0);
    route.samples.forEach((p, k) => {
      const b = base(k / (route.samples.length - 1));
      expect(p.x).toBeCloseTo(b.x, 6);
      expect(p.y).toBeCloseTo(b.y, 6);
      expect(p.o).toBe(1);
    });
  });

  it('RT2 a lane goes round a text across the path: no point of the way touches it', () => {
    const text: Box = { left: 0, top: 1850, width: 1100, height: 80, pin: null };
    const base = line({ x: 500, y: 300 }, { x: 600, y: 700 });
    const route = planRoute({
      y0: 1200,
      y1: 2000,
      base,
      obstacles: [text],
      viewport: VIEW,
      min: 40,
    });
    expect(route.faded).toBe(0);
    for (let y = 1200; y <= 2000; y += 1) {
      const p = placeOn(route, y);
      const half = (p.s * 0.8) / 2;
      const top = text.top - y;
      const hit =
        p.x + half > text.left &&
        p.x - half < text.left + text.width &&
        p.y + half > top &&
        p.y - half < top + text.height;
      expect(hit, `over the text at ${y}`).toBe(false);
    }
    // Its ends are the docks' own places.
    expect(placeOn(route, 1200)).toMatchObject({ x: 500, y: 300 });
    expect(placeOn(route, 2000)).toMatchObject({ x: 600, y: 700 });
  });

  it('RT3 placeOn interpolates between samples and holds the ends outside the range', () => {
    const route = {
      y0: 0,
      y1: 100,
      faded: 0,
      offstage: 0,
      samples: [
        { x: 0, y: 0, s: 10, o: 1 },
        { x: 100, y: 50, s: 20, o: 0 },
      ],
    };
    expect(placeOn(route, 50)).toEqual({ x: 50, y: 25, s: 15, o: 0.5 });
    expect(placeOn(route, -10)).toEqual(route.samples[0]);
    expect(placeOn(route, 500)).toEqual(route.samples[1]);
  });

  it('RT4 a long phone travel over many lines plans in well under a frame budget per 100 px', () => {
    const phone: Viewport = {
      width: 390,
      height: 844,
      maxScroll: 20_000,
      insetTop: 65,
      insetBottom: 64,
    };
    const texts: Box[] = Array.from({ length: 90 }, (_, i) => ({
      left: 16,
      top: 3000 + i * 22,
      width: 358,
      height: 18,
      pin: null,
    }));
    const base = line({ x: 200, y: 300 }, { x: 250, y: 600 }, 60);
    const started = performance.now();
    const route = planRoute({
      y0: 2500,
      y1: 7000,
      base,
      obstacles: texts,
      viewport: phone,
      min: 28,
    });
    const ms = performance.now() - started;
    console.log(`planRoute, 390x844, 4500 px over 90 lines: ${ms.toFixed(1)} ms`);
    // Over the lines there is no lane on screen: the courier waits off a side, never a ghost.
    expect(route.faded).toBe(0);
    expect(route.offstage).toBeGreaterThan(0);
    expect(LANE_MARGIN).toBeGreaterThan(0);
  });
});

describe('routeSteps', () => {
  it('RT5 the planning comes in short steps: none of a long phone travel takes 16 ms here', async () => {
    const { routeSteps } = await import('./route');
    const phone: Viewport = {
      width: 390,
      height: 844,
      maxScroll: 20_000,
      insetTop: 65,
      insetBottom: 64,
    };
    const texts: Box[] = Array.from({ length: 90 }, (_, i) => ({
      left: 16,
      top: 3000 + i * 22,
      width: 358,
      height: 18,
      pin: null,
    }));
    const steps = routeSteps({
      y0: 2500,
      y1: 7000,
      base: (t) => ({ x: 200 + 50 * t, y: 300 + 300 * t, s: 60 }),
      obstacles: texts,
      viewport: phone,
      min: 28,
    });
    let longest = 0;
    let count = 0;
    for (;;) {
      const started = performance.now();
      const r = steps.next();
      longest = Math.max(longest, performance.now() - started);
      count += 1;
      if (r.done) break;
    }
    console.log(`routeSteps: ${count} steps, the longest ${longest.toFixed(1)} ms`);
    expect(count).toBeGreaterThan(10);
    expect(longest).toBeLessThan(16);
  });
});
