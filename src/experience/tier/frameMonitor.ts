/**
 * Frame monitor (spec EXP 3.7, E6): the sampler's windows feed `monitorStep` from qualityTier.
 * Under 55 fps for 2 s drops one tier; it repeats down to tier 0; it never steps up; it does
 * nothing in fixed mode. Pure: the canvas pushes frame deltas, the tier store applies the step.
 */
import { monitorStep, type MonitorState, type Tier } from '@/lib/qualityTier';

import { createMonitorSampler, SAMPLER_DEFAULTS, type SamplerConfig } from './monitorSampler';

export interface FrameMonitor {
  push(deltaSec: number, nowMs: number): void;
  reset(nowMs: number): void;
  state(): MonitorState;
}

export function createFrameMonitor(opts: {
  tier: Tier;
  mode: 'auto' | 'fixed';
  /** Called once per drop with the new tier; the sampler then warms up again. */
  onStepDown: (tier: Tier, nowMs: number) => void;
  config?: SamplerConfig;
}): FrameMonitor {
  let state: MonitorState = { tier: opts.tier, belowSinceMs: null, mode: opts.mode };
  const sampler = createMonitorSampler(opts.config ?? SAMPLER_DEFAULTS, (sample) => {
    const next = monitorStep(state, sample);
    const dropped = next.tier < state.tier;
    state = next;
    if (dropped) {
      sampler.reset(sample.nowMs);
      opts.onStepDown(next.tier, sample.nowMs);
    }
  });
  return {
    push: (deltaSec, nowMs) => {
      if (state.mode === 'fixed' || state.tier === 0) return;
      sampler.push(deltaSec, nowMs);
    },
    reset: (nowMs) => sampler.reset(nowMs),
    state: () => state,
  };
}
