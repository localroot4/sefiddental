import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => vi.mocked(track).mockClear());

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
});
