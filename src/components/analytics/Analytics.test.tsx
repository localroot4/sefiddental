import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from '@/app/ga4.js/route';
import { getFeatures } from '@/lib/data/globals';

import { Analytics, ga4Id } from './Analytics';
import { GA4_BOOT } from './ga4Boot';

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

vi.mock('@/lib/data/globals', () => ({ getFeatures: vi.fn() }));
vi.mock('@/lib/log/logger', () => ({ log: { warn: vi.fn() } }));

const GA = 'https://www.googletagmanager.com/gtag/js?id=G-ABC123';
const scripts = () => document.querySelectorAll(`script[src="${GA}"]`);

function setReadyState(value: DocumentReadyState) {
  Object.defineProperty(document, 'readyState', { value, configurable: true });
}

/** The page's bootstrap tag (as the layout renders it), then the served script run once. */
function boot(id: string) {
  const tag = document.createElement('script');
  tag.dataset.ga4Id = id;
  document.body.append(tag);
  new Function(GA4_BOOT)();
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete window.gtag;
  delete window.dataLayer;
  setReadyState('complete');
});

describe('GA4 loader (conversion.md 9, freeze G16)', () => {
  it('GA1 only an enabled setting with a valid id renders the bootstrap tag, with the nonce', async () => {
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: 'G-ABC123' })).toBe('G-ABC123');
    expect(ga4Id({ ga4Enabled: false, ga4MeasurementId: 'G-ABC123' })).toBeNull();
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: null })).toBeNull();
    expect(ga4Id({ ga4Enabled: true, ga4MeasurementId: 'G-1"><script>' })).toBeNull();
    vi.mocked(getFeatures).mockResolvedValue({ ga4Enabled: false } as never);
    expect(await Analytics({ nonce: 'n' })).toBeNull();
    vi.mocked(getFeatures).mockRejectedValue(new Error('database down'));
    expect(await Analytics({ nonce: 'n' })).toBeNull(); // measurement never breaks the page
    vi.mocked(getFeatures).mockResolvedValue({
      ga4Enabled: true,
      ga4MeasurementId: 'G-ABC123',
    } as never);
    expect(await Analytics({ nonce: 'n' })).toEqual(
      <script src="/ga4.js" data-ga4-id="G-ABC123" nonce="n" async />,
    );
  });

  it('GA2 nothing loads before the load event; then one async script, gtag and its config', () => {
    setReadyState('loading');
    boot('G-ABC123');
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
    // A page loaded later (or a second run) never adds a second script.
    setReadyState('complete');
    new Function(GA4_BOOT)();
    expect(scripts()).toHaveLength(1);
  });

  it('GA3 the bootstrap checks the id again; /ga4.js serves it as JavaScript', async () => {
    boot('G-1"><img>');
    expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    const res = GET();
    expect(res.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(await res.text()).toBe(GA4_BOOT);
  });
});
