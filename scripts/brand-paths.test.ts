import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  fitToGrid,
  flatten,
  generate,
  GLYPHS,
  iconOutline,
  MARK_PATH,
  parsePath,
  POINTS,
  resample,
  signedArea,
  silhouette,
  startAtTop,
  toPathData,
} from './brand-paths.mjs';

const OUT = path.resolve(__dirname, '../src/brand/serviceIconPaths.ts');

const points = (d: string): [number, number][] =>
  [...d.matchAll(/(-?\d+) (-?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

const square = (size: number, clockwise = true): number[][] => {
  const pts = [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size],
  ];
  return clockwise ? pts : pts.reverse();
};

describe('brand-paths', () => {
  it('resolves relative, shorthand and implicit commands to absolute M, L, C, Q and A', () => {
    expect(parsePath('M10,10h5v5l-5,0z')).toEqual([
      { c: 'M', x: 10, y: 10 },
      { c: 'L', x: 15, y: 10 },
      { c: 'L', x: 15, y: 15 },
      { c: 'L', x: 10, y: 15 },
      { c: 'Z' },
    ]);
    // Implicit L after M; S reflects the previous C's second control point.
    expect(parsePath('M0,0 1,1c1,1,2,2,3,3s2,2,3,3')).toEqual([
      { c: 'M', x: 0, y: 0 },
      { c: 'L', x: 1, y: 1 },
      { c: 'C', x1: 2, y1: 2, x2: 3, y2: 3, x: 4, y: 4 },
      { c: 'C', x1: 5, y1: 5, x2: 6, y2: 6, x: 7, y: 7 },
    ]);
    expect(parsePath('M0,0Q1,2 3,0t3,0').map((cmd) => cmd.c)).toEqual(['M', 'Q', 'Q']);
    expect(parsePath('M0,0a5,5,0,0,1,10,0')[1]).toMatchObject({ c: 'A', rx: 5, x: 10, y: 0 });
    expect(() => parsePath('M0')).toThrow(/number was expected/);
  });

  it('flattens arcs and curves: a two-arc circle keeps its area within one percent', () => {
    const [ring] = flatten(parsePath('M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z'));
    expect(ring).toBeDefined();
    expect(Math.abs(signedArea(ring as number[][]))).toBeCloseTo(Math.PI * 96 * 96, -3);
    const [curve] = flatten(parsePath('M0,0C0,10 10,10 10,0Z'), 4);
    expect(curve).toHaveLength(5);
  });

  it('picks the largest subpath as the silhouette', () => {
    expect(silhouette([square(10), square(40), square(20)])).toEqual(square(40));
    expect(() => silhouette([])).toThrow(/no subpath/);
  });

  it('resamples to n points, keeps the corners and orients every contour the same way', () => {
    const n = 16;
    for (const clockwise of [true, false]) {
      const out = resample(square(100, clockwise), n);
      expect(out).toHaveLength(n);
      expect(signedArea(out)).toBeGreaterThan(0);
      for (const corner of square(100)) expect(out).toContainEqual(corner);
    }
    // No corners (a circle): uniform, n distinct points.
    const [ring] = flatten(parsePath('M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z'));
    const circle = resample(ring as number[][], n);
    expect(new Set(circle.map((p) => p.join(','))).size).toBe(n);
    expect(() => resample(square(1), 3)).toThrow(/corners do not fit/);
  });

  it('starts every outline at its topmost, then leftmost point', () => {
    expect(
      startAtTop([
        [5, 5],
        [9, 0],
        [2, 0],
        [0, 3],
      ])[0],
    ).toEqual([2, 0]);
  });

  it('fits the mark into the icon box of the grid and writes integer path data', () => {
    const fitted: number[][] = fitToGrid(silhouette(flatten(parsePath(MARK_PATH))));
    const ys = fitted.map((p) => p[1] ?? NaN);
    expect(Math.min(...ys)).toBeCloseTo(24, 6);
    expect(Math.max(...ys)).toBeCloseTo(232, 6);
    expect(
      toPathData([
        [1.4, 2.6],
        [3, 4],
      ]),
    ).toBe('M1 3L3 4Z');
  });

  it('builds every outline with POINTS points, starting at the top', async () => {
    const text = await generate();
    const shapes = [...text.matchAll(/'(M[^']+)'/g)].map((m) => points(m[1] as string));
    expect(shapes).toHaveLength(1 + Object.keys(GLYPHS).length);
    for (const shape of shapes) {
      expect(shape).toHaveLength(POINTS);
      const top = Math.min(...shape.map((p) => p[1]));
      expect(shape[0]?.[1]).toBe(top);
    }
    // A 96 unit circle around (128, 128): its top is y = 32, where the outline starts.
    expect(
      iconOutline('<svg><path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z"/></svg>'),
    ).toMatch(/^M128 32L/);
    expect(() => iconOutline('<svg></svg>')).toThrow(/no path/);
  });

  it('the committed src/brand/serviceIconPaths.ts is current (else run node scripts/brand-paths.mjs)', async () => {
    expect(readFileSync(OUT, 'utf8')).toBe(await generate());
  });
});
