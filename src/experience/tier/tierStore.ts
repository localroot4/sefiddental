/**
 * Tier store (spec EXP 3.5): collects TierInputs through an injected environment, calls
 * `selectTier` from qualityTier, applies the frame-monitor cap and the layout latch, and exposes
 * one immutable snapshot for `useSyncExternalStore`. Every transition runs in a plain callback
 * (media change, probe result, control call), so React never sets state in an effect.
 *
 * Phone mode (phone spec section 1): the CPU blocking signal is read at `load` and once more at
 * the engine gate (the probe's answer, or `openGate()` at `load` + 1500 ms, which also aborts
 * the benchmark fetch); a monitor drop goes to tier 0 in one step and counts toward the light
 * floor (`sefid-light`), which a later page view reads at creation in auto mode.
 */
import {
  DEBUG_SESSION_KEY,
  isPhoneMode,
  isSoftwareRenderer,
  LIGHT_FLOOR_KEY,
  LIGHT_FLOOR_MS,
  parseSavedOverride,
  QUALITY_STORAGE_KEY,
  selectTier,
  TIER_CAP_SESSION_KEY,
  tierSettings,
  type Tier,
  type TierDecision,
  type TierInputs,
  type TierOverride,
  type TierReason,
  type TierSettings,
} from '@/lib/qualityTier';

import { debugActive, parseExperienceQuery } from '../core/query';
import { SCENES_LOAD_WEBGL } from '../scenes/registry';

import type { ProbeResult } from './gpuProbe';
import {
  latchLayout,
  mayRelatch,
  sameLayout,
  TIER0_LAYOUT,
  type LayoutLatch,
  type RelatchReason,
} from './latch';

export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface MediaSignal {
  matches(): boolean;
  subscribe(onChange: () => void): () => void;
}

/** Long-animation-frame blocking since FCP; `readMs()` is null without the entry type. */
export interface CpuBlocking {
  readMs(): number | null;
  stop(): void;
}

/** Everything the store reads from the browser; tests pass a fake. */
export interface TierEnv {
  reducedMotion: MediaSignal;
  finePointer: MediaSignal;
  /** `(min-width: 1024px)`: the pin boundary of tierSettings. */
  wide: MediaSignal;
  viewport(): { width: number; height: number; dpr: number };
  saveData(): boolean;
  deviceMemory(): number | null;
  search(): string;
  local: KeyValueStore;
  session: KeyValueStore;
  /** Calls back once the document has loaded (at once when it already has). */
  onLoad(cb: () => void): () => void;
  probe(opts: {
    benchmark: (renderer: string | null) => boolean;
    signal: AbortSignal;
  }): Promise<ProbeResult>;
  /** Starts summing the CPU blocking (phone spec 1.1); read it with `readMs()`. */
  watchCpuBlocking(): CpuBlocking;
  /** Whether a main-thread `<canvas>` gets a WebGL 2 context: what the canvas needs. */
  webgl2OnMainThread(): boolean;
  scrollY(): number;
  now(): number;
  /** Wall-clock time for the light floor's expiry (`now()` restarts with every page). */
  epochMs(): number;
  every(ms: number, cb: () => void): () => void;
}

/** Scroll facts for the latch; the scroll engine registers itself. */
export interface ScrollProbe {
  insidePinnedRange(): boolean;
  reachedFirstPinnedScene(): boolean;
}

export type StepSource = 'monitor' | 'context-loss';

/** `data-tier-reason`: the decision's reason, or what capped it during this visit. */
export type EffectiveReason = TierDecision['reason'] | StepSource;

