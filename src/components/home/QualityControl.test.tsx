// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TierProvider } from '@/experience/tier/TierProvider';
import { t } from '@/i18n/fa';
import type { Tier } from '@/lib/qualityTier';

import { QualityControl, whyDiffers, type QualityLabels } from './QualityControl';

const LABELS: QualityLabels = {
  legend: t('home.quality.label'),
  auto: t('home.quality.auto'),
  tiers: [
    t('home.quality.tier0'),
    t('home.quality.tier1'),
    t('home.quality.tier2'),
    t('home.quality.tier3'),
  ],
  reducedMotion: t('home.quality.reducedMotion'),
  siteCap: t('home.quality.siteCap'),
  device: t('home.quality.device'),
  saveData: t('home.quality.saveData'),
};

/** Controllable matchMedia: jsdom has none. */
function installMatchMedia(initial: Record<string, boolean>) {
  window.matchMedia = ((query: string) => ({
    matches: initial[query] ?? false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

/** A WebGL 2 context that reports a hardware renderer; detect-gpu never runs in these tests. */
function installWebgl2() {
  const fake = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
        : name === 'WEBGL_lose_context'
          ? { loseContext: () => {} }
          : null,
    getParameter: () => 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
    RENDERER: 0x1f01,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' ? fake : null) as never);
}

const radio = (name: string) => screen.getByRole('radio', { name });
const line = () => screen.getByRole('group').getAttribute('aria-describedby')!;
const lineText = () => document.getElementById(line())!.textContent;

/** Waits for the relatch, which runs in a task after the next frame. */
const afterPaint = () =>
  act(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));

async function choose(name: string) {
  fireEvent.click(radio(name));
  await afterPaint();
}

function mount(siteCap: Tier | null = null) {
  window.history.replaceState(null, '', '/');
  return render(
    <TierProvider siteCap={siteCap}>
      <QualityControl labels={LABELS} />
    </TierProvider>,
  );
}

beforeEach(() => {
  installMatchMedia({ '(pointer: fine)': true, '(min-width: 1024px)': true });
  installWebgl2();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete document.documentElement.dataset.tier;
  delete document.documentElement.dataset.tierReason;
});

describe('whyDiffers', () => {
  it('names reduced motion, the site cap, Save-Data (U-PH13) and the device; nothing for a choice or the benchmark', () => {
    expect(whyDiffers('reduced-motion', LABELS)).toBe(t('home.quality.reducedMotion'));
    expect(whyDiffers('site-cap', LABELS)).toBe(t('home.quality.siteCap'));
    expect(whyDiffers('save-data', LABELS)).toBe(t('home.quality.saveData'));
    for (const reason of [
      'no-webgl2',
      'software-renderer',
      'device-memory',
      'device-cpu',
      'light-floor',
      'monitor',
      'context-loss',
    ] as const)
      expect(whyDiffers(reason, LABELS)).toBe(t('home.quality.device'));
    for (const reason of ['user-override', 'query-override', 'gpu-benchmark'] as const)
      expect(whyDiffers(reason, LABELS)).toBeNull();
  });
});

describe('QualityControl', () => {
  it('five radios under the «کیفیت» legend, «خودکار» checked, described by the tier line', () => {
    mount();
    const group = screen.getByRole('group', { name: t('home.quality.label') });
    expect(group).toHaveProperty('tagName', 'FIELDSET');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(radio(t('home.quality.auto'))).toHaveProperty('checked', true);
    expect(radio(t('home.quality.tier2'))).toHaveProperty('disabled', false);
    // Before the probe: tier 1 (WebGL 2 assumed), by the benchmark rule, so the line is the name.
    expect(lineText()).toBe(t('home.quality.tier1'));
  });

  it('a choice checks the radio at once, then after the next paint writes localStorage and moves html[data-tier]', async () => {
    mount();
    // The tier line is announced only after the reader reaches the control (focus), not at load.
    expect(document.getElementById(line())!.getAttribute('aria-live')).toBeNull();
    fireEvent.focus(radio(t('home.quality.tier2')));
    expect(document.getElementById(line())!.getAttribute('aria-live')).toBe('polite');
    fireEvent.click(radio(t('home.quality.tier2')));
    // The click task only checks the radio: the relatch would delay its paint (INP).
    expect(radio(t('home.quality.tier2'))).toHaveProperty('checked', true);
    expect(radio(t('home.quality.auto'))).toHaveProperty('checked', false);
    expect(localStorage.getItem('sefid-quality')).toBeNull();
    expect(document.documentElement.dataset.tier).not.toBe('2');
    await afterPaint();
    expect(localStorage.getItem('sefid-quality')).toBe('2');
    expect(document.documentElement.dataset.tier).toBe('2');
    expect(document.documentElement.dataset.tierReason).toBe('user-override');
    expect(radio(t('home.quality.tier2'))).toHaveProperty('checked', true);
    expect(lineText()).toBe(t('home.quality.tier2'));

    await choose(t('home.quality.auto'));
    expect(localStorage.getItem('sefid-quality')).toBeNull();
    expect(radio(t('home.quality.auto'))).toHaveProperty('checked', true);
  });

  it('reflects a saved choice on load', () => {
    localStorage.setItem('sefid-quality', '3');
    mount();
    expect(radio(t('home.quality.tier3'))).toHaveProperty('checked', true);
    expect(lineText()).toBe(t('home.quality.tier3'));
  });

  it('says why the effective tier differs: the site cap', async () => {
    mount(1);
    await choose(t('home.quality.tier3'));
    expect(radio(t('home.quality.tier3'))).toHaveProperty('checked', true);
    expect(document.documentElement.dataset.tier).toBe('1');
    expect(lineText()).toBe(`${t('home.quality.tier1')} · ${t('home.quality.siteCap')}`);
  });

  it('says why the effective tier differs: reduced motion', async () => {
    installMatchMedia({ '(prefers-reduced-motion: reduce)': true, '(pointer: fine)': true });
    mount();
    await choose(t('home.quality.tier3'));
    expect(document.documentElement.dataset.tier).toBe('0');
    expect(lineText()).toBe(`${t('home.quality.tier0')} · ${t('home.quality.reducedMotion')}`);
  });
});
