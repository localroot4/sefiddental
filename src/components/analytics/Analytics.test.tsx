import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getFeatures } from '@/lib/data/globals';

import { Analytics, ga4Id } from './Analytics';
import { Ga4Loader } from './Ga4Loader';

vi.mock('@/lib/data/globals', () => ({ getFeatures: vi.fn() }));
vi.mock('@/lib/log/logger', () => ({ log: { warn: vi.fn() } }));

const GA = 'https://www.googletagmanager.com/gtag/js?id=G-ABC123';
const scripts = () => document.querySelectorAll(`script[src="${GA}"]`);

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
}

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  delete window.gtag;
  delete window.dataLayer;
  setReadyState('complete');
});

describe('GA4 loader (conversion.md 9, freeze G16)', () => {
  it('GA1 only an enabled setting with a valid id renders the loader', async () => {
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: 'G-ABC123' })).toBe('G-ABC123');
    expect(ga4Id({ ga4Enabled: false, ga4MeasurementId: 'G-ABC123' })).toBeNull();
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: null })).toBeNull();
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: 'G-1"><script>' })).toBeNull();
    vi.mocked(getFeatures).mockResolvedValue({ ga4Enabled: false } as never);
    expect(await Analytics()).toBeNull();
    vi.mocked(getFeatures).mockRejectedValue(new Error('database down'));
    expect(await Analytics()).toBeNull(); // measurement never breaks the page
    vi.mocked(getFeatures).mockResolvedValue({
      ga4Enabled: true,
      ga4MeasurementId: 'G-ABC123',
    } as never);
    expect(await Analytics()).toEqual(<Ga4Loader id="G-ABC123" />);
  });

  it('GA2 nothing loads before the load event; then one async script, gtag and its config', () => {
    setReadyState('loading');
    const { unmount } = render(<Ga4Loader id="G-ABC123" />);
    expect(scripts()).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    window.dispatchEvent(new Event('load'));
    expect(scripts()).toHaveLength(1);
    expect((scripts()[0] as HTMLScriptElement).async).toBe(true);
    expect(typeof window.gtag).toBe('function');
    // gtag.js reads arguments objects: the 'js' and 'config' commands are queued.
    expect(window.dataLayer?.map((entry) => Array.from(entry as ArrayLike<unknown>)[0])).toEqual([
      'js',
      'config',
    ]);
    expect(Array.from(window.dataLayer?.[1] as ArrayLike<unknown>)).toEqual(['config', 'G-ABC123']);
    unmount();
    // A page loaded later (or a second mount) never adds a second script.
    setReadyState('complete');
    render(<Ga4Loader id="G-ABC123" />);
    expect(scripts()).toHaveLength(1);
  });
});
