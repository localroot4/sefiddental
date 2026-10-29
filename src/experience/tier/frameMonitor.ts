/**
 * Frame monitor (spec EXP 3.7, E6): the sampler's windows feed `monitorStep` from qualityTier.
 * 2 s of slow time under 55 fps drops one tier (phone mode: 1 s goes to tier 0); it repeats down
 * to tier 0; it never steps up; it does nothing in fixed mode. Pure: the canvas or the scroll
 * engine pushes frame deltas, the tier store applies the step.
 */
import { MONITOR_FPS_FLOOR, monitorStep, type MonitorState, type Tier } from '@/lib/qualityTier';

import { createMonitorSampler, SAMPLER_DEFAULTS, type SamplerConfig } from './monitorSampler';

export interface FrameMonitor {
  push(deltaSec: number, nowMs: number): void;
  reset(nowMs: number): void;
  /** Drops the partial window (the page stopped scrolling). */
  cut(): void;
  state(): MonitorState;
}

/** One sampled window, for the debug snapshot (phone spec 1.5). */
export interface MonitorWindow {
  slowMs: number;
  slow: boolean;
  stepped: boolean;
}

export function createFrameMonitor(opts: {
  tier: Tier;
  mode: 'auto' | 'fixed';
  /** Phone mode: 1000 ms of slow time goes to tier 0 in one step. */
  phone?: boolean;
  /** Called once per drop with the new tier; the sampler then warms up again. */
  onStepDown: (tier: Tier, nowMs: number) => void;
  onWindow?: (window: MonitorWindow) => void;
  config?: SamplerConfig;
}): FrameMonitor {
  let state: MonitorState = {
    tier: opts.tier,
    slowMs: 0,
    mode: opts.mode,
    phone: opts.phone ?? false,
  };
  const sampler = createMonitorSampler(opts.config ?? SAMPLER_DEFAULTS, (sample) => {
    const next = monitorStep(state, sample);
    const dropped = next.tier < state.tier;
    state = next;
    opts.onWindow?.({
      slowMs: next.slowMs,
      slow: sample.fps < MONITOR_FPS_FLOOR,
      stepped: dropped,
    });
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
    cut: () => sampler.cut(),
    state: () => state,
  };
}
