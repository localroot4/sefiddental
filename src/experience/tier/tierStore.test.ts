import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GpuResult } from '@/lib/qualityTier';

import { parseGpuCache, serializeGpuCache } from './gpuCache';
import type { ProbeResult } from './gpuProbe';
import { createTierStore, hydrationGpu, RELATCH_POLL_MS, type TierEnv } from './tierStore';

// TS26 swaps in a registry where a scene declares `webgl.load` (phase 8); today none does.
const registry = vi.hoisted(() => ({ sceneLoadsWebgl: false }));
vi.mock('../scenes/registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../scenes/registry')>()),
  get SCENES_LOAD_WEBGL() {
    return registry.sceneLoadsWebgl;
  },
}));

const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
const SWIFTSHADER =
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';

function fakeMedia(initial: boolean) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    matches: () => value,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    set(next: boolean) {
      value = next;
      for (const cb of listeners) cb();
    },
  };
}

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: (k: string) => data.get(k) ?? null,
    set: (k: string, v: string) => void data.set(k, v),
    remove: (k: string) => void data.delete(k),
  };
}

interface FakeOptions {
  search?: string;
  local?: Record<string, string>;
  session?: Record<string, string>;
  reducedMotion?: boolean;
  fine?: boolean;
  width?: number;
  probe?: ProbeResult;
  /** What a main-thread <canvas> answers for WebGL 2 (default yes). */
  mainThread?: boolean;
  deviceMemory?: number | null;
  /** The CPU blocking sum the watcher reads (default 0); null: no entry type. */
  cpu?: number | null;
}

/** Wall-clock start of every fake page view. */
const EPOCH = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Phone mode: a coarse pointer at 390 px. */
const PHONE: FakeOptions = { fine: false, width: 390 };

