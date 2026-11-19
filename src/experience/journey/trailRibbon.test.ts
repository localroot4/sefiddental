import { describe, expect, it } from 'vitest';

import { TRAIL_MAX, TRAIL_OPACITY, createTrailRibbon } from './trailRibbon';

const at = (x: number, y: number, age: number, s = 100) => ({ x, y, s, age });

describe('trailRibbon', () => {
  it('TR1 draws nothing under two places', () => {
    const ribbon = createTrailRibbon();
    expect(ribbon.update([], false)).toBeNull();
    expect(ribbon.update([at(10, 10, 0)], false)).toBeNull();
    ribbon.dispose();
  });

  it('TR2 the box holds every place with its width, and the camera sees exactly the box', () => {
    const ribbon = createTrailRibbon();
    const points = [at(100, 300, 0.9), at(160, 260, 0.5), at(220, 200, 0)];
    const box = ribbon.update(points, false)!;
    // The head is 22 px wide (0.22 of a 100 px box): 11 px each side, plus the 2 px margin.
    expect(box.left).toBeLessThanOrEqual(100 - 0.5);
    expect(box.left + box.width).toBeGreaterThanOrEqual(220 + 11);
    expect(box.top).toBeLessThanOrEqual(200 - 11);
    expect(box.top + box.height).toBeGreaterThanOrEqual(300);
    expect(box.width).toBeLessThan(150);
    const { camera } = ribbon;
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([
      box.left,
      box.left + box.width,
      box.top,
      box.top + box.height,
    ]);
    ribbon.dispose();
  });

  it('TR3 opacity falls with age (the head at TRAIL_OPACITY), one quad between each two places', () => {
    const ribbon = createTrailRibbon();
    ribbon.update([at(0, 0, 0.8), at(10, 0, 0.4), at(20, 0, 0)], true);
    const mesh = ribbon.scene.children[0] as unknown as {
      geometry: {
        drawRange: { count: number };
        attributes: { aAlpha: { array: Float32Array } };
      };
    };
    expect(mesh.geometry.drawRange.count).toBe(2 * 6);
    const alpha = mesh.geometry.attributes.aAlpha.array;
    expect(alpha[0]).toBeLessThan(alpha[2]!);
    expect(alpha[2]).toBeLessThan(alpha[4]!);
    expect(alpha[4]).toBeCloseTo(TRAIL_OPACITY);
    ribbon.dispose();
  });

  it('TR4 keeps the newest TRAIL_MAX places', () => {
    const ribbon = createTrailRibbon();
    const many = Array.from({ length: TRAIL_MAX + 10 }, (_, i) =>
      at(i * 10, 0, 1 - i / (TRAIL_MAX + 9)),
    );
    const box = ribbon.update(many, false)!;
    // The oldest ten fall away: the box starts at the eleventh place.
    expect(box.left).toBeGreaterThan(90);
    expect(box.left + box.width).toBeGreaterThanOrEqual((TRAIL_MAX + 9) * 10);
    ribbon.dispose();
  });
});
