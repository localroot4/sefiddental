import { describe, expect, it } from 'vitest';

import type { Flash } from '@/lib/http/flash';

import { bookingPageInputs } from './pageInputs';

const flash = (over: Partial<Flash>): Flash => ({
  form: 'booking',
  to: '/رزرو-نوبت',
  outcome: 'retry',
  at: 0,
  ...over,
});

describe('booking page inputs (conversion.md 5, 5.6; freeze G3)', () => {
  it('BP1 the link prefills ASCII service and tier keys and the dentist; anything else is dropped', () => {
    expect(
      bookingPageInputs({ service: 'ceramic-laminate', tier: 'vip', dentist: 'دکتر-نمونه' }, null),
    ).toEqual({
      service: 'ceramic-laminate',
      tier: 'vip',
      dentist: 'دکتر-نمونه',
      location: undefined,
      restore: null,
    });
    const odd = bookingPageInputs(
      { service: ['Implant', 'x'], tier: 'v'.repeat(101), dentist: 'a\u0000b', utm_source: 'x' },
      null,
    );
    expect([odd.service, odd.tier, odd.dentist]).toEqual([undefined, undefined, undefined]);
    expect(bookingPageInputs({ service: ['implant', 'x'] }, null).service).toBe('implant');
  });

  it('BP2 a no-JS home post comes back with its values, its location and the retry line', () => {
    const inputs = bookingPageInputs(
      { service: 'implant' },
      flash({
        outcome: 'retry',
        values: {
          phone: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
          name: 'نمونه',
          service: 'restore',
          service_key: 'restoration',
          tier: 'vip',
          time_pref: 'evening',
          note: 'درد دارم',
          location: 'block',
        },
      }),
    );
    expect(inputs.service).toBe('restoration'); // the post wins over the link
    expect(inputs.tier).toBe('vip');
    expect(inputs.location).toBe('block');
    expect(inputs.restore?.values.name).toBe('نمونه');
    expect(inputs.restore?.initial).toEqual({
      phone: '۰۹۱۲ ۳۴۵ ۶۷۸۹',
      note: 'درد دارم',
      phoneError: undefined,
      noteError: false,
      notice: 'retry',
    });
  });

  it('BP3 field error codes map to the form messages; an unknown phone code reads as invalid', () => {
    const restore = (errors: Record<string, string>) =>
      bookingPageInputs({}, flash({ outcome: 'invalid', errors, values: {} })).restore;
    expect(restore({ phone: 'landline', note: 'too_long', name: 'too_long' })).toMatchObject({
      nameError: true,
      initial: { phoneError: 'landline', noteError: true, notice: undefined },
    });
    expect(restore({ phone: 'empty' })?.initial.phoneError).toBe('empty');
    expect(restore({ phone: 'something' })?.initial.phoneError).toBe('invalid');
    expect(restore({ note: 'too_long' })?.initial.phoneError).toBeUndefined();
  });

  it('BP4 each other outcome is its message; success and the emergency form restore nothing', () => {
    const notice = (outcome: Flash['outcome']) =>
      bookingPageInputs({}, flash({ outcome })).restore?.initial.notice;
    expect(notice('expired')).toBe('expired');
    expect(notice('neutral')).toBe('neutral');
    expect(notice('server')).toBe('server');
    expect(bookingPageInputs({}, flash({ outcome: 'success' })).restore).toBeNull();
    expect(bookingPageInputs({}, flash({ form: 'emergency' })).restore).toBeNull();
    // An unknown kept location is not stored: the handler's default applies.
    expect(
      bookingPageInputs({}, flash({ values: { location: 'footer' } })).location,
    ).toBeUndefined();
  });
});
