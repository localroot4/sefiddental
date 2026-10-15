import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RestorationTiers, TIER_INPUT } from '@/components/services/RestorationTiers';
import { track } from '@/lib/track/track';
import type { Service, ServiceTier } from '@/payload-types';

import { HomeBookingPrefill } from './HomeBookingPrefill';
import { RestorationSection } from './HomeSections';

// The section module also renders the booking block, whose data readers need Payload.
vi.mock('@/components/booking/BookingForm', () => ({ BookingForm: () => null }));
vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));

const service = { key: 'restoration', bookingGroup: 'restore' } as Service;
const TIERS = (['standard', 'vip', 'cip'] as const).map(
  (key) => ({ key, name: key.toUpperCase(), description: `${key} line`, service }) as ServiceTier,
);

afterEach(() => {
  vi.mocked(track).mockClear();
  vi.unstubAllGlobals();
});

describe('home scene 4 tier step (F24, CV9)', () => {
  it('RS1 no tier is preselected; the section button carries the service only', () => {
    const html = renderToStaticMarkup(
      <RestorationSection tiers={TIERS} path={null} copy={{ heading: 'h', intro: null }} />,
    );
    expect(html).not.toMatch(/<input[^>]*checked/);
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => decodeURI(m[1]!));
    expect(hrefs).toEqual([
      '/رزرو-نوبت?service=restoration',
      '/رزرو-نوبت?service=restoration&amp;tier=standard',
      '/رزرو-نوبت?service=restoration&amp;tier=vip',
      '/رزرو-نوبت?service=restoration&amp;tier=cip',
    ]);
    // tier_select comes from HomeBookingPrefill with the tier, not from a data-track on the chip.
    expect(html).not.toContain('tier_select');
  });

  it('RS2 choosing a step sends tier_select with its tier', () => {
    render(
      <>
        <HomeBookingPrefill />
        <input type="radio" name="home-tier" value="vip" aria-label="VIP" />
        <input type="radio" name="other" value="x" aria-label="other" />
      </>,
    );
    fireEvent.click(document.querySelector('input[name="other"]')!);
    expect(track).not.toHaveBeenCalled();
    fireEvent.click(document.querySelector('input[name="home-tier"]')!);
    expect(track).toHaveBeenCalledWith('tier_select', { location: 'tier', tier: 'vip' });
  });

  it('RS3 the restoration comparison sends tier_select once per change with its tier', () => {
    render(
      <>
        <HomeBookingPrefill />
        <RestorationTiers service={service} tiers={TIERS} />
      </>,
    );
    fireEvent.click(document.querySelector(`input[name="${TIER_INPUT}"][value="cip"]`)!);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('tier_select', { location: 'tier', tier: 'cip' });
  });

  it('RS4 a tier CTA fills the page form; a CTA without a service leaves it as the page set it', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value }); // jsdom has no CSS.escape
    render(
      <>
        <HomeBookingPrefill />
        <RestorationTiers service={service} tiers={TIERS} />
        <a href="/رزرو-نوبت" data-booking-cta="">
          header
        </a>
        <div data-booking-form="hero">
          <form aria-label="hero">
            <input name="tier" defaultValue="" />
          </form>
        </div>
        <div data-booking-form="block">
          <form aria-label="block">
            <input name="service_key" defaultValue="restoration" />
            <input name="tier" defaultValue="" />
            <input type="radio" name="service" value="exam" aria-label="exam" />
            <input type="radio" name="service" value="restore" aria-label="restore" />
          </form>
        </div>
      </>,
    );
    const block = document.querySelector<HTMLFormElement>('[aria-label="block"]')!;
    const value = (name: string) => (block.elements.namedItem(name) as HTMLInputElement).value;
    // Keep jsdom from navigating; the prefill listens in the capture phase before this.
    const click = (link: Element) => {
      link.addEventListener('click', (e) => e.preventDefault(), { once: true });
      fireEvent.click(link);
    };
    const vip = [...document.querySelectorAll('a')].find((a) => a.href.includes('tier=vip'))!;
    expect(vip.getAttribute('data-tier')).toBe('vip'); // booking_open carries the tier (TL3)
    click(document.querySelector('a[href="/رزرو-نوبت"]')!);
    expect([value('service_key'), value('tier')]).toEqual(['restoration', '']);
    click(vip);
    expect([value('service_key'), value('tier')]).toEqual(['restoration', 'vip']);
    expect((block.querySelector('[value="restore"]') as HTMLInputElement).checked).toBe(true);
    // The home hero card is not the target.
    expect((document.querySelector('[aria-label="hero"] input') as HTMLInputElement).value).toBe(
      '',
    );
  });
});
