import { afterEach, describe, expect, it } from 'vitest';

import {
  DETECT_GPU_TIERS,
  isSoftwareRenderer,
  monitorStep,
  parseSavedOverride,
  selectTier,
  siteCapFrom,
  tierSettings,
  type MonitorState,
  type TierInputs,
} from './qualityTier';

const SWIFTSHADER_ANGLE =
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)';
const FALLBACK_1 = { tier: 1, type: 'FALLBACK' } as const;

// BASE: desktop 1440x900 at DPR 1, RTX 3060 BENCHMARK tier 3, 8 GB, fine pointer.
const BASE: TierInputs = {
  reducedMotion: false,
  webgl2: true,
  renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  gpu: { tier: 3, type: 'BENCHMARK', fps: 240, isMobile: false, gpu: 'nvidia geforce rtx 3060' },
  saveData: false,
  deviceMemory: 8,
  viewport: { width: 1440, height: 900, dpr: 1 },
  finePointer: true,
  savedOverride: 'auto',
  queryOverride: null,
  queryMode: 'fixed',
  siteCap: null,
};
const PHONE = { width: 390, height: 844, dpr: 3 };

// Table Q of the utilities spec, rows Q1-Q15 plus the freeze rows Q31-Q32.
const DECISIONS: Array<[id: string, inputs: TierInputs, tier: number, reason: string]> = [
  ['Q1 detect-gpu tier used as is', BASE, 3, 'gpu-benchmark'],
  [
    'Q2 reduced motion beats every override',
    { ...BASE, reducedMotion: true, savedOverride: 3 },
    0,
    'reduced-motion',
  ],
  ['Q3 no WebGL 2 is tier 0', { ...BASE, webgl2: false, savedOverride: 3 }, 0, 'no-webgl2'],
  [
    'Q4 SwiftShader is tier 0 although detect-gpu says 1',
    { ...BASE, renderer: SWIFTSHADER_ANGLE, gpu: FALLBACK_1 },
    0,
    'software-renderer',
  ],
  [
    'Q5 llvmpipe is tier 0',
    { ...BASE, renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)', gpu: FALLBACK_1 },
    0,
    'software-renderer',
  ],
  ['Q6 data saver is tier 0', { ...BASE, saveData: true }, 0, 'save-data'],
  ['Q7 blocklisted GPU', { ...BASE, gpu: { tier: 0, type: 'BLOCKLISTED' } }, 0, 'gpu-benchmark'],
  ['Q8 unknown GPU keeps the library default 1', { ...BASE, gpu: FALLBACK_1 }, 1, 'gpu-benchmark'],
  [
    'Q9 2 GB caps at tier 1',
    { ...BASE, gpu: { tier: 2, type: 'BENCHMARK' }, deviceMemory: 2 },
    1,
    'device-memory',
  ],
  ['Q10 4 GB caps at tier 2', { ...BASE, deviceMemory: 4 }, 2, 'device-memory'],
  ['Q11 no deviceMemory API, no cap', { ...BASE, deviceMemory: null }, 3, 'gpu-benchmark'],
  ['Q12 user quality control', { ...BASE, savedOverride: 1 }, 1, 'user-override'],
  [
    'Q13 explicit choice beats detection',
    { ...BASE, savedOverride: 3, saveData: true },
    3,
    'user-override',
  ],
  [
    'Q14 admin cap from the features global',
    { ...BASE, savedOverride: 3, siteCap: 1 },
    1,
    'site-cap',
  ],
  [
    'Q15 ?tier=N beats the saved choice',
    { ...BASE, queryOverride: 0, savedOverride: 2 },
    0,
    'query-override',
  ],
  ['Q31 ?tier=3&monitor=1', { ...BASE, queryOverride: 3, queryMode: 'auto' }, 3, 'query-override'],
  ['Q32 ?tier=3', { ...BASE, queryOverride: 3, queryMode: 'fixed' }, 3, 'query-override'],
];

