import { gsap } from 'gsap';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SERVER_TIER_STATE, type TierState } from '../tier/tierStore';

import type { ScrollEngine } from '../engine/scrollEngine';

import { buildSnapshot, createFpsMeter, createSceneFps, installDebugHook } from './debugHook';
import { createFrameRuntime, createStore, type ExperienceState } from './store';

type Tick = (time: number, deltaTime: number) => void;

/** Captures the meter's ticker callback and drives gsap.ticker.time by hand. */
function meterWithTicks() {
  let tick: Tick = () => {};
  vi.spyOn(gsap.ticker, 'add').mockImplementation(((cb: Tick) => {
    tick = cb;
    return cb;
  }) as never);
  const remove = vi.spyOn(gsap.ticker, 'remove').mockImplementation(() => {});
  const meter = createFpsMeter();
  const at = (timeSec: number, deltaMs: number) => {
    gsap.ticker.time = timeSec;
    tick(timeSec, deltaMs);
  };
  return { meter, at, remove };
}

const savedTime = gsap.ticker.time;

afterEach(() => {
  vi.restoreAllMocks();
  gsap.ticker.time = savedTime;
  delete window.__sefid;
});

describe('debug hook', () => {
  it('DH1 the fps meter reads null before ticks, then ticks per second and percentiles', () => {
    const { meter, at, remove } = meterWithTicks();
    expect(meter.read()).toEqual({ fps: null, p50: null, p95: null });
    // Binary-exact times: at 1.0 s the 500 ms window holds the ticks at 0.5, 0.75 and 1.0 s.
    at(0.25, 16);
    at(0.5, 16);
    at(0.75, 16);
    at(1, 50);
    expect(meter.read()).toEqual({ fps: 6, p50: 16, p95: 50 });
    // Only the last 120 frame times count: ten 50 ms hitches drop out.
    for (let i = 1; i <= 9; i += 1) at(1 + i / 64, 50);
    expect(meter.read().p50).toBe(50);
    for (let i = 10; i <= 129; i += 1) at(1 + i / 64, 10);
    expect(meter.read().p95).toBe(10);
    // No tick for a while: the window is empty.
    gsap.ticker.time = 10;
    expect(meter.read().fps).toBe(0);
    meter.stop();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('DH2 the snapshot without an engine or a canvas reports the tier state and zeros', () => {
    const runtime = createFrameRuntime();
    const experience = createStore<ExperienceState>({ engine: null });
    const fps = { read: () => ({ fps: null, p50: null, p95: null }), stop: () => {} };
    const snap = buildSnapshot({ tier: SERVER_TIER_STATE, runtime, experience, fps });
    expect(snap).toMatchObject({
      fps: null,
      tier: 0,
      reason: 'reduced-motion',
      detectedTier: null,
      mode: 'auto',
      status: 'pending',
      gpu: null,
      gpuNull: null,
      gpuError: null,
      webgl2: null,
      cpuBlockingMs: null,
      monitor: { slowMs: 0, frames: 0, windows: 0, slowWindows: 0, steps: 0 },
      gate: 'not-mounted',
      framesRendered: 0,
      lenis: false,
      progress: 0,
      velocity: 0,
      scene: null,
      sceneProgress: 0,
      sceneFps: null,
      labels: [],
      engineInitMs: null,
      tickSubscribers: 0,
      draggables: 0,
    });
    expect(snap.memory.geometries).toBeNull();
    expect(snap.dpr.pixelRatio).toBeNull();
    expect(typeof snap.scrollTriggers).toBe('number');
  });

  it('DH3 the snapshot reads the engine, the renderer info and rounds the values', () => {
    const runtime = createFrameRuntime();
    runtime.setGate('open');
    runtime.countFrame();
    runtime.setR3f(
      () =>
        ({
          gl: {
            info: {
              memory: { geometries: 4, textures: 2 },
              programs: [{}, {}, {}],
              render: { calls: 9, triangles: 1200 },
            },
            getPixelRatio: () => 1.5,
          },
          performance: { current: 1 },
        }) as never,
    );
    const engine = {
      lenis: {},
      initMs: 12.345,
      progress: () => 0.123456,
      velocity: () => 12.34,
      activeScene: () => ({ id: 'hero', progress: 0.33333 }),
      labels: () => ['hero', 'trust'],
      tickSubscribers: () => 2,
    } as unknown as ScrollEngine;
    const experience = createStore<ExperienceState>({ engine });
    const fps = { read: () => ({ fps: 59.96, p50: 16.66, p95: 17.04 }), stop: () => {} };
    const sceneFps = createSceneFps();
    const snap = buildSnapshot({ tier: SERVER_TIER_STATE, runtime, experience, fps, sceneFps });
    expect(snap).toMatchObject({
      fps: 60,
      frameMsP50: 16.7,
      frameMsP95: 17,
      gate: 'open',
      framesRendered: 1,
      lenis: true,
      progress: 0.1235,
      velocity: 12.3,
      scene: 'hero',
      sceneProgress: 0.3333,
      sceneFps: { mean: 60, min: 60 },
      labels: ['hero', 'trust'],
      engineInitMs: 12.3,
      tickSubscribers: 2,
      draggables: 0,
    });
    // The per-scene fps keeps the mean and the minimum of the readings taken while it was active.
    fps.read = () => ({ fps: 40, p50: 25, p95: 30 });
    expect(
      buildSnapshot({ tier: SERVER_TIER_STATE, runtime, experience, fps, sceneFps }).sceneFps,
    ).toEqual({ mean: 50, min: 40 });
    expect(snap.memory).toMatchObject({
      geometries: 4,
      textures: 2,
      programs: 3,
      calls: 9,
      triangles: 1200,
    });
    expect(snap.dpr).toMatchObject({ pixelRatio: 1.5, performance: 1 });
  });

  it('DH5 draggables counts the live instances through the plugin and drops a killed one', async () => {
    const { Draggable } = await import('gsap/Draggable');
    gsap.registerPlugin(Draggable);
    const el = document.body.appendChild(document.createElement('div'));
    const [instance] = Draggable.create(el);
    const snap = () =>
      buildSnapshot({
        tier: SERVER_TIER_STATE,
        runtime: createFrameRuntime(),
        experience: createStore<ExperienceState>({ engine: null }),
        fps: { read: () => ({ fps: null, p50: null, p95: null }), stop: () => {} },
      });
    expect(snap().draggables).toBe(1);
    instance?.kill();
    expect(snap().draggables).toBe(0);
    el.remove();
  });

  it('DH4 install exposes window.__sefid and the uninstall removes it', () => {
    const runtime = createFrameRuntime();
    const experience = createStore<ExperienceState>({ engine: null });
    const fps = { read: () => ({ fps: null, p50: null, p95: null }), stop: () => {} };
    const setUserOverride = vi.fn();
    const stepDown = vi.fn();
    const uninstall = installDebugHook(
      () => buildSnapshot({ tier: SERVER_TIER_STATE, runtime, experience, fps }),
      setUserOverride,
      stepDown,
    );
    expect(window.__sefid?.snapshot().gate).toBe('not-mounted');
    window.__sefid?.setUserOverride(0);
    expect(setUserOverride).toHaveBeenCalledWith(0);
    window.__sefid?.stepDown();
    expect(stepDown).toHaveBeenCalledTimes(1);
    uninstall();
    expect(window.__sefid).toBeUndefined();
  });

  it('DH6 the snapshot names why gpu is null, the CPU signal and the monitor counters (phone spec 1.1, 1.5)', () => {
    const runtime = createFrameRuntime();
    runtime.recordMonitorWindow({ slowMs: 250, slow: true, stepped: false });
    runtime.recordMonitorWindow({ slowMs: 0, slow: false, stepped: false });
    runtime.recordMonitorWindow({ slowMs: 0, slow: true, stepped: true });
    for (let i = 0; i < 46; i += 1) runtime.countMonitorFrame();
    const experience = createStore<ExperienceState>({ engine: null });
    const fps = { read: () => ({ fps: null, p50: null, p95: null }), stop: () => {} };
    const snap = (probe: TierState['probe'], cpuBlockingMs: number | null = null) =>
      buildSnapshot({
        tier: { ...SERVER_TIER_STATE, probe, cpuBlockingMs },
        runtime,
        experience,
        fps,
      });
    expect(snap(null).monitor).toEqual({
      slowMs: 0,
      frames: 46,
      windows: 3,
      slowWindows: 2,
      steps: 1,
    });
    expect(snap(null).cpuBlockingMs).toBeNull();
    expect(snap(null, 412.6).cpuBlockingMs).toBe(413);
    const gl = { webgl2: true, renderer: 'Adreno (TM) 610', gpu: null };
    expect(snap({ ...gl, gpuNull: 'skipped' }).gpuNull).toBe('skipped');
    expect(snap({ ...gl, gpuNull: 'failed' }).gpuNull).toBe('failed');
    // The probe's own reason wins: detect-gpu answers FALLBACK for a masked renderer, so a null
    // gpu with WebGL 2 comes from a skipped or a thrown benchmark (the owner's phone).
    const thrown = snap({ ...gl, renderer: null, gpuNull: 'failed', gpuError: 'TypeError' });
    expect(thrown).toMatchObject({ gpuNull: 'failed', gpuError: 'TypeError' });
    expect(snap({ ...gl, renderer: null }).gpuNull).toBe('masked');
    expect(snap({ ...gl, gpu: { tier: 1, type: 'FALLBACK' } }).gpuNull).toBeNull();
    expect(snap({ webgl2: false, renderer: null, gpu: null }).gpuNull).toBeNull();
  });
});
