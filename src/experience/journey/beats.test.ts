import { describe, expect, it } from 'vitest';

import { SOLID, workflowBeats } from './beats';

describe('workflow beats on the courier tooth', () => {
  it('B1 both ends of the hold are the lit solid, so the tooth arrives and leaves without a jump', () => {
    const start = workflowBeats(0);
    const end = workflowBeats(1);
    expect({ ...start, scan: 0 }).toEqual(SOLID);
    expect(end).toEqual(SOLID);
    expect(workflowBeats(null)).toEqual(SOLID);
  });

  it('B2 point cloud, then wireframe, then the solid builds, glazes and the light warms, in order', () => {
    const cloud = workflowBeats(0.2);
    expect(cloud.points).toBe(1);
    expect(cloud.build).toBe(0);
    const design = workflowBeats(0.45);
    expect(design.wire).toBe(1);
    expect(design.points).toBe(0);
    const made = workflowBeats(0.7);
    expect(made.build).toBe(1);
    expect(made.glaze).toBeGreaterThan(0);
    expect(made.glaze).toBeLessThan(1);
    expect(made.wire).toBe(0);
    expect(workflowBeats(0.88).warm).toBe(1);
  });

  it('B3 the only step is the glaze switch while the solid is gone; everything else is continuous', () => {
    let prev = workflowBeats(0);
    for (let i = 1; i <= 1000; i += 1) {
      const p = i / 1000;
      const b = workflowBeats(p);
      for (const key of ['build', 'points', 'scan', 'wire', 'warm'] as const) {
        expect(Math.abs(b[key] - prev[key]), `${key} at ${p}`).toBeLessThan(0.03);
      }
      if (Math.abs(b.glaze - prev.glaze) >= 0.03) expect(b.build + prev.build).toBe(0);
      prev = b;
    }
  });
});