describe('qualityTier table Q', () => {
  it.each(DECISIONS)('%s', (_id, inputs, tier, reason) => {
    const decision = selectTier(inputs);
    expect([decision.tier, decision.reason]).toEqual([tier, reason]);
  });

  it('Q31 Q32 query mode decides the monitor mode', () => {
    expect(selectTier({ ...BASE, queryOverride: 3, queryMode: 'auto' }).mode).toBe('auto');
    expect(selectTier({ ...BASE, queryOverride: 3, queryMode: 'fixed' }).mode).toBe('fixed');
    expect(selectTier(BASE).mode).toBe('auto');
    expect(selectTier({ ...BASE, savedOverride: 2 }).mode).toBe('fixed');
  });

  it('Q16 tier 3 settings', () => {
    expect(selectTier(BASE).settings).toMatchObject({
      pixelRatio: 1,
      pinnedScenes: true,
      post: { bloom: true, grain: true, dof: true },
      shadows: 'soft',
      particleFactor: 1,
      transmission: 0.15,
    });
  });

  it('Q17 phone at tier 3: DPR cap 2, no pin, DOM slider, no pointer parallax', () => {
    expect(selectTier({ ...BASE, viewport: PHONE, finePointer: false }).settings).toMatchObject({
      pixelRatio: 2,
      pinnedScenes: false,
      compareWipe: 'dom',
      pointerParallax: false,
      molar: 'canvas',
    });
  });

  it('Q18 pinned scenes boundary at 1024 px', () => {
    const at = (width: number) =>
      tierSettings(3, { width, height: 900, dpr: 1 }, true).pinnedScenes;
    expect([at(1023), at(1024)]).toEqual([false, true]);
  });

  it('Q19 tier 1 settings', () => {
    expect(selectTier({ ...BASE, savedOverride: 1 }).settings).toMatchObject({
      pixelRatio: 0.75,
      shadows: 'none',
      post: { bloom: false, grain: false, dof: false },
      particleFactor: 0.2,
      pinnedScenes: false,
      scenes3d: 'hero-exit-and-molar',
      compareWipe: 'dom',
    });
  });

  it('Q20 tier 2 DPR cap 1.5', () => {
    const viewport = { width: 1440, height: 900, dpr: 2 };
    expect(selectTier({ ...BASE, savedOverride: 2, viewport }).settings.pixelRatio).toBe(1.5);
  });

  it('Q21 tier 1 on phones shows poster frames', () => {
    expect(selectTier({ ...BASE, savedOverride: 1, viewport: PHONE }).settings.molar).toBe(
      'posters',
    );
  });

  it('Q22 tier 0 settings', () => {
    expect(selectTier({ ...BASE, reducedMotion: true }).settings).toMatchObject({
      webgl: false,
      pixelRatio: null,
      footerPlayground: 'static',
      molar: 'svg-stepper',
      scene5Particles: 0,
    });
  });

  it('Q23 corrupt localStorage never throws', () => {
    expect(['2', 'x', null, '3.5', '0'].map(parseSavedOverride)).toEqual([
      2,
      'auto',
      'auto',
      'auto',
      0,
    ]);
  });

  it('Q24 software renderer check', () => {
    expect(
      [
        SWIFTSHADER_ANGLE,
        'Google SwiftShader',
        'Microsoft Basic Render Driver',
        'Apple GPU',
        null,
      ].map(isSoftwareRenderer),
    ).toEqual([true, true, true, false, false]);
  });
});

describe('qualityTier frame monitor', () => {
  const AUTO_3: MonitorState = { tier: 3, belowSinceMs: null, mode: 'auto' };
  const feed = (state: MonitorState, samples: Array<[nowMs: number, fps: number]>) =>
    samples.reduce((s, [nowMs, fps]) => monitorStep(s, { nowMs, fps }), state);

  it('Q25 not yet 2 s under 55 fps', () => {
    expect(
      feed(AUTO_3, [
        [0, 50],
        [1999, 50],
      ]).tier,
    ).toBe(3);
  });

  it('Q26 one step after 2 s under 55 fps', () => {
    expect(
      feed(AUTO_3, [
        [0, 50],
        [1999, 50],
        [2000, 50],
      ]).tier,
    ).toBe(2);
  });

  it('Q27 the window restarts after a good sample', () => {
    const state = feed(AUTO_3, [
      [0, 50],
      [1999, 50],
      [2000, 50],
      [3000, 60],
      [4600, 50],
    ]);
    expect(state).toEqual({ tier: 2, belowSinceMs: 4600, mode: 'auto' });
  });

  it('Q28 goes all the way to tier 0, then no change', () => {
    const samples = Array.from({ length: 21 }, (_, i): [number, number] => [i * 1000, 10]);
    const state = feed(AUTO_3, samples);
    expect(state.tier).toBe(0);
    expect(monitorStep(state, { nowMs: 30_000, fps: 1 })).toBe(state);
  });

  it('Q29 an explicit override is not auto-corrected', () => {
    const fixed: MonitorState = { tier: 3, belowSinceMs: null, mode: 'fixed' };
    const samples = Array.from({ length: 37 }, (_, i): [number, number] => [i * 250, 5]);
    expect(feed(fixed, samples).tier).toBe(3);
  });

  it('Q-MON a good stream never steps up and ignores non-finite samples', () => {
    const state: MonitorState = { tier: 1, belowSinceMs: null, mode: 'auto' };
    expect(
      feed(state, [
        [0, 120],
        [5000, 120],
      ]).tier,
    ).toBe(1);
    expect(monitorStep(state, { nowMs: 0, fps: Number.NaN })).toBe(state);
  });
});

