/**
 * Quality tier selection for the home experience. Pure: no window, navigator, storage or clock
 * access; the experience provider collects the inputs in the browser and passes them in.
 *
 * Precedence (decision D-Q3): reduced motion > no WebGL 2 > site cap > explicit override >
 * detection. The frame monitor only acts in 'auto' mode and never steps up within a visit.
 * WebGL 2 seen only in the probe's worker counts until a tier that mounts the canvas confirms it
 * on the main thread (tierStore). Phone mode (a coarse pointer under 1024 px, phone spec D23)
 * adds three weak-phone rules to detection: 2 GB or less, a remembered light floor, and the CPU
 * blocking measured from FCP to the engine gate.
 */

export type Tier = 0 | 1 | 2 | 3;
export type TierOverride = 'auto' | Tier;

/** The result of detect-gpu 5.0.70 `getGPUTier()`. */
export interface GpuResult {
  tier: number;
  type: 'SSR' | 'WEBGL_UNSUPPORTED' | 'BLOCKLISTED' | 'FALLBACK' | 'BENCHMARK';
  fps?: number;
  isMobile?: boolean;
  gpu?: string;
}

export interface TierInputs {
  reducedMotion: boolean;
  webgl2: boolean;
  renderer: string | null;
  /** null when the probe did not run. */
  gpu: GpuResult | null;
  saveData: boolean;
  deviceMemory: number | null;
  viewport: { width: number; height: number; dpr: number };
  finePointer: boolean;
  savedOverride: TierOverride;
  queryOverride: Tier | null;
  /** `?tier=N` is 'fixed'; `?tier=N&monitor=1` is 'auto' starting at N. */
  queryMode: 'fixed' | 'auto';
  siteCap: Tier | null;
  /** Long-animation-frame blocking from FCP (ms); null without the entry type (WebKit, Gecko). */
  cpuBlockingMs: number | null;
  /** An active `sefid-light` record (the second stepped-down page view in 14 days). */
  lightFloor: boolean;
}

export type TierReason =
  | 'reduced-motion'
  | 'no-webgl2'
  | 'software-renderer'
  | 'save-data'
  | 'gpu-benchmark'
  | 'device-memory'
  | 'device-cpu'
  | 'light-floor'
  | 'user-override'
  | 'query-override'
  | 'site-cap';

export interface TierSettings {
  webgl: boolean;
  dprCap: number | null;
  renderScale: number | null;
  pixelRatio: number | null;
  post: { bloom: boolean; grain: boolean; dof: boolean };
  particleFactor: number;
  scene5Particles: number;
  shadows: 'soft' | 'hard' | 'none';
  transmission: number;
  scenes3d: 'all' | 'hero-exit-and-molar' | 'none';
  pinnedScenes: boolean;
  compareWipe: 'webgl' | 'dom';
  carousel3d: boolean;
  footerPlayground: '3d' | 'dom' | 'static';
  playgroundCollisions: boolean;
  pointerParallax: boolean;
  heroExitParallax: boolean;
  heroExitMask: boolean;
  molar: 'canvas' | 'posters' | 'svg-stepper';
  gpuMemoryBudgetMB: number;
  webglAssetBudgetKB: number;
  maxTextureSize: number;
}

export interface TierDecision {
  tier: Tier;
  detectedTier: Tier;
  reason: TierReason;
  mode: 'auto' | 'fixed';
  settings: TierSettings;
}

/** detect-gpu fps thresholds (decision D-Q1); phase 8 recalibrates on real devices. */
export const DETECT_GPU_TIERS: { desktop: number[]; mobile: number[] } = {
  desktop: [0, 15, 60, 120],
  mobile: [0, 15, 40, 60],
};

export const MONITOR_FPS_FLOOR = 55;
/** Slow time that drops one tier; in phone mode MONITOR_PHONE_HOLD_MS drops to tier 0 at once. */
export const MONITOR_HOLD_MS = 2000;
/** [guess: calibrated on the owner's phone, a GE8320 phone and an iPhone before step 9] */
export const MONITOR_PHONE_HOLD_MS = 1000;
/** Phone mode: a blocking sum over this from FCP to the engine gate is a weak CPU. [guess: 300-500] */
export const CPU_BLOCKING_MS = 400;
/** localStorage, { n, until }: monitor drops to tier 0 in phone mode; active from n = 2. */
export const LIGHT_FLOOR_KEY = 'sefid-light';
/** How long a floor record lasts after its last drop. [guess] */
export const LIGHT_FLOOR_MS = 14 * 24 * 60 * 60 * 1000;
/** localStorage, TierOverride as a string. */
export const QUALITY_STORAGE_KEY = 'sefid-quality';
/** localStorage, { v: '5.0.70', renderer, tier, type, fps }. */
export const GPU_CACHE_KEY = 'sefid-gpu';
/** sessionStorage, the lowest tier the monitor reached. */
export const TIER_CAP_SESSION_KEY = 'sefid-tier-cap';
/** sessionStorage, '1'. */
export const DEBUG_SESSION_KEY = 'sefid-debug';
/** Self-hosted detect-gpu benchmark data (no third-party request on public pages). */
export const GPU_BENCHMARKS_URL = '/detect-gpu/benchmarks';

