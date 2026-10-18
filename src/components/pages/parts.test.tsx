import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { BookingBlock } from '@/components/services/sections';
import type { Clinic } from '@/payload-types';

import { PageBooking } from './parts';

vi.mock('@/components/booking/BookingForm', () => ({
  BookingForm: () => <form data-booking-form="block" />,
}));

const CLINIC = {
  phones: { landline: '+982155101054' },
  address: { fullFa: 'تهران، خانی‌آباد نو' },
  maps: {},
  hours: { weekly: [], holidays: [] },
} as unknown as Clinic;

// The column beside the form: the map, the address and the hours.
const aside = (markup: string) =>
  markup.match(/<form data-booking-form="block"><\/form><div class="([^"]+)"/)?.[1];

describe('content pages booking block (family J)', () => {
  it('PB1 the map sits beside the address and hours on tablets, as on the service pages (screens 11)', () => {
    const page = aside(renderToStaticMarkup(<PageBooking clinic={CLINIC} />));
    expect(page).toBe(aside(renderToStaticMarkup(<BookingBlock clinic={CLINIC} />)));
    expect(page?.split(' ')).toContain('md:grid-cols-2');
  });

  it('PB2 J-form (the address page, no map) keeps one column', () => {
    const page = aside(renderToStaticMarkup(<PageBooking clinic={CLINIC} map={false} />));
    expect(page?.split(' ')).not.toContain('md:grid-cols-2');
  });
});
