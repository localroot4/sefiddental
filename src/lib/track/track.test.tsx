import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrackListener } from '@/lib/track/TrackListener';
import { EVENTS_ENDPOINT, track } from '@/lib/track/track';

async function beaconBody(call: unknown[]): Promise<Record<string, unknown>> {
  const blob = call[1] as Blob;
  expect(blob.type).toBe('text/plain');
  return JSON.parse(await blob.text()) as Record<string, unknown>;
}

describe('track (spec 11.2)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    delete window.gtag;
  });

  it('TR1 beacon with the stored dimensions; page type from the page', async () => {
    document.body.innerHTML = '<main data-page-type="service"></main>';
    track('call_click', { location: 'hero', serviceKey: 'laminate', open_state: 'open' });
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon.mock.calls[0]?.[0]).toBe(EVENTS_ENDPOINT);
    expect(await beaconBody(sendBeacon.mock.calls[0] ?? [])).toEqual({
      event: 'call_click',
      location: 'hero',
      pageType: 'service',
      serviceKey: 'laminate',
    });
  });

  it('TR2 falls back to fetch keepalive without cookies when the beacon is refused', () => {
    sendBeacon.mockReturnValue(false);
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    track('theme_toggle', { to: 'dark' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
  });

  it('TR3 GA4 gets every param except personal ones; phones are scrubbed', () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    track('booking_submit', {
      location: 'block',
      has_name: true,
      phone: '09123456789',
      note_text: 'x',
      tier: 'b 09123456789',
    });
    expect(gtag).toHaveBeenCalledWith('event', 'booking_submit', {
      location: 'block',
      has_name: true,
      tier: 'b [phone]',
    });
  });

  it('TR4 unknown event names are never sent', () => {
    track('evil' as never);
    expect(sendBeacon).not.toHaveBeenCalled();
  });
});

describe('TrackListener (conversion.md 9)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
  });
  afterEach(() => cleanup());

  it('TL1 one delegated click listener reads data-track, data-location and data-service-key', async () => {
    render(
      <>
        <TrackListener />
        <section data-location="section" data-service-key="implant">
          <a href="#x" data-track="call_click">
            <span>تماس با کلینیک</span>
          </a>
          <button type="button" data-track="nope">
            x
          </button>
        </section>
      </>,
    );
    act(() => document.querySelector('span')?.click());
    act(() => document.querySelector('button')?.click());
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(await beaconBody(sendBeacon.mock.calls[0] ?? [])).toMatchObject({
      event: 'call_click',
      location: 'section',
      serviceKey: 'implant',
    });
  });

  it('TL2 still counts a click whose handler stops propagation (capture phase)', () => {
    render(
      <>
        <TrackListener />
        <button type="button" data-track="whatsapp_click" onClick={(e) => e.stopPropagation()}>
          واتساپ
        </button>
      </>,
    );
    act(() => document.querySelector('button')?.click());
    expect(sendBeacon).toHaveBeenCalledTimes(1);
  });
});