function fakeEnv(o: FakeOptions = {}) {
  let width = o.width ?? 1440;
  const reducedMotion = fakeMedia(o.reducedMotion ?? false);
  const finePointer = fakeMedia(o.fine ?? true);
  const wide = fakeMedia(width >= 1024);
  const local = fakeStorage(o.local);
  const session = fakeStorage(o.session);
  let loadCb: (() => void) | null = null;
  let resolveProbe: ((r: ProbeResult) => void) | null = null;
  const benchmarkCalls: (string | null)[] = [];
  const probeSignals: AbortSignal[] = [];
  let mainThreadChecks = 0;
  const timers = new Set<() => void>();
  let now = 0;
  let scrollY = 0;
  const cpu = { ms: o.cpu === undefined ? 0 : o.cpu, watching: 0, reads: 0 };
  const env: TierEnv = {
    reducedMotion,
    finePointer,
    wide,
    viewport: () => ({ width, height: 900, dpr: 1 }),
    saveData: () => false,
    deviceMemory: () => (o.deviceMemory === undefined ? 8 : o.deviceMemory),
    search: () => o.search ?? '',
    local,
    session,
    onLoad: (cb) => {
      loadCb = cb;
      return () => {
        loadCb = null;
      };
    },
    probe: ({ benchmark, signal }) =>
      new Promise<ProbeResult>((resolve) => {
        const result = o.probe ?? { webgl2: true, renderer: RTX, gpu: null };
        benchmarkCalls.push(benchmark(result.renderer) ? result.renderer : null);
        probeSignals.push(signal);
        resolveProbe = resolve;
      }),
    watchCpuBlocking: () => {
      cpu.watching += 1;
      return {
        readMs: () => {
          cpu.reads += 1;
          return cpu.ms;
        },
        stop: () => {
          cpu.watching -= 1;
        },
      };
    },
    webgl2OnMainThread: () => {
      mainThreadChecks++;
      return o.mainThread ?? true;
    },
    scrollY: () => scrollY,
    now: () => now,
    epochMs: () => EPOCH + now,
    every: (_ms, cb) => {
      timers.add(cb);
      return () => timers.delete(cb);
    },
  };
  return {
    env,
    reducedMotion,
    finePointer,
    wide,
    local,
    session,
    benchmarkCalls,
    probeSignals,
    cpu,
    mainThreadChecks: () => mainThreadChecks,
    /** Fires `load` and resolves the probe with `result`. */
    async load(result?: ProbeResult) {
      loadCb?.();
      resolveProbe?.(result ?? o.probe ?? { webgl2: true, renderer: RTX, gpu: null });
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    /** Fires `load` only: the probe stays pending until `answer`. */
    fireLoad() {
      loadCb?.();
    },
    async answer(result: ProbeResult) {
      resolveProbe?.(result);
      await new Promise((resolve) => setTimeout(resolve, 0));
    },
    tick(ms: number, y = scrollY) {
      scrollY = y;
      now += ms;
      for (const cb of [...timers]) cb();
    },
    pendingTimers: () => timers.size,
    setWidth(next: number) {
      width = next;
      wide.set(next >= 1024);
    },
  };
}

const benchmark3: GpuResult = { tier: 3, type: 'BENCHMARK', fps: 240 };

function started(o: FakeOptions = {}, siteCap: 0 | 1 | 2 | 3 | null = null) {
  const fake = fakeEnv(o);
  const store = createTierStore(fake.env, { siteCap });
  const unsubscribe = store.subscribe(() => {});
  return { fake, store, unsubscribe, state: () => store.getSnapshot() };
}

describe('tier store: hydration (synchronous tier)', () => {
  it('TS1 no cache: pending, tier 1, Lenis on a fine pointer, no pins', () => {
    const { state } = started();
    expect(state()).toMatchObject({ hydrated: true, status: 'pending', tier: 1, mode: 'auto' });
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 1 });
  });

  it('TS2 hydration reads a valid sefid-gpu (a returning visitor pins before the probe); a corrupt or stale one reads as none', () => {
    const { state } = started({ local: { 'sefid-gpu': serializeGpuCache(RTX, benchmark3) } });
    expect(state()).toMatchObject({ tier: 3, status: 'pending', reason: 'gpu-benchmark' });
    expect(state().layout).toEqual({ pinnedScenes: true, lenis: true, latchedAtTier: 3 });
    const software = started({
      local: { 'sefid-gpu': serializeGpuCache(SWIFTSHADER, benchmark3) },
    });
    expect(software.state()).toMatchObject({ tier: 0, reason: 'software-renderer' });
    for (const raw of ['{', '[]', serializeGpuCache(RTX, benchmark3).replace('5.0.70', '5.0.1')]) {
      expect(started({ local: { 'sefid-gpu': raw } }).state()).toMatchObject({ tier: 1 });
    }
  });

  it('TS2b hydrationGpu accepts exactly what gpuCache accepts', () => {
    const raws = [
      null,
      '{',
      'null',
      '[1]',
      '5',
      serializeGpuCache(RTX, benchmark3),
      serializeGpuCache(RTX, { tier: 1, type: 'FALLBACK' }),
      JSON.stringify({ v: '5.0.70', renderer: RTX, tier: 2, type: 'BENCHMARK' }),
      JSON.stringify({ v: '5.0.70', renderer: RTX, tier: 2, type: 'BENCHMARK', fps: '9' }),
      JSON.stringify({ v: '5.0.70', renderer: RTX, tier: '2', type: 'BENCHMARK' }),
      JSON.stringify({ v: '5.0.70', renderer: 7, tier: 2, type: 'BENCHMARK' }),
      JSON.stringify({ v: '5.0.70', renderer: RTX, tier: 2, type: 'GPU' }),
      JSON.stringify({ v: '5.0.71', renderer: RTX, tier: 2, type: 'BENCHMARK' }),
    ];
    for (const raw of raws) {
      const zod = parseGpuCache(raw, null);
      expect(hydrationGpu(raw), String(raw)).toEqual(
        zod && { renderer: zod.renderer, gpu: { tier: zod.gpu.tier, type: zod.gpu.type } },
      );
    }
  });

  it('TS3 a corrupt sefid-quality reads as auto; a valid one is a fixed user override', () => {
    expect(started({ local: { 'sefid-quality': 'high' } }).state().mode).toBe('auto');
    const fixed = started({ local: { 'sefid-quality': '2' } }).state();
    expect(fixed).toMatchObject({ tier: 2, mode: 'fixed', reason: 'user-override' });
  });

  it('TS4 the session tier cap from an earlier page lowers an auto tier (E6)', () => {
    const { state } = started({ search: '?tier=3&monitor=1', session: { 'sefid-tier-cap': '1' } });
    expect(state()).toMatchObject({ tier: 1, reason: 'monitor', monitorCap: 1 });
    expect(state().settings.pixelRatio).toBe(0.75);
    expect(state().layout.pinnedScenes).toBe(false);
  });

  it('TS5 the site cap from the features global lowers the tier', () => {
    const { state } = started({ search: '?tier=3' }, 1);
    expect(state()).toMatchObject({ tier: 1, reason: 'site-cap' });
  });
});

