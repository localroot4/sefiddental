// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Tier } from '@/lib/qualityTier';

import { PINS_SCRIPT } from './pinsScript';
import { createTierStore, type TierEnv } from './tierStore';

interface Case {
  search: string;
  saved: string | null;
  cap: Tier | null;
  monitorCap: string | null;
  width: number;
  reduced: boolean;
  gpu?: string | null;
  memory?: number | null;
  saveData?: boolean;
}

const RTX = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
const cache = (o: Record<string, unknown>) =>
  JSON.stringify({ v: '5.0.70', renderer: RTX, tier: 2, type: 'BENCHMARK', fps: 90, ...o });
/** `sefid-gpu` values: none, valid ones of each kind, and ones gpuCache rejects. */
const GPUS = [
  null,
  cache({}),
  cache({ tier: 3, fps: null }),
  cache({ tier: 2.7 }),
  cache({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader)' }),
  cache({ type: 'FALLBACK', tier: 1 }),
  cache({ type: 'BLOCKLISTED', tier: 0 }),
  cache({ v: '5.0.69' }),
  cache({ fps: '90' }),
  cache({ type: 'NOPE' }),
  '[1]',
  '{',
];

const store = (data: Record<string, string | null>) => ({
  get: (k: string) => data[k] ?? null,
  set: () => {},
  remove: () => {},
});
const media = (value: boolean) => ({ matches: () => value, subscribe: () => () => {} });

/** The latch the tier store sets at hydration for the same inputs (no probe yet). */
function storePins(c: Case): boolean {
  const env = {
    reducedMotion: media(c.reduced),
    finePointer: media(true),
    wide: media(c.width >= 1024),
    viewport: () => ({ width: c.width, height: 900, dpr: 1 }),
    saveData: () => c.saveData ?? false,
    deviceMemory: () => (c.memory === undefined ? 8 : c.memory),
    search: () => c.search,
    local: store({ 'sefid-quality': c.saved, 'sefid-gpu': c.gpu ?? null }),
    session: store({ 'sefid-tier-cap': c.monitorCap }),
    epochMs: () => 0,
  } as unknown as TierEnv;
  return createTierStore(env, { siteCap: c.cap }).getSnapshot().layout.pinnedScenes;
}

/** What the inline script writes, run as the browser runs it in the home HTML. */
function scriptPins(c: Case): boolean {
  window.history.replaceState(null, '', `/${c.search}`);
  localStorage.clear();
  sessionStorage.clear();
  if (c.saved !== null) localStorage.setItem('sefid-quality', c.saved);
  if (c.gpu != null) localStorage.setItem('sefid-gpu', c.gpu);
  Object.defineProperty(navigator, 'deviceMemory', {
    value: c.memory === undefined ? 8 : (c.memory ?? undefined),
    configurable: true,
  });
  Object.defineProperty(navigator, 'connection', {
    value: { saveData: c.saveData ?? false },
    configurable: true,
  });
  if (c.monitorCap !== null) sessionStorage.setItem('sefid-tier-cap', c.monitorCap);
  document.body.innerHTML = `<div data-experience-root=""${c.cap === null ? '' : ` data-site-cap="${c.cap}"`}></div>`;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches:
      query === '(min-width:1024px)'
        ? c.width >= 1024
        : query === '(prefers-reduced-motion:reduce)' && c.reduced,
  }));
  document.documentElement.removeAttribute('data-pins');
  new Function(PINS_SCRIPT)();
  return document.documentElement.hasAttribute('data-pins');
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute('data-pins');
});

describe('the inline pins latch (F2, F3)', () => {
  it('PS1 writes html[data-pins] exactly when the store latches pins at hydration', () => {
    let pinned = 0;
    for (const search of ['', '?tier=2', '?tier=3', '?tier=1', '?tier=2&monitor=1', '?tier=9'])
      for (const saved of [null, '3', '2', '1', '0', 'bad'])
        for (const cap of [null, 1, 2] as const)
          for (const monitorCap of [null, '0', '1', '2', '3'])
            for (const width of [1440, 900])
              for (const reduced of [false, true]) {
                const c = { search, saved, cap, monitorCap, width, reduced };
                const expected = storePins(c);
                expect(scriptPins(c), JSON.stringify(c)).toBe(expected);
                if (expected) pinned += 1;
              }
    // The matrix reaches both answers.
    expect(pinned).toBeGreaterThan(10);
  });

  it('PS3 auto mode: the cached GPU answer pins exactly as the store reads it at hydration (device memory, Save-Data, a software renderer)', () => {
    let pinned = 0;
    for (const search of ['', '?monitor=1'])
      for (const saved of [null, 'bad'])
        for (const gpu of GPUS)
          for (const memory of [null, 2, 4, 8])
            for (const saveData of [false, true])
              for (const cap of [null, 1, 2] as const)
                for (const monitorCap of [null, '1', '3'])
                  for (const width of [1440, 900]) {
                    const c = { search, saved, cap, monitorCap, width, reduced: false };
                    const full = { ...c, gpu, memory, saveData };
                    const expected = storePins(full);
                    expect(scriptPins(full), JSON.stringify(full)).toBe(expected);
                    if (expected) pinned += 1;
                  }
    expect(pinned).toBeGreaterThan(10);
  });

  it('PS2 blocked storage reads as empty and never throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    window.history.replaceState(null, '', '/?tier=2');
    document.body.innerHTML = '<div data-experience-root=""></div>';
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(min-width:1024px)' }));
    expect(() => new Function(PINS_SCRIPT)()).not.toThrow();
    expect(document.documentElement.hasAttribute('data-pins')).toBe(true);
  });
});
