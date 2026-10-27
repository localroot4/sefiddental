/**
 * Developer snapshot (spec EXP 3.11): one JSON shape for the overlay rows and for
 * `window.__sefid.snapshot()`, which Playwright reads. Installed only with the debug flag.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { Tier, TierOverride } from '@/lib/qualityTier';

import type { SceneId } from '../scenes/types';
import type { TierState } from '../tier/tierStore';

import type { Gate } from './gates';
import type { ExperienceState, FrameRuntime, Store } from './store';

export interface DebugSnapshot {
  fps: number | null;
  frameMsP50: number | null;
  frameMsP95: number | null;
  tier: Tier;
  reason: string;
  detectedTier: Tier | null;
  mode: 'auto' | 'fixed';
  status: 'pending' | 'ready';
  monitorCap: Tier | null;
  lastStep: TierState['lastStep'];
  layout: TierState['layout'];
  gpu: { type: string; tier: number; fps: number | null; renderer: string | null } | null;
  webgl2: boolean | null;
  dpr: {
    device: number;
    cap: number | null;
    renderScale: number | null;
    pixelRatio: number | null;
    performance: number | null;
  };
  memory: {
    heapUsedMB: number | null;
    heapLimitMB: number | null;
    geometries: number | null;
    textures: number | null;
    programs: number | null;
    calls: number | null;
    triangles: number | null;
  };
  gate: Gate;
  framesRendered: number;
  lenis: boolean;
  scrollTriggers: number;
  progress: number;
  velocity: number;
  /** Phase 7: the active scene, its 0..1 progress and the fps seen while it was active. */
  scene: SceneId | null;
  sceneProgress: number;
  sceneFps: { mean: number; min: number } | null;
  /** The master's labels in time order (one per present scene). */
  labels: string[];
  engineInitMs: number | null;
  /** The engine's ticker callbacks (subscribers plus Lenis's raf); 0 after teardown. */
  tickSubscribers: number;
  /** Live Draggable instances on elements in the document once the plugin is registered, else 0. */
  draggables: number;
}

declare global {
  interface Window {
    __sefid?: {
      snapshot(): DebugSnapshot;
      /** The «کیفیت» choice for tests that run before the control lands (T-EN4). */
      setUserOverride(override: TierOverride): void;
    };
  }
}

const FRAME_HISTORY = 120;
const FPS_WINDOW_MS = 500;

/** gsap ticks per second over 500 ms, and frame-time percentiles over the last 120 ticks. */
export function createFpsMeter(): {
  read(): { fps: number | null; p50: number | null; p95: number | null };
  stop(): void;
} {
  const deltas: number[] = [];
  const stamps: number[] = [];
  const onTick = (time: number, deltaTime: number): void => {
    deltas.push(deltaTime);
    if (deltas.length > FRAME_HISTORY) deltas.shift();
    stamps.push(time * 1000);
    while (stamps.length > 0 && (stamps[0] ?? 0) < time * 1000 - FPS_WINDOW_MS) stamps.shift();
  };
  gsap.ticker.add(onTick);
  const percentile = (sorted: number[], p: number): number | null =>
    sorted.length === 0
      ? null
      : (sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? null);
  return {
    read() {
      const sorted = [...deltas].sort((a, b) => a - b);
      const nowMs = gsap.ticker.time * 1000;
      const recent = stamps.filter((t) => t >= nowMs - FPS_WINDOW_MS).length;
      return {
        fps: stamps.length === 0 ? null : (recent * 1000) / FPS_WINDOW_MS,
        p50: percentile(sorted, 0.5),
        p95: percentile(sorted, 0.95),
      };
    },
    stop: () => gsap.ticker.remove(onTick),
  };
}

/** Mean and minimum of the fps readings taken while each scene was active (overlay rate). */
export function createSceneFps(): {
  record(id: SceneId, fps: number | null): void;
  read(id: SceneId | null): { mean: number; min: number } | null;
} {
  const stats = new Map<SceneId, { sum: number; n: number; min: number }>();
  return {
    record(id, fps) {
      if (fps === null) return;
      const entry = stats.get(id) ?? { sum: 0, n: 0, min: Number.POSITIVE_INFINITY };
      entry.sum += fps;
      entry.n += 1;
      entry.min = Math.min(entry.min, fps);
      stats.set(id, entry);
    },
    read(id) {
      const entry = id === null ? undefined : stats.get(id);
      return entry ? { mean: round(entry.sum / entry.n, 1), min: round(entry.min, 1) } : null;
    },
  };
}