describe('tier store: probe after load and the detection relatch (X30)', () => {
  it('TS6 software renderer: tier 0 and the layout relatches before the first pinned scene', async () => {
    const { fake, state } = started({ probe: { webgl2: true, renderer: SWIFTSHADER, gpu: null } });
    await fake.load();
    expect(fake.benchmarkCalls).toEqual([null]); // detect-gpu never ran
    expect(state()).toMatchObject({ status: 'ready', tier: 0, reason: 'software-renderer' });
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: false, latchedAtTier: 0 });
  });

  it('TS7 benchmark tier 3 relatches to pins when the reader has not reached scene 3', async () => {
    const { fake, store, state } = started({
      probe: { webgl2: true, renderer: RTX, gpu: benchmark3 },
    });
    store.setScrollProbe({ insidePinnedRange: () => false, reachedFirstPinnedScene: () => false });
    await fake.load();
    expect(fake.benchmarkCalls).toEqual([RTX]);
    expect(state()).toMatchObject({ tier: 3, reason: 'gpu-benchmark' });
    expect(state().layout.pinnedScenes).toBe(true);
  });

  it('TS8 after the first pinned scene the latch holds; GPU settings follow the tier', async () => {
    const { fake, store, state } = started({
      probe: { webgl2: true, renderer: RTX, gpu: benchmark3 },
    });
    store.setScrollProbe({ insidePinnedRange: () => false, reachedFirstPinnedScene: () => true });
    await fake.load();
    expect(state().tier).toBe(3);
    expect(state().settings.post.bloom).toBe(true);
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 1 });
  });

  it('TS8b a detection drop to tier 0 removes Lenis after the first pinned scene, at scroll idle (D25)', async () => {
    const { fake, store, state } = started({ probe: { webgl2: false, renderer: null, gpu: null } });
    store.setScrollProbe({ insidePinnedRange: () => false, reachedFirstPinnedScene: () => true });
    await fake.load();
    expect(state().tier).toBe(0);
    expect(state().layout.lenis).toBe(true);
    fake.tick(RELATCH_POLL_MS * 4);
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: false, latchedAtTier: 0 });
  });

  it('TS9 no WebGL 2 beats a query override', async () => {
    const { fake, state } = started({
      search: '?tier=3',
      probe: { webgl2: false, renderer: null, gpu: null },
    });
    expect(state().tier).toBe(3);
    await fake.load();
    expect(state()).toMatchObject({ tier: 0, reason: 'no-webgl2' });
  });

  it('TS10 an explicit override skips the benchmark', async () => {
    const { fake } = started({ search: '?tier=2' });
    await fake.load();
    expect(fake.benchmarkCalls).toEqual([null]);
  });
});

