import { describe, expect, it } from 'vitest';

import { PHONE_MASK, scrubDeep, scrubPhones } from '@/lib/log/redact';

describe('scrubPhones', () => {
  it.each([
    '09123456789',
    '9123456789',
    '+989123456789',
    '00989123456789',
    '989123456789',
    '0912 345 6789',
    '0912-345-6789',
    '+98 912 345 6789',
    '۰۹۱۲۳۴۵۶۷۸۹',
    '۰۹۱۲ ۳۴۵ ۶۷۸۹',
    '٠٩١٢٣٤٥٦٧٨٩',
    '02155101054',
    '+982155101054',
    '۰۲۱ ۵۵۱۰ ۱۰۵۴',
    '+14155550123',
  ])('LR1 masks %s', (phone) => {
    expect(scrubPhones(`call ${phone} now`)).toBe(`call ${PHONE_MASK} now`);
    expect(scrubPhones(`شماره:${phone}`)).toBe(`شماره:${PHONE_MASK}`);
    expect(scrubPhones(`/api/x?phone=${phone}&a=1`)).toBe(`/api/x?phone=${PHONE_MASK}&a=1`);
  });

  it.each([
    '2026-10-13T08:30:00.000Z',
    'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    '1760000000000',
    'durationMs 1234',
    'a1912345678901b',
    'sha 09123456789abc',
    'id 912345678901',
  ])('LR2 leaves %s alone', (text) => {
    expect(scrubPhones(text)).toBe(text);
  });
});

describe('scrubDeep', () => {
  it('LR3 scrubs nested strings, redacts sensitive keys, keeps numbers', () => {
    const out = scrubDeep({
      msg: 'booking from 09123456789',
      booking: { phone: '+989123456789', phoneNational: '9123456789', note: 'x', count: 3 },
      list: ['ok', '0912 345 6789'],
      headers: { authorization: 'Bearer abc', cookie: 'payload-token=x', accept: 'text/html' },
      ip: '203.0.113.7',
    });
    expect(out).toEqual({
      msg: `booking from ${PHONE_MASK}`,
      booking: { phone: '[redacted]', phoneNational: '[redacted]', note: 'x', count: 3 },
      list: ['ok', PHONE_MASK],
      headers: { authorization: '[redacted]', cookie: '[redacted]', accept: 'text/html' },
      ip: '[redacted]',
    });
  });

  it('LR4 errors become plain scrubbed objects', () => {
    const err = Object.assign(new TypeError('no user with phone 09123456789'), { code: 'E1' });
    const out = scrubDeep(err) as Record<string, unknown>;
    expect(out.type).toBe('TypeError');
    expect(out.message).toBe(`no user with phone ${PHONE_MASK}`);
    expect(String(out.stack)).not.toContain('09123456789');
    expect(out.code).toBe('E1');
  });

  it('LR5 cycles and depth are cut, never thrown', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    expect(scrubDeep(a)).toEqual({ name: 'a', self: '[circular]' });
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 12; i += 1) deep = { inner: deep };
    expect(JSON.stringify(scrubDeep(deep))).toContain('[depth]');
  });
});