// Draggable registers as a gsap global (gsap-core `_addGlobal`), not under `gsap.plugins`. It
// keeps no public list of its instances (3.15): `get(target)` answers for an element it marked
// with `_gsDragID`, and nothing once that instance is killed. An instance on a detached element
// is invisible here (the heap row covers that leak), so a scene kills its own in its cleanup.
type Globals = Record<string, { get?: (target: Element) => unknown } | undefined>;
function draggableCount(): number {
  const core = (gsap as unknown as { core?: { globals?: () => Globals } }).core;
  const Draggable = core?.globals?.().Draggable;
  if (!Draggable?.get) return 0;
  // One instance can mark two elements (a scroll proxy): count instances, not marks.
  const alive = new Set<unknown>();
  for (const el of document.querySelectorAll('*')) {
    if ('_gsDragID' in el) alive.add(Draggable.get(el));
  }
  alive.delete(undefined);
  return alive.size;
}

type HeapPerformance = Performance & {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
};

const MB = 1024 * 1024;
const round = (value: number, digits = 2): number => Number(value.toFixed(digits));

export function buildSnapshot(sources: {
  tier: TierState;
  runtime: FrameRuntime;
  experience: Store<ExperienceState>;
  fps: ReturnType<typeof createFpsMeter>;
  sceneFps?: ReturnType<typeof createSceneFps>;
}): DebugSnapshot {
  const { tier, runtime } = sources;
  const engine = sources.experience.get().engine;
  const r3f = runtime.r3f?.() ?? null;
  const info = r3f?.gl.info ?? null;
  const heap = (performance as HeapPerformance).memory;
  const fps = sources.fps.read();
  const place = engine?.activeScene() ?? null;
  if (place) sources.sceneFps?.record(place.id, fps.fps);
  return {
    fps: fps.fps === null ? null : round(fps.fps, 1),
    frameMsP50: fps.p50 === null ? null : round(fps.p50, 1),
    frameMsP95: fps.p95 === null ? null : round(fps.p95, 1),
    tier: tier.tier,
    reason: tier.reason,
    detectedTier: tier.decision?.detectedTier ?? null,
    mode: tier.mode,
    status: tier.status,
    monitorCap: tier.monitorCap,
    lastStep: tier.lastStep,
    layout: tier.layout,
    gpu: tier.probe?.gpu
      ? {
          type: tier.probe.gpu.type,
          tier: tier.probe.gpu.tier,
          fps: tier.probe.gpu.fps ?? null,
          renderer: tier.probe.renderer,
        }
      : null,
    webgl2: tier.probe?.webgl2 ?? null,
    dpr: {
      device: window.devicePixelRatio || 1,
      cap: tier.settings.dprCap,
      renderScale: tier.settings.renderScale,
      pixelRatio: r3f ? r3f.gl.getPixelRatio() : null,
      performance: r3f ? r3f.performance.current : null,
    },
    memory: {
      heapUsedMB: heap ? round(heap.usedJSHeapSize / MB, 1) : null,
      heapLimitMB: heap ? round(heap.jsHeapSizeLimit / MB, 1) : null,
      geometries: info ? info.memory.geometries : null,
      textures: info ? info.memory.textures : null,
      programs: info ? (info.programs?.length ?? 0) : null,
      calls: info ? info.render.calls : null,
      triangles: info ? info.render.triangles : null,
    },
    gate: runtime.gate,
    framesRendered: runtime.framesRendered,
    lenis: engine?.lenis != null,
    scrollTriggers: ScrollTrigger.getAll().length,
    progress: engine ? round(engine.progress(), 4) : 0,
    velocity: engine ? round(engine.velocity(), 1) : 0,
    scene: place?.id ?? null,
    sceneProgress: place ? round(place.progress, 4) : 0,
    sceneFps: sources.sceneFps?.read(place?.id ?? null) ?? null,
    labels: engine?.labels() ?? [],
    engineInitMs: engine ? round(engine.initMs, 1) : null,
    tickSubscribers: engine?.tickSubscribers() ?? 0,
    draggables: draggableCount(),
  };
}

/** Installs `window.__sefid`; returns the uninstall (route change removes it, spec P11). */
export function installDebugHook(
  snapshot: () => DebugSnapshot,
  setUserOverride: (override: TierOverride) => void,
): () => void {
  window.__sefid = { snapshot, setUserOverride };
  return () => {
    delete window.__sefid;
  };
}
