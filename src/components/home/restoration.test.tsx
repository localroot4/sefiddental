import { fireEvent, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setupChoices } from '@/components/chrome/choices';
import { RestorationTiers, TIER_INPUT } from '@/components/services/RestorationTiers';
import { track } from '@/lib/track/track';
import type { Service, ServiceTier } from '@/payload-types';

import { HomeBookingPrefill } from './HomeBookingPrefill';
import { RestorationSection } from './sections/RestorationSection';

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
    expect(html).not.toMatch(/<input[^>]*\schecked=/); // the attribute, not a checked: class
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

  it('RS5 the chosen step shows its panel by position: data-choice with JavaScript (choices.ts), :has() only without', () => {
    const { container } = render(
      <RestorationSection tiers={TIERS} path={null} copy={{ heading: 'h', intro: null }} />,
    );
    const stop = setupChoices(document);
    const group = container.querySelector('[data-choices]')!;
    expect(group.className.split(' ')).toContain('group/tiers');
    const panels = [...group.querySelectorAll('[data-tier-panel]')].map((el) =>
      el.className.split(' ').filter((c) => c.includes('/tiers:')),
    );
    expect(panels).toEqual([
      ['group-data-choice/tiers:hidden', 'noscript:group-has-[input:checked]/tiers:hidden'],
      [
        'group-data-[choice=1]/tiers:grid',
        'noscript:group-has-[label:nth-of-type(1)>input:checked]/tiers:grid',
      ],
      [
        'group-data-[choice=2]/tiers:grid',
        'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:grid',
      ],
      [
        'group-data-[choice=3]/tiers:grid',
        'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:grid',
      ],
    ]);
    expect(group.hasAttribute('data-choice')).toBe(false);
    fireEvent.click(group.querySelector('input[value="cip"]')!);
    expect(group.getAttribute('data-choice')).toBe('3');
    stop();
  });

  it('RS4 a tier CTA carries its tier for the chrome route and booking_open (CB11, TL3)', () => {
    render(<RestorationTiers service={service} tiers={TIERS} />);
    const vip = [...document.querySelectorAll('a')].find((a) => a.href.includes('tier=vip'))!;
    expect(vip.hasAttribute('data-booking-cta')).toBe(true);
    expect(new URL(vip.href).searchParams.get('service')).toBe('restoration');
    expect(vip.getAttribute('data-tier')).toBe('vip');
  });
});
