import { describe, expect, it } from 'vitest';

import type { GpuResult } from '@/lib/qualityTier';

import { serializeGpuCache } from './gpuCache';
import type { ProbeResult } from './gpuProbe';
import { createTierStore, RELATCH_POLL_MS, type TierEnv } from './tierStore';

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
  deviceMemory?: number | null;
}

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
  const timers = new Set<() => void>();
  let now = 0;
  let scrollY = 0;
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
    probe: ({ benchmark }) =>
      new Promise<ProbeResult>((resolve) => {
        const result = o.probe ?? { webgl2: true, renderer: RTX, gpu: null };
        benchmarkCalls.push(benchmark(result.renderer) ? result.renderer : null);
        resolveProbe = resolve;
      }),
    scrollY: () => scrollY,
    now: () => now,
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
    /** Fires `load` and resolves the probe with `result`. */
    async load(result?: ProbeResult) {
      loadCb?.();
      resolveProbe?.(result ?? o.probe ?? { webgl2: true, renderer: RTX, gpu: null });
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

  it('TS2 hydration ignores sefid-gpu; the probe reads and validates it after load', () => {
    const { state } = started({ local: { 'sefid-gpu': serializeGpuCache(RTX, benchmark3) } });
    expect(state()).toMatchObject({ tier: 1, status: 'pending' });
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 1 });
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

  it('TS8b a detection drop to tier 0 removes Lenis even after the first pinned scene', async () => {
    const { fake, store, state } = started({ probe: { webgl2: false, renderer: null, gpu: null } });
    store.setScrollProbe({ insidePinnedRange: () => false, reachedFirstPinnedScene: () => true });
    await fake.load();
    expect(state().tier).toBe(0);
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

  it('TS16 crossing 1024 px relatches the pins at once', async () => {
    const { fake, state } = started(cachedRtx);
    await fake.load();
    expect(state().layout.pinnedScenes).toBe(true);
    fake.setWidth(900);
    expect(state().layout).toEqual({ pinnedScenes: false, lenis: true, latchedAtTier: 3 });
    expect(state().settings.compareWipe).toBe('dom');
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
