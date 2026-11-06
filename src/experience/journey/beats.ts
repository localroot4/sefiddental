/**
 * The workflow beats on the courier tooth while it holds at D4 (docs/experience/journey.md
 * section 2): the solid it arrives as is scanned away into a point cloud, the cloud gives way to
 * the wireframe of the design, the solid builds again from the root tips as a matte milled block,
 * takes its glaze, and the light warms for the smile, then cools before it leaves. Pure, from the
 * hold's progress, so the beats scrub back exactly. Outside the hold the tooth is the lit solid.
 */
import { ramp } from '../scenes/webgl/math';

export interface Beats {
  /** 0..1 the solid exists from the root tips up to this share of its height. */
  build: number;
  /** Point cloud opacity. */
  points: number;
  /** Height of the scan band over the cloud, 0 at the root tips to 1 above the cusps. */
  scan: number;
  /** Wireframe opacity. */
  wire: number;
  /** 0 matte milled block, 1 glazed enamel. */
  glaze: number;
  /** Cool to warm key light. */
  warm: number;
}

export const SOLID: Beats = { build: 1, points: 0, scan: 0, wire: 0, glaze: 1, warm: 0 };

export function workflowBeats(local: number | null): Beats {
  if (local === null) return SOLID;
  const p = local;
  // Scanned away from the cusps down; it comes back built from the root tips up.
  const build = p < 0.3 ? 1 - ramp(p, 0, 0.16) : ramp(p, 0.4, 0.62);
  return {
    build,
    points: ramp(p, 0, 0.1) * (1 - ramp(p, 0.3, 0.4)),
    scan: 1 - ramp(p, 0, 0.16),
    wire: ramp(p, 0.16, 0.28) * (1 - ramp(p, 0.52, 0.64)),
    // The glazed solid leaves as it was; the block it comes back as is matte until 0.64.
    glaze: p < 0.3 ? 1 : ramp(p, 0.64, 0.78),
    warm: ramp(p, 0.74, 0.86) * (1 - ramp(p, 0.9, 1)),
  };
}