const PIN_MIN_WIDTH = 1024;
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|lavapipe|software rasterizer|basic render driver|apple software renderer/i;

const clampTier = (value: number): Tier =>
  (Number.isFinite(value) ? Math.min(3, Math.max(0, Math.floor(value))) : 0) as Tier;

/** Software rasterizers that detect-gpu 5.0.70 reports as tier 1 FALLBACK (measured). */
export function isSoftwareRenderer(renderer: string | null): boolean {
  return renderer !== null && SOFTWARE_RENDERER.test(renderer);
}

/** A stored «کیفیت» choice; anything but '0'..'3' is 'auto', so corrupt storage never throws. */
export function parseSavedOverride(raw: string | null): TierOverride {
  return raw !== null && /^[0-3]$/.test(raw) ? (Number(raw) as Tier) : 'auto';
}

/** `features.qualityTierOverride`: 'auto' or an unknown value means no cap. */
export function siteCapFrom(value: string | null | undefined): Tier | null {
  return typeof value === 'string' && /^[0-3]$/.test(value) ? (Number(value) as Tier) : null;
}

/** A coarse pointer under 1024 px: where the weak-phone rules, the one-step drop and D28 apply. */
export function isPhoneMode(inputs: Pick<TierInputs, 'viewport' | 'finePointer'>): boolean {
  return !inputs.finePointer && inputs.viewport.width < PIN_MIN_WIDTH;
}

function detect(inputs: TierInputs): { tier: Tier; reason: TierReason } {
  // Save-Data first (phone spec 1.2, class D before W): the visitor's own setting names the reason,
  // so the light notice, which explains only the device's decisions, stays closed.
  if (inputs.saveData) return { tier: 0, reason: 'save-data' };
  if (isSoftwareRenderer(inputs.renderer)) return { tier: 0, reason: 'software-renderer' };
  // D23: the GPU benchmark rates the common weak phones (PowerVR GE8320, Mali-G52 MC2) tier 1.
  if (isPhoneMode(inputs)) {
    // Chromium reports a power of two: a 3 GB phone reports 2. [guess on the rounding]
    if (inputs.deviceMemory !== null && inputs.deviceMemory <= 2) {
      return { tier: 0, reason: 'device-memory' };
    }
    if (inputs.lightFloor) return { tier: 0, reason: 'light-floor' };
    if (inputs.cpuBlockingMs !== null && inputs.cpuBlockingMs > CPU_BLOCKING_MS) {
      return { tier: 0, reason: 'device-cpu' };
    }
  }

  const { gpu } = inputs;
  let tier: Tier;
  if (gpu === null) tier = 1;
  else if (gpu.type === 'BENCHMARK') tier = clampTier(gpu.tier);
  else if (gpu.type === 'FALLBACK') tier = 1;
  else tier = 0;

  // Device memory caps (decision D-Q2); the API is absent in Safari and Firefox: no cap.
  const memory = inputs.deviceMemory;
  const cap: Tier | null = memory === null ? null : memory <= 2 ? 1 : memory <= 4 ? 2 : null;
  if (cap !== null && tier > cap) return { tier: cap, reason: 'device-memory' };
  return { tier, reason: 'gpu-benchmark' };
}

