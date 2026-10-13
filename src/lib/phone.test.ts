import { describe, expect, it } from 'vitest';

import {
  formatPhoneFa,
  maskPhone,
  mobilePhoneSchema,
  parseIranPhone,
  PHONE_ERRORS,
  phoneSearchFragment,
  REGISTERED_NUMBER_LABEL,
  telHref,
} from './phone';

const MOBILE = { ok: true, kind: 'mobile', national: '09123456789', e164: '+989123456789' };

// Table P of the utilities spec, rows P1-P30.
const PARSE: Array<[id: string, input: unknown, options: object, expected: object]> = [
  ['P1 Persian digits', '۰۹۱۲۳۴۵۶۷۸۹', {}, MOBILE],
  [
    'P2 Arabic-Indic digits',
    '\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669',
    {},
    MOBILE,
  ],
  ['P3 +98', '+989123456789', {}, MOBILE],
  ['P4 0098', '00989123456789', {}, MOBILE],
  ['P5 leading 0', '09123456789', {}, MOBILE],
  ['P6 10-digit input', '9123456789', {}, MOBILE],
  ['P7 spaces', '0912 345 6789', {}, MOBILE],
  ['P8 dashes', '0912-345-6789', {}, MOBILE],
  ['P9 Persian digits with +98', '+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹', {}, MOBILE],
  [
    'P10 0920-0923',
    '09201234567',
    {},
    { ok: true, kind: 'mobile', national: '09201234567', e164: '+989201234567' },
  ],
  [
    'P11 099x',
    '09991234567',
    {},
    { ok: true, kind: 'mobile', national: '09991234567', e164: '+989991234567' },
  ],
  ['P12 98 without plus', '989123456789', {}, MOBILE],
  ['P13 trunk 0 after the country code', '+98 0912 345 6789', {}, MOBILE],
  ['P14 bidi marks from a pasted contact', '\u200E0912 345 6789\u200F', {}, MOBILE],
  ['P15 any non-digit dropped', '(0912) 345.6789', {}, MOBILE],
  ['P16 a label typed before the number', 'موبایل: ۰۹۱۲ ۳۴۵ ۶۷۸۹', {}, MOBILE],
  ['P17 landline rejected', '02155101054', {}, { ok: false, reason: 'landline' }],
  ['P18 the clinic landline with +98', '+982155101054', {}, { ok: false, reason: 'landline' }],
  ['P19 landline in display form', '۰۲۱ ۵۵۱۰ ۱۰۵۴', {}, { ok: false, reason: 'landline' }],
  ['P20 8-digit local number', '55101054', {}, { ok: false, reason: 'landline' }],
  ['P21 10 digits starting 1-8', '2155101054', {}, { ok: false, reason: 'landline' }],
  ['P22 empty', '', {}, { ok: false, reason: 'empty' }],
  ['P23 blank', '   ', {}, { ok: false, reason: 'empty' }],
  ['P24 10 digits with 0', '0912345678', {}, { ok: false, reason: 'invalid' }],
  ['P25 12 digits', '091234567890', {}, { ok: false, reason: 'invalid' }],
  ['P26 letters dropped, too short', '0912abc4567', {}, { ok: false, reason: 'invalid' }],
  ['P27 foreign number', '+1 202 555 0100', {}, { ok: false, reason: 'invalid' }],
  ['P28 + only at the start', '09123456789+', {}, { ok: false, reason: 'invalid' }],
  [
    'P29 landline allowed where a landline is acceptable',
    '02155101054',
    { accept: 'mobile-or-landline' },
    { ok: true, kind: 'landline', national: '02155101054', e164: '+982155101054' },
  ],
  [
    'P30 no area code, no E.164',
    '55101054',
    { accept: 'mobile-or-landline' },
    { ok: false, reason: 'invalid' },
  ],
];

describe('phone table P', () => {
  it.each(PARSE)('%s', (_id, input, options, expected) => {
    expect(parseIranPhone(input, options)).toEqual(expected);
  });

  it.each([
    ['P31 mobile grouping', '+989123456789', '۰۹۱۲ ۳۴۵ ۶۷۸۹'],
    ['P32 landline grouping', '+982155101054', '۰۲۱ ۵۵۱۰ ۱۰۵۴'],
    ['P33 clinic mobile', '+989205451054', '۰۹۲۰ ۵۴۵ ۱۰۵۴'],
  ])('%s', (_id, e164, expected) => {
    expect(formatPhoneFa(e164)).toBe(expected);
  });

  it('P34 mask', () => {
    expect(maskPhone('+989123456789')).toBe('۰۹۱۲ \u2022\u2022\u2022 ۶۷۸۹');
  });

  it('P35 tel link', () => {
    expect(telHref('+982155101054')).toBe('tel:+982155101054');
  });

  it.each([
    ['P36 any digit form', '۰۹۱۲ ۳۴۵', '912345'],
    ['P37 +98 removed', '+98912', '912'],
    ['P38 last four digits', '۶۷۸۹', '6789'],
    ['P39 not a phone query', 'علی', null],
  ])('%s', (_id, query, expected) => {
    expect(phoneSearchFragment(query)).toBe(expected);
  });

  it('H27 success line label and mask', () => {
    expect(`${REGISTERED_NUMBER_LABEL} ${maskPhone('+989123456789')}`).toBe(
      'شمارهٔ ثبت\u200Cشده: ۰۹۱۲ \u2022\u2022\u2022 ۶۷۸۹',
    );
  });
});

describe('phone rules', () => {
  it('P-TYPE a value that is not a string is empty', () => {
    for (const input of [undefined, null, 9123456789, {}, ['09123456789']]) {
      expect(parseIranPhone(input)).toEqual({ ok: false, reason: 'empty' });
    }
  });

  it('P-SCHEMA mobilePhoneSchema returns E.164 or the exact Persian message', () => {
    expect(mobilePhoneSchema.parse('۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('+989123456789');
    for (const [input, reason] of [
      ['', 'empty'],
      ['0912345678', 'invalid'],
      ['02155101054', 'landline'],
    ] as const) {
      const result = mobilePhoneSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(PHONE_ERRORS[reason]);
    }
  });

  it('P-SCHEMA-MAX input over 64 characters is rejected before parsing', () => {
    const result = mobilePhoneSchema.safeParse(`09123456789${' '.repeat(60)}`);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe('too_big');
  });

  it('P-ERRORS messages never contain the input', () => {
    const input = '0912345678';
    const result = mobilePhoneSchema.safeParse(input);
    expect(JSON.stringify(result.error?.issues.map((i) => i.message))).not.toContain(input);
  });

  it('P-E164 display helpers fail loud on a value that is not Iranian E.164', () => {
    for (const bad of ['09123456789', '+1202555010', '+98912345678', '']) {
      expect(() => formatPhoneFa(bad)).toThrow(RangeError);
      expect(() => maskPhone(bad)).toThrow(RangeError);
      expect(() => telHref(bad)).toThrow(RangeError);
    }
  });

  it('P-FRAGMENT prefixes and short queries', () => {
    expect(phoneSearchFragment('00989123')).toBe('9123');
    expect(phoneSearchFragment('989123456789')).toBe('9123456789');
    expect(phoneSearchFragment('0912-345')).toBe('912345');
    expect(phoneSearchFragment('09')).toBeNull();
    expect(phoneSearchFragment('علی ۱۲۳')).toBeNull();
    expect(phoneSearchFragment('912+3')).toBeNull();
  });
});