export interface TierState {
  /** False only in the server snapshot (and during hydration). */
  hydrated: boolean;
  /**
   * 'pending' until the post-load probe decided, or `load` showed that no probe is needed; the
   * canvas never mounts while pending.
   */
  status: 'pending' | 'ready';
  decision: TierDecision | null;
  /** Effective tier: the decision, lowered by the frame monitor (auto mode) or a context loss. */
  tier: Tier;
  reason: EffectiveReason;
  /** GPU-side settings of the effective tier (they follow it at once). */
  settings: TierSettings;
  layout: LayoutLatch;
  mode: 'auto' | 'fixed';
  monitorCap: Tier | null;
  probe: ProbeResult | null;
  lastStep: { source: StepSource; tier: Tier; atMs: number } | null;
  debug: boolean;
  stress: number;
  finePointer: boolean;
  /** A coarse pointer under 1024 px (phone spec D23). */
  phone: boolean;
  /**
   * The CPU signal's last reading (at `load` and at the engine gate), in ms; null when it is not
   * measured (no entry type, a saved or query tier, a fine pointer). The overlay shows it, so the
   * owner's phone calibrates `CPU_BLOCKING_MS`.
   */
  cpuBlockingMs: number | null;
  /** The «کیفیت» control (phase 7): saved in localStorage; removes the light floor record. */
  setUserOverride(override: TierOverride): void;
  /** Overlay buttons: a query-style tier for this page load only ('auto' clears it). */
  setPageOverride(override: TierOverride): void;
  stepDown(source: StepSource): void;
  /**
   * The engine gate's deadline on a coarse pointer (D23): reads the CPU signal a last time and
   * aborts the benchmark fetch. The probe's answer passes the gate by itself.
   */
  openGate(): void;
}

export interface TierStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TierState;
  setScrollProbe(probe: ScrollProbe | null): void;
}

/** Interval of the scroll-idle check while a monitor relatch waits. */
export const RELATCH_POLL_MS = 250;

/** The `wide` media query boundary (tierSettings pins from 1024 px). */
const WIDE_MIN_PX = 1024;

const noop = (): void => {};

/** Server snapshot: tier 0, no decision, no layout features (the server HTML is tier-0-safe). */
export const SERVER_TIER_STATE: TierState = Object.freeze({
  hydrated: false,
  status: 'pending',
  decision: null,
  tier: 0,
  reason: 'reduced-motion',
  settings: tierSettings(0, { width: 0, height: 0, dpr: 1 }, false),
  layout: TIER0_LAYOUT,
  mode: 'auto',
  monitorCap: null,
  probe: null,
  lastStep: null,
  debug: false,
  stress: 0,
  finePointer: false,
  phone: false,
  cpuBlockingMs: null,
  setUserOverride: noop,
  setPageOverride: noop,
  stepDown: noop,
  openGate: noop,
});

const parseCap = (raw: string | null): Tier | null => {
  const value = parseSavedOverride(raw);
  return value === 'auto' ? null : value;
};

/** `sefid-light`: the monitor drops to tier 0 in phone mode, and when the record expires. */
export interface FloorRecord {
  n: number;
  until: number;
}

/** Storage is a boundary: anything but a positive count and a finite time is no record. */
export function parseFloor(raw: string | null): FloorRecord | null {
  try {
    const { n, until } = JSON.parse(raw ?? 'null') as Partial<FloorRecord>;
    if (Number.isInteger(n) && (n ?? 0) > 0 && Number.isFinite(until)) {
      return { n: n as number, until: until as number };
    }
  } catch {
    // Corrupt JSON or null: no record.
  }
  return null;
}

/** Weak-phone reasons that fix tier 0 before the probe (D23): no probe, no benchmark fetch. */
const WEAK_PHONE: ReadonlySet<TierReason> = new Set(['device-memory', 'light-floor', 'device-cpu']);