describe('tier store: a WebGL 2 context seen only in the probe worker (D-Q3)', () => {
  afterEach(() => {
    registry.sceneLoadsWebgl = false;
  });

  const workerOnly: ProbeResult = {
    webgl2: true,
    renderer: SWIFTSHADER,
    gpu: null,
    workerOnly: true,
  };

  it('TS22 no WebGL 2 on a main-thread canvas beats ?tier=3, whatever the worker saw', async () => {
    const { fake, state } = started({ search: '?tier=3', probe: workerOnly, mainThread: false });
    await fake.load();
    expect(fake.mainThreadChecks()).toBe(1);
    expect(state()).toMatchObject({ tier: 0, reason: 'no-webgl2' });
    expect(state().probe?.webgl2).toBe(false);
  });

  it('TS23 tier 1 draws no WebGL: the worker answer stands and no main-thread context is made', async () => {
    const { fake, state } = started({ search: '?tier=1', probe: workerOnly, mainThread: false });
    await fake.load();
    expect(fake.mainThreadChecks()).toBe(0);
    expect(state()).toMatchObject({ tier: 1, reason: 'query-override' });
    expect(state().probe).toEqual(workerOnly);
  });

  it('TS24 tier 1 under the debug flag mounts the canvas, so the main thread decides', async () => {
    const { fake, state } = started({
      search: '?tier=1&debug=1',
      probe: workerOnly,
      mainThread: false,
    });
    await fake.load();
    expect(state()).toMatchObject({ tier: 0, reason: 'no-webgl2' });
  });

  it('TS25 a later tier that mounts the canvas confirms once; a main-thread yes keeps it', async () => {
    const { fake, state } = started({ search: '?tier=1', probe: workerOnly });
    await fake.load();
    state().setPageOverride(3);
    expect(fake.mainThreadChecks()).toBe(1);
    expect(state()).toMatchObject({ tier: 3, reason: 'query-override' });
    expect(state().probe).toMatchObject({ webgl2: true, renderer: SWIFTSHADER, workerOnly: false });
    state().setPageOverride(2);
    expect(fake.mainThreadChecks()).toBe(1);
  });

  it('TS26 tier 1 once a scene loads WebGL mounts the canvas, so the main thread decides', async () => {
    registry.sceneLoadsWebgl = true;
    const { fake, state } = started({ search: '?tier=1', probe: workerOnly, mainThread: false });
    await fake.load();
    expect(fake.mainThreadChecks()).toBe(1);
    expect(state()).toMatchObject({ tier: 0, reason: 'no-webgl2' });
  });
});

describe('tier store: frame monitor drops (E6)', () => {
  it('TS11 ?tier=3&monitor=1 is auto: three drops reach tier 0 and the cap is saved', async () => {
    const { fake, state } = started({ search: '?tier=3&monitor=1' });
    await fake.load();
    expect(state()).toMatchObject({ tier: 3, mode: 'auto', reason: 'query-override' });
    state().stepDown('monitor');
    expect(state()).toMatchObject({ tier: 2, reason: 'monitor', monitorCap: 2 });
    state().stepDown('monitor');
    state().stepDown('monitor');
    expect(state()).toMatchObject({ tier: 0, monitorCap: 0 });
    expect(state().settings.webgl).toBe(false);
    expect(fake.session.data.get('sefid-tier-cap')).toBe('0');
    state().stepDown('monitor'); // nothing below 0
    expect(state().tier).toBe(0);
  });

  it('TS12 ?tier=3 alone is fixed: the monitor does not step', async () => {
    const { fake, state } = started({ search: '?tier=3' });
    await fake.load();
    state().stepDown('monitor');
    expect(state()).toMatchObject({ tier: 3, mode: 'fixed', monitorCap: null });
  });

  it('TS12b a session cap from an earlier page never lowers a fixed tier', () => {
    const { state } = started({ search: '?tier=3', session: { 'sefid-tier-cap': '1' } });
    expect(state()).toMatchObject({ tier: 3, mode: 'fixed', reason: 'query-override' });
  });

  it('TS13 a monitor relatch waits until outside pins and 1000 ms without scrolling', async () => {
    const { fake, store, state } = started({ search: '?tier=3&monitor=1' });
    let inside = true;
    store.setScrollProbe({ insidePinnedRange: () => inside, reachedFirstPinnedScene: () => true });
    await fake.load();
    expect(state().layout.pinnedScenes).toBe(true);
    state().stepDown('monitor'); // 3 -> 2: same layout
    expect(fake.pendingTimers()).toBe(0);
    state().stepDown('monitor'); // 2 -> 1: pins go, but the reader is inside a pin
    expect(state().tier).toBe(1);
    expect(state().layout.pinnedScenes).toBe(true);
    fake.tick(RELATCH_POLL_MS * 8, 0);
    expect(state().layout.pinnedScenes).toBe(true);
    inside = false;
    fake.tick(RELATCH_POLL_MS, 500); // scrolled: idle restarts
    fake.tick(RELATCH_POLL_MS * 3, 500);
    expect(state().layout.pinnedScenes).toBe(true);
    fake.tick(RELATCH_POLL_MS, 500); // 1000 ms idle outside every pin
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 1 });
    expect(fake.pendingTimers()).toBe(0);
  });

  it('TS14 a second context loss forces tier 0 even in fixed mode', async () => {
    const { fake, state } = started({ search: '?tier=3' });
    await fake.load();
    state().stepDown('context-loss');
    expect(state()).toMatchObject({ tier: 0, reason: 'context-loss' });
    expect(state().lastStep).toMatchObject({ source: 'context-loss', tier: 0 });
  });
});