export function selectTier(inputs: TierInputs): TierDecision {
  const mode: TierDecision['mode'] =
    (inputs.queryOverride !== null && inputs.queryMode === 'fixed') ||
    inputs.savedOverride !== 'auto'
      ? 'fixed'
      : 'auto';
  const detected = inputs.webgl2
    ? detect(inputs)
    : { tier: 0 as Tier, reason: 'no-webgl2' as const };

  let tier: Tier;
  let reason: TierReason;
  if (inputs.reducedMotion) {
    tier = 0;
    reason = 'reduced-motion';
  } else if (!inputs.webgl2) {
    tier = 0;
    reason = 'no-webgl2';
  } else {
    ({ tier, reason } = detected);
    if (inputs.queryOverride !== null) {
      tier = inputs.queryOverride;
      reason = 'query-override';
    } else if (inputs.savedOverride !== 'auto') {
      tier = inputs.savedOverride;
      reason = 'user-override';
    }
    if (inputs.siteCap !== null && tier > inputs.siteCap) {
      tier = inputs.siteCap;
      reason = 'site-cap';
    }
  }

  return {
    tier,
    detectedTier: detected.tier,
    reason,
    mode,
    settings: tierSettings(tier, inputs.viewport, inputs.finePointer),
  };
}

const DPR_CAP: Record<Tier, number | null> = { 3: 2, 2: 1.5, 1: 1, 0: null };
const RENDER_SCALE: Record<Tier, number | null> = { 3: 1, 2: 1, 1: 0.75, 0: null };

/** Settings per tier (spec table 6.5). */
export function tierSettings(
  tier: Tier,
  viewport: TierInputs['viewport'],
  finePointer: boolean,
): TierSettings {
  const wide = viewport.width >= PIN_MIN_WIDTH;
  const high = tier >= 2;
  const dprCap = DPR_CAP[tier];
  const renderScale = RENDER_SCALE[tier];
  const dpr = Number.isFinite(viewport.dpr) && viewport.dpr > 0 ? viewport.dpr : 1;
  return {
    webgl: tier > 0,
    dprCap,
    renderScale,
    pixelRatio:
      dprCap === null || renderScale === null ? null : Math.min(dpr, dprCap) * renderScale,
    post: { bloom: tier === 3, grain: high, dof: tier === 3 },
    particleFactor: ([0, 0.2, 0.5, 1] as const)[tier],
    scene5Particles: ([0, 600, 1500, 3000] as const)[tier],
    shadows: tier === 3 ? 'soft' : tier === 2 ? 'hard' : 'none',
    transmission: tier === 3 ? 0.15 : 0,
    scenes3d: high ? 'all' : tier === 1 ? 'hero-exit-and-molar' : 'none',
    pinnedScenes: high && wide,
    compareWipe: high && wide ? 'webgl' : 'dom',
    carousel3d: high,
    footerPlayground: tier === 3 ? '3d' : tier === 0 ? 'static' : 'dom',
    playgroundCollisions: tier === 3,
    pointerParallax: tier > 0 && finePointer,
    heroExitParallax: tier > 0 && wide,
    heroExitMask: high && wide,
    molar: high || (tier === 1 && wide) ? 'canvas' : tier === 1 ? 'posters' : 'svg-stepper',
    gpuMemoryBudgetMB: ([0, 64, 128, 256] as const)[tier],
    webglAssetBudgetKB: ([0, 500, 1200, 2500] as const)[tier],
    maxTextureSize: 2048,
  };
}

export interface MonitorState {
  tier: Tier;
  /** Slow sampled time since the last good window (D26: it adds up, a good window resets it). */
  slowMs: number;
  mode: 'auto' | 'fixed';
  /** Phone mode: MONITOR_PHONE_HOLD_MS goes to tier 0 in one step. */
  phone: boolean;
}

/**
 * One frame-rate sample (a window of `windowMs`, about 250 ms). A window under MONITOR_FPS_FLOOR
 * adds its length to `slowMs`; a good one resets it. At MONITOR_HOLD_MS the tier drops by one, in
 * phone mode at MONITOR_PHONE_HOLD_MS it goes to 0 (tiers 1 to 3 are one scroll set there, so a
 * middle step only prolongs the jank), and `slowMs` restarts. Fixed mode and tier 0 never change,
 * and the tier never steps up.
 */
export function monitorStep(
  state: MonitorState,
  sample: { windowMs: number; fps: number },
): MonitorState {
  if (state.mode === 'fixed' || state.tier === 0) return state;
  if (!Number.isFinite(sample.fps) || !(sample.windowMs >= 0)) return state;
  if (sample.fps >= MONITOR_FPS_FLOOR) return state.slowMs === 0 ? state : { ...state, slowMs: 0 };
  const slowMs = state.slowMs + sample.windowMs;
  if (state.phone && slowMs >= MONITOR_PHONE_HOLD_MS) return { ...state, tier: 0, slowMs: 0 };
  if (!state.phone && slowMs >= MONITOR_HOLD_MS) {
    return { ...state, tier: (state.tier - 1) as Tier, slowMs: 0 };
  }
  return { ...state, slowMs };
}