export function createTierStore(env: TierEnv, opts: { siteCap: Tier | null }): TierStore {
  const query = parseExperienceQuery(env.search());
  const debug = debugActive(query, env.session.get(DEBUG_SESSION_KEY));

  let page: { tier: Tier | null; mode: 'fixed' | 'auto' } = {
    tier: query.tier,
    mode: query.tier !== null && query.monitor ? 'auto' : 'fixed',
  };
  let savedOverride = parseSavedOverride(env.local.get(QUALITY_STORAGE_KEY));
  let monitorCap = parseCap(env.session.get(TIER_CAP_SESSION_KEY));
  let contextLossZero = false;
  let probe: ProbeResult | null = null;
  let probeStarted = false;
  let loadSeen = false;
  let detectionUsed = false;
  let lastStep: TierState['lastStep'] = null;
  let scrollProbe: ScrollProbe | null = null;
  let floor = parseFloor(env.local.get(LIGHT_FLOOR_KEY));
  // Active from the second drop, for the page views after it: a drop in this view never adds it.
  let lightFloor = floor !== null && floor.n >= 2 && env.epochMs() < floor.until;
  let cpu: CpuBlocking | null = null;
  let cpuMs: number | null = null;
  let gatePassed = false;
  let benchmarkAbort: AbortController | null = null;

  const readSignals = () => {
    const viewport = env.viewport();
    // Chromium fires the (min-width: 1024px) change while innerWidth still reads the old width
    // (a tablet rotation): the query that fired decides which side of 1024 px the width is on.
    const width = env.wide.matches()
      ? Math.max(viewport.width, WIDE_MIN_PX)
      : Math.min(viewport.width, WIDE_MIN_PX - 1);
    return {
      reducedMotion: env.reducedMotion.matches(),
      finePointer: env.finePointer.matches(),
      viewport: { ...viewport, width },
      saveData: env.saveData(),
      deviceMemory: env.deviceMemory(),
    };
  };
  let signals = readSignals();

  const inputs = (): TierInputs => ({
    reducedMotion: signals.reducedMotion,
    // Before the probe: assume WebGL 2 without a benchmark (tier 1). The cached benchmark is read
    // by the probe after `load`, where its zod parser loads lazily (15 KiB gzip kept off the home
    // initial JS); the 'detection' relatch then moves the layout before the first pinned scene.
    webgl2: probe ? probe.webgl2 : true,
    renderer: probe ? probe.renderer : null,
    gpu: probe ? probe.gpu : null,
    saveData: signals.saveData,
    deviceMemory: signals.deviceMemory,
    viewport: signals.viewport,
    finePointer: signals.finePointer,
    savedOverride,
    queryOverride: page.tier,
    queryMode: page.mode,
    siteCap: opts.siteCap,
    cpuBlockingMs: cpuMs,
    lightFloor,
  });

  const derive = () => {
    const decision = selectTier(inputs());
    let tier = decision.tier;
    let reason: EffectiveReason = decision.reason;
    if (contextLossZero && tier > 0) {
      tier = 0;
      reason = 'context-loss';
    } else if (decision.mode === 'auto' && monitorCap !== null && monitorCap < tier) {
      tier = monitorCap;
      reason = 'monitor';
    }
    const settings =
      tier === decision.tier
        ? decision.settings
        : tierSettings(tier, signals.viewport, signals.finePointer);
    return {
      decision,
      tier,
      reason,
      settings,
      desired: latchLayout(settings, signals.finePointer, tier),
    };
  };

  // The latch is set now, at hydration, from the synchronous decision (spec EXP 3.5 rule 7).
  let layout: LayoutLatch = derive().desired;

  const listeners = new Set<() => void>();
  let stopPending: (() => void) | null = null;
  const explicitChoice = (): boolean => page.tier !== null || savedOverride !== 'auto';

  const scrollFacts = () => ({
    insidePinnedRange: scrollProbe?.insidePinnedRange() ?? false,
    reachedFirstPinnedScene: scrollProbe?.reachedFirstPinnedScene() ?? false,
  });

  const clearPending = (): void => {
    stopPending?.();
    stopPending = null;
  };

  /** A monitor drop changes the layout only outside pins after 1000 ms without scrolling. */
  const waitForIdle = (): void => {
    if (stopPending !== null) return;
    let lastY = env.scrollY();
    let lastChangeAt = env.now();
    stopPending = env.every(RELATCH_POLL_MS, () => {
      const y = env.scrollY();
      const now = env.now();
      if (y !== lastY) {
        lastY = y;
        lastChangeAt = now;
      }
      const { desired } = derive();
      if (sameLayout(desired, layout)) {
        clearPending();
        return;
      }
      if (mayRelatch({ ...scrollFacts(), scrollIdleMs: now - lastChangeAt, reason: 'monitor' })) {
        layout = desired;
        clearPending();
        emit();
      }
    });
  };

  let snapshot: TierState;

  const build = (): TierState => {
    const d = derive();
    return {
      hydrated: true,
      status: probe !== null || (loadSeen && !probeCanChangeTier()) ? 'ready' : 'pending',
      decision: d.decision,
      tier: d.tier,
      reason: d.reason,
      settings: d.settings,
      layout,
      mode: d.decision.mode,
      monitorCap,
      probe,
      lastStep,
      debug,
      stress: debug ? query.stress : 0,
      finePointer: signals.finePointer,
      phone: isPhoneMode(signals),
      cpuBlockingMs: cpuMs,
      setUserOverride,
      setPageOverride,
      stepDown,
      openGate,
    };
  };

  function emit(): void {
    snapshot = build();
    for (const listener of listeners) listener();
  }

  /** Recomputes, applies the latch rule for `reason`, and notifies. */
  function update(reason: RelatchReason | null): void {
    runProbe(); // an input that pinned tier 0 may have changed since `load`
    confirmWebgl2();
    const { desired } = derive();
    if (reason !== null && !sameLayout(desired, layout)) {
      const samePins = desired.pinnedScenes === layout.pinnedScenes;
      // D25: a change the reader did not ask for once the engine runs (a monitor drop, a late
      // probe answer) waits for 1000 ms without scroll even with the same pins, so the engine's
      // scrubbed targets settle while nothing moves under the finger.
      const unasked = reason === 'monitor' || (reason === 'detection' && scrollProbe !== null);
      if (samePins && !unasked) {
        // Same pins, so no pin spacer appears or goes: Lenis and the master timeline can change
        // without moving the page under the reader.
        layout = desired;
        clearPending();
      } else if (samePins || reason === 'monitor') {
        waitForIdle();
      } else if (reason === 'detection') {
        // Once per page load; otherwise the latch holds for the visit.
        if (!detectionUsed) {
          detectionUsed = true;
          if (mayRelatch({ ...scrollFacts(), scrollIdleMs: 0, reason })) layout = desired;
        }
      } else if (mayRelatch({ ...scrollFacts(), scrollIdleMs: 0, reason })) {
        layout = desired;
        clearPending();
      }
    }
    emit();
  }

  function setUserOverride(override: TierOverride): void {
    savedOverride = override;
    if (override === 'auto') env.local.remove(QUALITY_STORAGE_KEY);
    else env.local.set(QUALITY_STORAGE_KEY, String(override));
    // Any explicit choice ends the light floor: the visitor decided.
    floor = null;
    lightFloor = false;
    env.local.remove(LIGHT_FLOOR_KEY);
    update('user');
  }

  function setPageOverride(override: TierOverride): void {
    page = { tier: override === 'auto' ? null : override, mode: 'fixed' };
    update('user');
  }

  function stepDown(source: StepSource): void {
    const current = derive();
    if (source === 'context-loss') {
      if (contextLossZero) return;
      contextLossZero = true;
    } else if (current.decision.mode !== 'auto' || current.tier === 0) {
      return;
    }
    // Phone mode (D26): tiers 1 to 3 are one scroll set there, so the monitor goes to 0 at once.
    const phone = isPhoneMode(signals);
    const next: Tier = source === 'context-loss' || phone ? 0 : ((current.tier - 1) as Tier);
    monitorCap = monitorCap === null ? next : (Math.min(monitorCap, next) as Tier);
    env.session.set(TIER_CAP_SESSION_KEY, String(monitorCap));
    if (source === 'monitor' && phone) rememberDrop();
    lastStep = { source, tier: next, atMs: env.now() };
    update('monitor');
  }

  /** Each monitor drop to tier 0 in phone mode counts; an expired record starts again at 1. */
  function rememberDrop(): void {
    const now = env.epochMs();
    floor = {
      n: floor !== null && now < floor.until ? floor.n + 1 : 1,
      until: now + LIGHT_FLOOR_MS,
    };
    env.local.set(LIGHT_FLOOR_KEY, JSON.stringify(floor));
  }

  // The probe only feeds the tier. While reduced motion, a tier pinned at 0, a site cap of 0 or a
  // weak-phone rule fix the tier at 0, it would build a WebGL context for nothing (about 15 ms of
  // main thread at load) and a weak phone would fetch the benchmark data.
  const probeCanChangeTier = (): boolean => {
    if (signals.reducedMotion || page.tier === 0 || savedOverride === 0 || opts.siteCap === 0) {
      return false;
    }
    const { tier, reason } = selectTier(inputs());
    return !(tier === 0 && WEAK_PHONE.has(reason));
  };

  /** D23: the CPU signal at `load`, and a last time at the engine gate, where it stops. */
  const readCpu = (last: boolean): void => {
    if (cpu === null) return;
    cpuMs = cpu.readMs();
    if (!last) return;
    cpu.stop();
    cpu = null;
  };

  function passGate(): void {
    if (gatePassed) return;
    gatePassed = true;
    readCpu(true);
  }

  function openGate(): void {
    if (gatePassed) return;
    passGate();
    benchmarkAbort?.abort();
    update('detection');
  }

  function runProbe(): void {
    if (probeStarted || !loadSeen || !probeCanChangeTier()) return;
    probeStarted = true;
    benchmarkAbort = new AbortController();
    env
      .probe({
        benchmark: (renderer) =>
          !isSoftwareRenderer(renderer) &&
          !signals.saveData &&
          !signals.reducedMotion &&
          !explicitChoice(),
        signal: benchmarkAbort.signal,
      })
      .catch((error: unknown): ProbeResult => {
        console.warn('[experience] GPU probe failed; tier 0.', error);
        return { webgl2: false, renderer: null, gpu: null };
      })
      .then((result) => {
        probe = result;
        passGate();
        update('detection');
      });
  }

  // D-Q3 (no WebGL 2 beats ?tier=N) holds for every tier that mounts the canvas: tiers 2 and 3,
  // and tier 1 under the debug flag or once a scene loads WebGL (ExperienceRoot, D5). The canvas
  // needs WebGL 2 on a main-thread <canvas>, which a context in the probe's worker does not
  // promise, so a worker-only result is confirmed there first, once. Any other tier 1 draws no
  // WebGL in phase 7: with only the worker's answer it means "WebGL 2 in a worker, the main
  // thread unchecked", and no main-thread context is made for it (Lighthouse's ?tier=1).
  function confirmWebgl2(): void {
    if (probe?.workerOnly !== true) return;
    const { tier } = derive();
    if (tier < 2 && !(tier === 1 && (debug || SCENES_LOAD_WEBGL))) return;
    probe = env.webgl2OnMainThread()
      ? { ...probe, workerOnly: false }
      : { webgl2: false, renderer: null, gpu: null };
  }

  const onLoad = (): void => {
    loadSeen = true;
    const before = cpuMs;
    readCpu(false);
    // A CPU sum over the threshold fixes tier 0 before the probe; with no probe needed the status
    // is ready now; otherwise the probe starts (fine pointers: as before, no emit).
    if (cpuMs !== before) update('detection');
    else if (probeCanChangeTier()) runProbe();
    else emit();
  };

  const start = (): (() => void) => {
    if (query.debug === 'on') env.session.set(DEBUG_SESSION_KEY, '1');
    if (query.debug === 'off') env.session.remove(DEBUG_SESSION_KEY);
    const onMedia = (reason: RelatchReason) => () => {
      signals = readSignals();
      update(reason);
    };
    // D23: phone mode and auto mode measure the CPU from hydration to the engine gate; a saved
    // choice or a query tier skips it (Lighthouse and the tests run with `?tier`).
    if (cpu === null && !gatePassed && isPhoneMode(signals) && !explicitChoice()) {
      cpu = env.watchCpuBlocking();
    }
    const stops = [
      env.reducedMotion.subscribe(onMedia('reduced-motion')),
      env.finePointer.subscribe(onMedia('resize')),
      env.wide.subscribe(onMedia('resize')),
      env.onLoad(onLoad),
    ];
    // A media change between creation (hydration) and this subscription.
    const fresh = readSignals();
    const reducedChanged = fresh.reducedMotion !== signals.reducedMotion;
    const layoutChanged =
      fresh.finePointer !== signals.finePointer ||
      fresh.viewport.width >= WIDE_MIN_PX !== signals.viewport.width >= WIDE_MIN_PX;
    if (reducedChanged || layoutChanged) {
      signals = fresh;
      update(reducedChanged ? 'reduced-motion' : 'resize');
    }
    return () => {
      for (const stop of stops) stop();
      clearPending();
      cpu?.stop();
      cpu = null;
    };
  };

  snapshot = build();
  let stop: (() => void) | null = null;

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (stop === null) stop = start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && stop !== null) {
          stop();
          stop = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    setScrollProbe(next) {
      scrollProbe = next;
    },
  };
}
