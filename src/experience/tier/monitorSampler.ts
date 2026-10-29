/**
 * Frame sampler for the frame monitor (spec EXP 3.7 option A, spec-utils D-Q4). Sums frame deltas
 * into fixed windows and reports each window's average fps. Pure: time comes in as arguments.
 */

export interface SamplerConfig {
  /** Window length; each full window reports one fps sample. */
  windowMs: number;
  /** Samples right after a reset are dropped (shader compile after a tier change). */
  warmupMs: number;
  /**
   * A larger delta is not a frame but a pause (a throttled background tab): it resets instead of
   * counting. Gate reopenings and the tab becoming visible reset explicitly, so this is only a
   * safety net and stays far above real slow frames: a software GPU under `?stress` renders one
   * frame per 2 s (measured), and those frames must count, or the drop path never runs.
   */
  maxDeltaMs: number;
}

export const SAMPLER_DEFAULTS: Readonly<SamplerConfig> = Object.freeze({
  windowMs: 250,
  warmupMs: 1000,
  maxDeltaMs: 10_000,
});

export interface MonitorSampler {
  /** One rendered frame: its delta in seconds (R3F `useFrame`) and the current time in ms. */
  push(deltaSec: number, nowMs: number): void;
  /** Call on mount, tier change, gate reopen, tab visible and context restored. */
  reset(nowMs: number): void;
  /** Drops the partial window and keeps the warm-up (a scroll that ended, phone spec D26). */
  cut(): void;
}

export function createMonitorSampler(
  cfg: SamplerConfig,
  onWindow: (sample: { nowMs: number; fps: number; windowMs: number }) => void,
): MonitorSampler {
  // null until the first push or reset arms the warm-up.
  let warmupUntil: number | null = null;
  let frames = 0;
  let elapsedMs = 0;

  const reset = (nowMs: number): void => {
    warmupUntil = nowMs + cfg.warmupMs;
    frames = 0;
    elapsedMs = 0;
  };

  const push = (deltaSec: number, nowMs: number): void => {
    const deltaMs = deltaSec * 1000;
    if (warmupUntil === null || !(deltaMs >= 0) || deltaMs > cfg.maxDeltaMs) {
      reset(nowMs);
      return;
    }
    if (nowMs < warmupUntil) return;
    frames += 1;
    elapsedMs += deltaMs;
    if (elapsedMs >= cfg.windowMs) {
      const windowMs = elapsedMs;
      const fps = (frames * 1000) / windowMs;
      frames = 0;
      elapsedMs = 0;
      onWindow({ nowMs, fps, windowMs });
    }
  };

  const cut = (): void => {
    frames = 0;
    elapsedMs = 0;
  };

  return { push, reset, cut };
}
