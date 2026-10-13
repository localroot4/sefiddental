/**
 * Tier store (spec EXP 3.5): collects TierInputs through an injected environment, calls
 * `selectTier` from qualityTier, applies the frame-monitor cap and the layout latch, and exposes
 * one immutable snapshot for `useSyncExternalStore`. Every transition runs in a plain callback
 * (media change, probe result, control call), so React never sets state in an effect.
 */
import {
  DEBUG_SESSION_KEY,
  isSoftwareRenderer,
  parseSavedOverride,
  QUALITY_STORAGE_KEY,
  selectTier,
  TIER_CAP_SESSION_KEY,
  tierSettings,
  type Tier,
  type TierDecision,
  type TierInputs,
  type TierOverride,
  type TierSettings,
} from '@/lib/qualityTier';

import { debugActive, parseExperienceQuery } from '../core/query';

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
  probe(opts: { benchmark: (renderer: string | null) => boolean }): Promise<ProbeResult>;
  scrollY(): number;
  now(): number;
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
  /** 'pending' until the post-load probe decided; the canvas never mounts while pending. */
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
  /** The «کیفیت» control (phase 7): saved in localStorage. */
  setUserOverride(override: TierOverride): void;
  /** Overlay buttons: a query-style tier for this page load only ('auto' clears it). */
  setPageOverride(override: TierOverride): void;
  stepDown(source: StepSource): void;
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
  setUserOverride: noop,
  setPageOverride: noop,
  stepDown: noop,
});

const parseCap = (raw: string | null): Tier | null => {
  const value = parseSavedOverride(raw);
  return value === 'auto' ? null : value;
};

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
  let detectionUsed = false;
  let lastStep: TierState['lastStep'] = null;
  let scrollProbe: ScrollProbe | null = null;

  const readSignals = () => ({
    reducedMotion: env.reducedMotion.matches(),
    finePointer: env.finePointer.matches(),
    viewport: env.viewport(),
    saveData: env.saveData(),
    deviceMemory: env.deviceMemory(),
  });
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
      status: probe === null ? 'pending' : 'ready',
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
      setUserOverride,
      setPageOverride,
      stepDown,
    };
  };

  function emit(): void {
    snapshot = build();
    for (const listener of listeners) listener();
  }

  /** Recomputes, applies the latch rule for `reason`, and notifies. */
  function update(reason: RelatchReason | null): void {
    const { desired } = derive();
    if (reason !== null && !sameLayout(desired, layout)) {
      if (desired.pinnedScenes === layout.pinnedScenes) {
        // Same pins, so no pin spacer appears or goes: Lenis and the master timeline can change
        // without moving the page under the reader (tier 1 to 0 drops Lenis at once).
        layout = desired;
        clearPending();
      } else if (reason === 'monitor') {
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
    const next: Tier = source === 'context-loss' ? 0 : ((current.tier - 1) as Tier);
    monitorCap = monitorCap === null ? next : (Math.min(monitorCap, next) as Tier);
    env.session.set(TIER_CAP_SESSION_KEY, String(monitorCap));
    lastStep = { source, tier: next, atMs: env.now() };
    update('monitor');
  }

  const runProbe = (): void => {
    if (probeStarted) return;
    probeStarted = true;
    const explicit = () => page.tier !== null || savedOverride !== 'auto';
    env
      .probe({
        benchmark: (renderer) =>
          !isSoftwareRenderer(renderer) &&
          !signals.saveData &&
          !signals.reducedMotion &&
          !explicit(),
      })
      .catch((error: unknown): ProbeResult => {
        console.warn('[experience] GPU probe failed; tier 0.', error);
        return { webgl2: false, renderer: null, gpu: null };
      })
      .then((result) => {
        probe = result;
        update('detection');
      });
  };

  const start = (): (() => void) => {
    if (query.debug === 'on') env.session.set(DEBUG_SESSION_KEY, '1');
    if (query.debug === 'off') env.session.remove(DEBUG_SESSION_KEY);
    const onMedia = (reason: RelatchReason) => () => {
      signals = readSignals();
      update(reason);
    };
    const stops = [
      env.reducedMotion.subscribe(onMedia('reduced-motion')),
      env.finePointer.subscribe(onMedia('resize')),
      env.wide.subscribe(onMedia('resize')),
      env.onLoad(runProbe),
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
