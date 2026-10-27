import { describe, expect, it } from 'vitest';

import {
  activeScene,
  activeSceneIndex,
  sceneBounds,
  sceneProgress,
  scrollFraction,
  scrollYAt,
} from './timelineMath';

describe('scrollFraction', () => {
  it('V6 maps scrollY to 0..1 of the scroll range', () => {
    expect(scrollFraction(0, 4000)).toBe(0);
    expect(scrollFraction(1000, 4000)).toBe(0.25);
    expect(scrollFraction(4000, 4000)).toBe(1);
    expect(scrollFraction(4200, 4000)).toBe(1);
    expect(scrollFraction(-50, 4000)).toBe(0);
  });

  it('V6 a page that does not scroll stays at 0', () => {
    expect(scrollFraction(0, 0)).toBe(0);
    expect(scrollFraction(10, -5)).toBe(0);
    expect(scrollFraction(Number.NaN, 100)).toBe(0);
  });
});

describe('sceneBounds', () => {
  it('V6 turns section tops into 0..1 segments; the last ends at 1', () => {
    const bounds = sceneBounds(
      [
        { id: 'hero', top: 0, height: 900 },
        { id: 'trust', top: 900, height: 360 },
        { id: 'services', top: 1260, height: 1800 },
        { id: 'footer', top: 3600, height: 900 },
      ],
      3600,
    );
    expect(bounds).toEqual([
      { id: 'hero', start: 0, end: 0.25 },
      { id: 'trust', start: 0.25, end: 0.35 },
      { id: 'services', start: 0.35, end: 1 },
      { id: 'footer', start: 1, end: 1 },
    ]);
  });

  it('EN2 a nested scene overlaps its parent: hero 0..1000 with trust at 850..1000 ends at 1000', () => {
    const bounds = sceneBounds(
      [
        { id: 'hero', top: 0, height: 1000 },
        { id: 'trust', top: 850, height: 150 },
        { id: 'services', top: 1000, height: 1000 },
      ],
      2000,
    );
    expect(bounds).toEqual([
      { id: 'hero', start: 0, end: 0.5 },
      { id: 'trust', start: 0.425, end: 0.5 },
      { id: 'services', start: 0.5, end: 1 },
    ]);
    // A gap before the next scene belongs to the scene before it (the segments stay contiguous).
    expect(
      sceneBounds(
        [
          { id: 'a', top: 0, height: 100 },
          { id: 'b', top: 500, height: 500 },
        ],
        1000,
      ),
    ).toEqual([
      { id: 'a', start: 0, end: 0.5 },
      { id: 'b', start: 0.5, end: 1 },
    ]);
  });

  it('V6 bounds are monotonic even when a top is out of order or past the range', () => {
    const bounds = sceneBounds(
      [
        { id: 'a', top: 500, height: 100 },
        { id: 'b', top: 200, height: 100 },
        { id: 'c', top: 9000, height: 100 },
      ],
      1000,
    );
    expect(bounds.map((b) => b.start)).toEqual([0.5, 0.5, 1]);
    for (const b of bounds) expect(b.end).toBeGreaterThanOrEqual(b.start);
    expect(bounds.at(-1)?.end).toBe(1);
  });

  it('V6 an empty list gives no bounds', () => {
    expect(sceneBounds([], 1000)).toEqual([]);
  });
});

describe('sceneProgress and activeSceneIndex', () => {
  const bounds = [
    { start: 0, end: 0.25 },
    { start: 0.25, end: 0.5 },
    { start: 0.5, end: 1 },
  ];

  it('V6 progress inside a segment', () => {
    expect(sceneProgress(0.375, bounds[1]!)).toBe(0.5);
    expect(sceneProgress(0.1, bounds[1]!)).toBe(0);
    expect(sceneProgress(0.9, bounds[1]!)).toBe(1);
    expect(sceneProgress(0.5, { start: 1, end: 1 })).toBe(0);
    expect(sceneProgress(1, { start: 1, end: 1 })).toBe(1);
  });

  it('V6 the active segment is the last one that started', () => {
    expect(activeSceneIndex(0, bounds)).toBe(0);
    expect(activeSceneIndex(0.3, bounds)).toBe(1);
    expect(activeSceneIndex(1, bounds)).toBe(2);
    expect(activeSceneIndex(0.1, [{ start: 0.2 }])).toBe(-1);
  });
});

describe('activeScene and scrollYAt (relatch keep-place)', () => {
  // Binary-exact fractions, so the progress compares without rounding.
  const before = [
    { id: 'hero', start: 0, end: 0.25 },
    { id: 'services', start: 0.25, end: 0.75 },
    { id: 'booking', start: 0.75, end: 1 },
  ];

  it('EN3 the place is the active scene with its progress; none before the first label', () => {
    expect(activeScene(0.5, before)).toEqual({ id: 'services', progress: 0.5 });
    expect(activeScene(0.1, [{ id: 'x', start: 0.2, end: 1 }])).toBeNull();
  });

  it('EN4 the place maps to the scrollY of the same scene in new bounds (a pin went away)', () => {
    const after = [
      { id: 'hero', start: 0, end: 0.25 },
      { id: 'services', start: 0.25, end: 0.5 },
      { id: 'booking', start: 0.5, end: 1 },
    ];
    expect(scrollYAt({ id: 'services', progress: 0.5 }, after, 4000)).toBe(1500);
    expect(scrollYAt({ id: 'services', progress: 2 }, after, 4000)).toBe(2000);
    expect(scrollYAt({ id: 'workflow', progress: 0.5 }, after, 4000)).toBeNull();
  });
});