describe('tier store: live changes and controls', () => {
  const cachedRtx = { probe: { webgl2: true, renderer: RTX, gpu: benchmark3 } };

  it('TS15 turning reduced motion on gives tier 0 and relatches at once, even inside a pin', async () => {
    const { fake, store, state } = started(cachedRtx);
    store.setScrollProbe({ insidePinnedRange: () => true, reachedFirstPinnedScene: () => true });
    await fake.load();
    fake.reducedMotion.set(true);
    expect(state()).toMatchObject({ tier: 0, reason: 'reduced-motion' });
    expect(state().layout.latchedAtTier).toBe(0);
    fake.reducedMotion.set(false);
    expect(state().tier).toBe(3);
  });

  it('TS21 no GPU probe while the tier is fixed at 0; it runs once that can change', async () => {
    const reduced = started({ reducedMotion: true });
    expect(reduced.state().status).toBe('pending');
    await reduced.fake.load();
    expect(reduced.fake.benchmarkCalls).toHaveLength(0);
    // A probe that is not needed counts as decided (phone spec 1.6).
    expect(reduced.state()).toMatchObject({ tier: 0, status: 'ready' });
    reduced.fake.reducedMotion.set(false);
    expect(reduced.fake.benchmarkCalls).toHaveLength(1);
    expect(reduced.state().status).toBe('pending');

    const pinned = started({ search: '?tier=0' });
    await pinned.fake.load();
    expect(pinned.fake.benchmarkCalls).toHaveLength(0);
    pinned.store.getSnapshot().setPageOverride('auto');
    expect(pinned.fake.benchmarkCalls).toHaveLength(1);

    const capped = started({}, 0);
    await capped.fake.load();
    expect(capped.fake.benchmarkCalls).toHaveLength(0);
  });

  it('TS16 crossing 1024 px relatches the pins at once', async () => {
    const { fake, state } = started(cachedRtx);
    await fake.load();
    expect(state().layout.pinnedScenes).toBe(true);
    fake.setWidth(900);
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 3 });
    expect(state().settings.compareWipe).toBe('dom');
  });

  it('TS16a the media query that fired decides wide, even before innerWidth catches up', async () => {
    const { fake, state } = started({ ...cachedRtx, width: 1180 });
    await fake.load();
    expect(state().layout.pinnedScenes).toBe(true);
    // A rotation to portrait: Chromium fires the (min-width: 1024px) change while innerWidth
    // still reads the old 1180 (T-EN8 on tablet-light, probed in the SERVICES lane).
    fake.wide.set(false);
    expect(state().layout.pinnedScenes).toBe(false);
    fake.wide.set(true);
    expect(state().layout.pinnedScenes).toBe(true);
  });

  it('TS16b a pointer change relatches Lenis at once', async () => {
    const { fake, state } = started(cachedRtx);
    await fake.load();
    fake.finePointer.set(false);
    expect(state().layout.lenis).toBe(false);
    expect(state().settings.pointerParallax).toBe(false);
  });

  it('TS17 setUserOverride saves the choice, setPageOverride does not', async () => {
    const { fake, state } = started();
    await fake.load();
    state().setUserOverride(2);
    expect(fake.local.data.get('sefid-quality')).toBe('2');
    expect(state()).toMatchObject({ tier: 2, mode: 'fixed', reason: 'user-override' });
    state().setUserOverride('auto');
    expect(fake.local.data.has('sefid-quality')).toBe(false);
    state().setPageOverride(3);
    expect(state()).toMatchObject({ tier: 3, mode: 'fixed', reason: 'query-override' });
    expect(fake.local.data.has('sefid-quality')).toBe(false);
    state().setPageOverride('auto');
    expect(state().mode).toBe('auto');
  });

  it('TS18 debug=1 sets the session flag, debug=0 clears it; stress needs the flag', () => {
    const on = started({ search: '?debug=1&stress=4' });
    expect(on.state()).toMatchObject({ debug: true, stress: 4 });
    expect(on.fake.session.data.get('sefid-debug')).toBe('1');
    const off = started({ search: '?debug=0', session: { 'sefid-debug': '1' } });
    expect(off.state().debug).toBe(false);
    expect(off.fake.session.data.has('sefid-debug')).toBe(false);
    expect(started({ search: '?stress=4' }).state().stress).toBe(0);
  });

  it('TS19 the snapshot object is stable between changes', () => {
    const { store } = started();
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it('TS20 unsubscribing the last listener removes every listener and timer', async () => {
    const { fake, store, unsubscribe, state } = started({ search: '?tier=3&monitor=1' });
    store.setScrollProbe({ insidePinnedRange: () => true, reachedFirstPinnedScene: () => true });
    await fake.load();
    state().stepDown('monitor');
    state().stepDown('monitor');
    expect(fake.pendingTimers()).toBe(1);
    unsubscribe();
    expect(fake.pendingTimers()).toBe(0);
    const before = state();
    fake.reducedMotion.set(true);
    expect(state()).toBe(before);
  });
});

