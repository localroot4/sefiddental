import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { getFormSession, type FormSession } from '@/components/chrome/formSession';
import { DirectionsLinks } from '@/components/ui/Contact';
import { PAGE_PATHS } from '@/lib/paths';
import { SERVICES_PREFIX, TrackListener } from '@/lib/track/TrackListener';
import { EVENTS_ENDPOINT, track } from '@/lib/track/track';

vi.mock('@/components/chrome/formSession', () => ({ getFormSession: vi.fn(async () => null) }));

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

  it('TR1b scene_view carries the scene id as its location, nothing else stored', async () => {
    document.body.innerHTML = '<main data-page-type="home"></main>';
    track('scene_view', { location: 'restoration' });
    expect(await beaconBody(sendBeacon.mock.calls[0] ?? [])).toEqual({
      event: 'scene_view',
      location: 'restoration',
      pageType: 'home',
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

  it('TR5 GA4 gets page_type and service_key in snake_case; the beacon keeps its keys', async () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    document.body.innerHTML = '<main data-page-type="pricing"></main>';
    track('booking_open', { location: 'tier', serviceKey: 'restoration', tier: 'vip' });
    expect(gtag).toHaveBeenCalledWith('event', 'booking_open', {
      location: 'tier',
      tier: 'vip',
      page_type: 'pricing',
      service_key: 'restoration',
    });
    expect(await beaconBody(sendBeacon.mock.calls[0] ?? [])).toEqual({
      event: 'booking_open',
      location: 'tier',
      pageType: 'pricing',
      serviceKey: 'restoration',
    });
  });
});

describe('TrackListener (conversion.md 9)', () => {
  let sendBeacon: ReturnType<typeof vi.fn>;
  let gtag: Mock<(...args: unknown[]) => void>;
  beforeEach(() => {
    sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: sendBeacon, configurable: true });
    gtag = vi.fn();
    window.gtag = gtag;
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.mocked(getFormSession).mockResolvedValue(null);
    window.history.replaceState(null, '', '/');
  });

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

describe('TrackListener parameters (pricing-tiers-measure 3.2, 3.3)', () => {
  let gtag: Mock<(...args: unknown[]) => void>;
  beforeEach(() => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn(() => true),
      configurable: true,
    });
    gtag = vi.fn();
    window.gtag = gtag;
    document.body.innerHTML = '';
  });
  afterEach(() => {
    cleanup();
    delete window.gtag;
    vi.mocked(getFormSession).mockResolvedValue(null);
    window.history.replaceState(null, '', '/');
  });

  const session = (state: string, nextChangeAt: string) =>
    ({ hours: { state, nextChangeAt } }) as unknown as FormSession;

  it('TL3 the directions provider, data-tier and data-from-slug reach GA4 in snake_case', () => {
    render(
      <>
        <TrackListener />
        <DirectionsLinks
          maps={{ neshanUrl: 'https://neshan.org/maps/places/x' } as never}
          location="block"
        />
        <a href="#b" data-track="booking_open" data-location="tier" data-tier="vip">
          رزرو نوبت
        </a>
        <div data-from-slug="اولین-مراجعه">
          <a href="#s" data-track="content_to_service" data-location="article">
            لمینت
          </a>
        </div>
      </>,
    );
    for (const link of document.querySelectorAll('a')) {
      act(() => {
        link.addEventListener('click', (e) => e.preventDefault(), { once: true });
        link.click();
      });
    }
    expect(gtag.mock.calls.map((call) => call[2])).toEqual([
      { location: 'block', provider: 'neshan' },
      { location: 'tier', tier: 'vip' },
      { location: 'article', from_slug: 'اولین-مراجعه' },
    ]);
  });

  it('TL3b the quality tier on <html data-tier> never leaks into an event as its tier', () => {
    document.documentElement.setAttribute('data-tier', '2');
    try {
      render(
        <>
          <TrackListener />
          <a href="#w" data-track="whatsapp_click" data-location="sticky">
            واتساپ
          </a>
        </>,
      );
      act(() => document.querySelector<HTMLElement>('a[href="#w"]')!.click());
      expect(gtag).toHaveBeenCalledWith('event', 'whatsapp_click', { location: 'sticky' });
    } finally {
      document.documentElement.removeAttribute('data-tier');
    }
  });

  it('TL4 call_click carries open_state from the form session, else unknown', async () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    vi.mocked(getFormSession).mockResolvedValue(session('closing-soon', later));
    render(
      <>
        <TrackListener />
        <a
          href="tel:+982155101054"
          data-track="call_click"
          data-location="header"
          onClick={(e) => e.preventDefault()}
        >
          تماس با کلینیک
        </a>
        <a href="#w" data-track="whatsapp_click">
          واتساپ
        </a>
      </>,
    );
    await act(async () => {}); // the session answer
    act(() => document.querySelector<HTMLElement>('a[href^="tel:"]')!.click());
    act(() => document.querySelector<HTMLElement>('a[href="#w"]')!.click());
    expect(gtag.mock.calls.map((call) => call[2])).toEqual([
      { location: 'header', open_state: 'closing-soon' },
      {},
    ]);
    cleanup();

    // A state past its change time is no longer known.
    vi.mocked(getFormSession).mockResolvedValue(session('open', new Date(0).toISOString()));
    gtag.mockClear();
    render(
      <>
        <TrackListener />
        <a href="tel:+982155101054" data-track="call_click" onClick={(e) => e.preventDefault()}>
          تماس با کلینیک
        </a>
      </>,
    );
    await act(async () => {});
    act(() => document.querySelector<HTMLElement>('a')!.click());
    expect(gtag).toHaveBeenCalledWith('event', 'call_click', { open_state: 'unknown' });
  });

  it('TL5 a guide link to a service sends content_to_service once with the guide slug', () => {
    window.history.replaceState(null, '', '/راهنمای-بیمار/اولین-مراجعه');
    render(
      <>
        <TrackListener />
        <div data-page-type="guide">
          <a href="/خدمات/لمینت-سرامیکی">لمینت سرامیکی</a>
          <a href="/خدمات">همهٔ خدمات</a>
          <a href="/خدمات/ترمیم-دندان" data-track="booking_open">
            رزرو نوبت
          </a>
        </div>
        <div data-page-type="service">
          <a href="/خدمات/ایمپلنت-دندان">ایمپلنت</a>
        </div>
      </>,
    );
    for (const link of document.querySelectorAll('a')) {
      act(() => {
        // Keep jsdom from navigating; the listener runs in the capture phase before this.
        link.addEventListener('click', (e) => e.preventDefault(), { once: true });
        link.click();
      });
    }
    expect(gtag.mock.calls.map((call) => [call[1], call[2]])).toEqual([
      [
        'content_to_service',
        { location: 'article', from_slug: 'اولین-مراجعه', page_type: 'guide' },
      ],
      ['booking_open', { page_type: 'guide' }],
    ]);
  });

  it('TL6 the services prefix is the services hub path', () => {
    expect(SERVICES_PREFIX).toBe(`${PAGE_PATHS['services-hub']}/`);
  });
});
