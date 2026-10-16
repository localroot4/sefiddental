import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/fa';
import { FLASH_HEADER, flashHeaderValue, type Flash } from '@/lib/http/flash';

import BookingSuccessPage from './page';

vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));
vi.mock('@/components/booking/BookingPage', () => ({ BookingSuccessView: () => null }));
vi.mock('@/components/pages/data', () => ({ pageMetadata: vi.fn() }));

const BOOKING = encodeURI('/رزرو-نوبت');
const flash = (fields: Partial<Flash>): Flash => ({
  form: 'booking',
  to: '/رزرو-نوبت/ثبت-شد',
  outcome: 'success',
  at: Date.now(),
  ...fields,
});
const requestWith = (value: Flash | null) =>
  vi
    .mocked(headers)
    .mockResolvedValue(
      new Headers(value ? { [FLASH_HEADER]: flashHeaderValue(value) } : {}) as never,
    );

beforeEach(() => {
  vi.mocked(redirect).mockClear();
});

describe('booking success page (conversion.md 5.4)', () => {
  it('BS1 without a booking success flash it redirects to the booking page', async () => {
    for (const value of [null, flash({ outcome: 'neutral' }), flash({ form: 'emergency' })]) {
      requestWith(value);
      await expect(BookingSuccessPage()).rejects.toThrow('NEXT_REDIRECT');
    }
    expect(vi.mocked(redirect).mock.calls).toEqual([[BOOKING], [BOOKING], [BOOKING]]);
  });

  it("BS2 a success flash shows the server's callback line, else the generic one", async () => {
    requestWith(flash({ callback: 'پذیرش تا ۱۰ دقیقهٔ دیگر تماس می‌گیرد.', masked: '۰۹۱۲' }));
    expect((await BookingSuccessPage()).props).toEqual({
      callback: 'پذیرش تا ۱۰ دقیقهٔ دیگر تماس می‌گیرد.',
      masked: '۰۹۱۲',
    });
    requestWith(flash({}));
    expect((await BookingSuccessPage()).props).toEqual({
      callback: t('booking.callbackGeneric'),
      masked: null,
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