describe('tier store: phone mode (phone spec section 1)', () => {
  const benchmark1: ProbeResult = {
    webgl2: true,
    renderer: 'Adreno (TM) 610',
    gpu: { tier: 1, type: 'BENCHMARK', fps: 33 },
  };
  const floorOf = (fake: ReturnType<typeof fakeEnv>) =>
    JSON.parse(fake.local.data.get('sefid-light') ?? 'null') as { n: number; until: number } | null;

  it('U-PH5 a monitor drop to 0 counts toward the light floor; the second one lights it for later views', async () => {
    const view1 = started({ ...PHONE, probe: { ...benchmark1, gpu: benchmark3 } });
    await view1.fake.load();
    expect(view1.state()).toMatchObject({ tier: 3, phone: true });
    view1.state().stepDown('monitor');
    // One step to tier 0 in phone mode; a first drop is no floor yet.
    expect(view1.state()).toMatchObject({ tier: 0, reason: 'monitor', monitorCap: 0 });
    expect(view1.state().lastStep).toMatchObject({ source: 'monitor', tier: 0 });
    expect(floorOf(view1.fake)).toEqual({ n: 1, until: EPOCH + 14 * DAY_MS });

    // A later page view in a new session, within 14 days.
    const record1 = view1.fake.local.data.get('sefid-light') ?? '';
    const view2 = started({ ...PHONE, probe: benchmark1, local: { 'sefid-light': record1 } });
    await view2.fake.load();
    expect(view2.state()).toMatchObject({ tier: 1, reason: 'gpu-benchmark' });
    view2.state().stepDown('monitor');
    expect(floorOf(view2.fake)).toEqual({ n: 2, until: EPOCH + 14 * DAY_MS });
    expect(view2.state().reason).toBe('monitor');

    const record2 = view2.fake.local.data.get('sefid-light') ?? '';
    const view3 = started({ ...PHONE, probe: benchmark1, local: { 'sefid-light': record2 } });
    expect(view3.state()).toMatchObject({ tier: 0, reason: 'light-floor', mode: 'auto' });
    expect(view3.state().layout.latchedAtTier).toBe(0);
    await view3.fake.load();
    expect(view3.fake.benchmarkCalls).toHaveLength(0);
    expect(view3.state().status).toBe('ready');

    // A fine pointer ignores the record; an expired one starts again at 1 and lights nothing.
    expect(started({ local: { 'sefid-light': record2 } }).state().reason).not.toBe('light-floor');
    const expired = JSON.stringify({ n: 5, until: EPOCH - 1 });
    const view4 = started({ ...PHONE, probe: benchmark1, local: { 'sefid-light': expired } });
    await view4.fake.load();
    expect(view4.state().tier).toBe(1);
    view4.state().stepDown('monitor');
    expect(floorOf(view4.fake)).toEqual({ n: 1, until: EPOCH + 14 * DAY_MS });
    // A corrupt record is no record.
    const corrupt = started({ ...PHONE, local: { 'sefid-light': '{"n":"2"' } });
    expect(corrupt.state().reason).not.toBe('light-floor');

    // Any explicit choice removes it.
    view3.state().setUserOverride('auto');
    expect(view3.fake.local.data.has('sefid-light')).toBe(false);
    expect(view3.state().reason).not.toBe('light-floor');
  });

  it('U-PH5b a fine pointer steps one tier and writes no floor; a context loss writes none either', async () => {
    const desktop = started({ search: '?tier=3&monitor=1' });
    await desktop.fake.load();
    desktop.state().stepDown('monitor');
    expect(desktop.state().tier).toBe(2);
    expect(desktop.fake.local.data.has('sefid-light')).toBe(false);
    const phone = started({ ...PHONE, search: '?tier=3' });
    await phone.fake.load();
    phone.state().stepDown('context-loss');
    expect(phone.state().tier).toBe(0);
    expect(phone.fake.local.data.has('sefid-light')).toBe(false);
  });

  it('U-PH6 a monitor drop and a late detection wait for 1000 ms without scroll even with the same pins', async () => {
    const monitor = started({ ...PHONE, search: '?tier=1&monitor=1' });
    monitor.store.setScrollProbe({
      insidePinnedRange: () => false,
      reachedFirstPinnedScene: () => false,
    });
    await monitor.fake.load();
    monitor.state().stepDown('monitor');
    expect(monitor.state().tier).toBe(0);
    expect(monitor.state().layout.latchedAtTier).toBe(1);
    monitor.fake.tick(RELATCH_POLL_MS * 3, 100); // still scrolling
    monitor.fake.tick(RELATCH_POLL_MS * 3, 100);
    expect(monitor.state().layout.latchedAtTier).toBe(1);
    monitor.fake.tick(RELATCH_POLL_MS, 100); // 1000 ms since the last scroll
    expect(monitor.state().layout).toEqual({ pinnedScenes: false, lenis: false, latchedAtTier: 0 });
    expect(monitor.fake.pendingTimers()).toBe(0);

    // A probe answer after the engine started (it registered its scroll facts).
    const late = started({ ...PHONE });
    late.fake.fireLoad();
    late.store.setScrollProbe({
      insidePinnedRange: () => false,
      reachedFirstPinnedScene: () => false,
    });
    await late.fake.answer({ webgl2: false, renderer: null, gpu: null });
    expect(late.state()).toMatchObject({ tier: 0, reason: 'no-webgl2' });
    expect(late.state().layout.latchedAtTier).toBe(1);
    late.fake.tick(RELATCH_POLL_MS * 4);
    expect(late.state().layout.latchedAtTier).toBe(0);

    // The reader's own choice relatches at once.
    const user = started({ ...PHONE });
    user.store.setScrollProbe({
      insidePinnedRange: () => false,
      reachedFirstPinnedScene: () => false,
    });
    user.state().setUserOverride(0);
    expect(user.state().layout.latchedAtTier).toBe(0);
  });

  it('U-PH14 2 GB, an active floor or a CPU sum over the threshold at load start no probe; status is ready', async () => {
    const memory = started({ ...PHONE, deviceMemory: 2 });
    expect(memory.state()).toMatchObject({ tier: 0, reason: 'device-memory', status: 'pending' });
    expect(memory.state().layout.latchedAtTier).toBe(0);
    await memory.fake.load();
    expect(memory.fake.benchmarkCalls).toHaveLength(0);
    expect(memory.state().status).toBe('ready');

    const record = JSON.stringify({ n: 2, until: EPOCH + DAY_MS });
    const floor = started({ ...PHONE, local: { 'sefid-light': record } });
    await floor.fake.load();
    expect(floor.fake.benchmarkCalls).toHaveLength(0);
    expect(floor.state()).toMatchObject({ tier: 0, reason: 'light-floor', status: 'ready' });

    const cpu = started({ ...PHONE, cpu: 401 });
    expect(cpu.state()).toMatchObject({ tier: 1, status: 'pending' });
    await cpu.fake.load();
    expect(cpu.fake.benchmarkCalls).toHaveLength(0);
    expect(cpu.state()).toMatchObject({ tier: 0, reason: 'device-cpu', status: 'ready' });
    // Before the engine started, the layout follows at once.
    expect(cpu.state().layout.latchedAtTier).toBe(0);
  });

  it('U-PH15a the gate deadline reads the CPU a last time and aborts the benchmark fetch; the state carries each reading', async () => {
    const { fake, state } = started({ ...PHONE, cpu: 120 });
    expect(fake.cpu.watching).toBe(1);
    expect(state().cpuBlockingMs).toBeNull();
    fake.fireLoad();
    expect(fake.cpu.reads).toBe(1);
    expect(fake.probeSignals).toHaveLength(1);
    expect(state()).toMatchObject({ tier: 1, status: 'pending', cpuBlockingMs: 120 });
    fake.cpu.ms = 650; // hydration and the chunks kept the main thread busy
    state().openGate();
    expect(fake.probeSignals[0]?.aborted).toBe(true);
    expect(fake.cpu).toMatchObject({ reads: 2, watching: 0 });
    expect(state()).toMatchObject({ tier: 0, reason: 'device-cpu', cpuBlockingMs: 650 });
    expect(state().layout.latchedAtTier).toBe(0);
    // A later answer cannot lift a weak phone (detection keeps the CPU rule).
    await fake.answer({ ...benchmark1, gpu: benchmark3 });
    expect(state()).toMatchObject({ tier: 0, reason: 'device-cpu', status: 'ready' });
    state().openGate();
    expect(fake.cpu.reads).toBe(2);
  });

  it('U-PH15b the probe answer passes the gate: the CPU is read once more and nothing is aborted', async () => {
    const { fake, state } = started({ ...PHONE, cpu: 120, probe: benchmark1 });
    await fake.load();
    expect(fake.cpu).toMatchObject({ reads: 2, watching: 0 });
    expect(state()).toMatchObject({ tier: 1, status: 'ready' });
    state().openGate();
    expect(fake.probeSignals[0]?.aborted).toBe(false);
  });

  it('U-PH15c no CPU watcher on a fine pointer, under a query tier or a saved choice', async () => {
    expect(started().fake.cpu.watching).toBe(0);
    const query = started({ ...PHONE, search: '?tier=1&monitor=1' });
    expect(query.fake.cpu.watching).toBe(0);
    await query.fake.load();
    expect(query.state().cpuBlockingMs).toBeNull();
    expect(started({ ...PHONE, local: { 'sefid-quality': '2' } }).fake.cpu.watching).toBe(0);
    const phone = started({ ...PHONE, cpu: null });
    expect(phone.fake.cpu.watching).toBe(1);
    phone.unsubscribe();
    expect(phone.fake.cpu.watching).toBe(0);
  });
});