describe('qualityTier purity and helpers', () => {
  const globalsTouched: string[] = [];
  const TRAPS = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'matchMedia'];
  // Node 22 defines globalThis.navigator: keep the original descriptors and put them back.
  const originals = new Map(
    TRAPS.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );

  afterEach(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete (globalThis as Record<string, unknown>)[name];
    }
  });

  it('Q30 qualityTier is pure: same output, no global access, input not mutated', () => {
    for (const name of TRAPS) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        get() {
          globalsTouched.push(name);
          throw new Error(`qualityTier touched ${name}`);
        },
      });
    }
    const inputs = structuredClone(BASE);
    const frozen = Object.freeze({ ...inputs, viewport: Object.freeze({ ...inputs.viewport }) });
    const first = selectTier(frozen);
    expect(selectTier(frozen)).toEqual(first);
    expect(selectTier(structuredClone(BASE))).toEqual(first);
    monitorStep({ tier: 3, belowSinceMs: 0, mode: 'auto' }, { nowMs: 2000, fps: 30 });
    tierSettings(2, PHONE, false);
    expect(globalsTouched).toEqual([]);
    expect(inputs).toEqual(BASE);
  });

  it('Q-DETECT thresholds are the D-Q1 constants', () => {
    expect(DETECT_GPU_TIERS).toEqual({ desktop: [0, 15, 60, 120], mobile: [0, 15, 40, 60] });
  });

  it('Q-CAP siteCapFrom: auto and unknown values mean no cap', () => {
    expect(['auto', '0', '2', '3', 'x', '', null, undefined].map(siteCapFrom)).toEqual([
      null,
      0,
      2,
      3,
      null,
      null,
      null,
      null,
    ]);
  });

  it('Q-SITECAP0 a site cap of 0 turns WebGL off', () => {
    const decision = selectTier({ ...BASE, siteCap: 0 });
    expect([decision.tier, decision.reason, decision.settings.webgl]).toEqual([
      0,
      'site-cap',
      false,
    ]);
  });

  it('Q-DETECTED detectedTier keeps the detection result under an override', () => {
    expect(selectTier({ ...BASE, savedOverride: 1 }).detectedTier).toBe(3);
    expect(selectTier({ ...BASE, webgl2: false }).detectedTier).toBe(0);
    expect(selectTier({ ...BASE, gpu: null }).tier).toBe(1);
  });

  it('Q-TABLE every tier row of the settings table', () => {
    const wide = { width: 1440, height: 900, dpr: 2 };
    expect([0, 1, 2, 3].map((t) => tierSettings(t as 0 | 1 | 2 | 3, wide, true))).toEqual([
      {
        webgl: false,
        dprCap: null,
        renderScale: null,
        pixelRatio: null,
        post: { bloom: false, grain: false, dof: false },
        particleFactor: 0,
        scene5Particles: 0,
        shadows: 'none',
        transmission: 0,
        scenes3d: 'none',
        pinnedScenes: false,
        compareWipe: 'dom',
        carousel3d: false,
        footerPlayground: 'static',
        playgroundCollisions: false,
        pointerParallax: false,
        heroExitParallax: false,
        heroExitMask: false,
        molar: 'svg-stepper',
        gpuMemoryBudgetMB: 0,
        webglAssetBudgetKB: 0,
        maxTextureSize: 2048,
      },
      {
        webgl: true,
        dprCap: 1,
        renderScale: 0.75,
        pixelRatio: 0.75,
        post: { bloom: false, grain: false, dof: false },
        particleFactor: 0.2,
        scene5Particles: 600,
        shadows: 'none',
        transmission: 0,
        scenes3d: 'hero-exit-and-molar',
        pinnedScenes: false,
        compareWipe: 'dom',
        carousel3d: false,
        footerPlayground: 'dom',
        playgroundCollisions: false,
        pointerParallax: true,
        heroExitParallax: true,
        heroExitMask: false,
        molar: 'canvas',
        gpuMemoryBudgetMB: 64,
        webglAssetBudgetKB: 500,
        maxTextureSize: 2048,
      },
      {
        webgl: true,
        dprCap: 1.5,
        renderScale: 1,
        pixelRatio: 1.5,
        post: { bloom: false, grain: true, dof: false },
        particleFactor: 0.5,
        scene5Particles: 1500,
        shadows: 'hard',
        transmission: 0,
        scenes3d: 'all',
        pinnedScenes: true,
        compareWipe: 'webgl',
        carousel3d: true,
        footerPlayground: 'dom',
        playgroundCollisions: false,
        pointerParallax: true,
        heroExitParallax: true,
        heroExitMask: true,
        molar: 'canvas',
        gpuMemoryBudgetMB: 128,
        webglAssetBudgetKB: 1200,
        maxTextureSize: 2048,
      },
      {
        webgl: true,
        dprCap: 2,
        renderScale: 1,
        pixelRatio: 2,
        post: { bloom: true, grain: true, dof: true },
        particleFactor: 1,
        scene5Particles: 3000,
        shadows: 'soft',
        transmission: 0.15,
        scenes3d: 'all',
        pinnedScenes: true,
        compareWipe: 'webgl',
        carousel3d: true,
        footerPlayground: '3d',
        playgroundCollisions: true,
        pointerParallax: true,
        heroExitParallax: true,
        heroExitMask: true,
        molar: 'canvas',
        gpuMemoryBudgetMB: 256,
        webglAssetBudgetKB: 2500,
        maxTextureSize: 2048,
      },
    ]);
  });
});
