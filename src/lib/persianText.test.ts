import { describe, expect, it, vi } from 'vitest';

import {
  collapseSpaces,
  fixPersianSpacing,
  formatNumberFa,
  normalizeLetters,
  normalizePersian,
  normalizeZwnj,
  stripInvisibles,
  toLatinDigits,
  toPersianDigits,
  ZWNJ,
} from './persianText';

// Table T of the utilities spec. Invisible characters are written as escapes (G5).
const TABLE: Array<[id: string, actual: () => string, expected: string]> = [
  ['T1 Arabic yeh to Persian yeh', () => normalizePersian('علي'), 'علی'],
  ['T2 Arabic kaf to Persian kaf', () => normalizePersian('كلينيك'), 'کلینیک'],
  ['T3 alef maksura to Persian yeh', () => normalizePersian('مصطفى'), 'مصطفی'],
  [
    'T4 presentation forms to base letters',
    () => normalizePersian('\uFEDB\uFEE0\uFBFF\uFEE8\uFBFF\uFEDA'),
    'کلینیک',
  ],
  ['T5 ASCII digits to Persian', () => toPersianDigits('09123456789'), '۰۹۱۲۳۴۵۶۷۸۹'],
  [
    'T6 Arabic-Indic and ASCII digits to Persian',
    () => toPersianDigits('\u0660\u0669\u0661\u0662 ساعت 10'),
    '۰۹۱۲ ساعت ۱۰',
  ],
  ['T7 Persian digits parse', () => toLatinDigits('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789'],
  [
    'T8 Arabic-Indic digits parse',
    () => toLatinDigits('\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'),
    '09123456789',
  ],
  ['T9 ZWNJ run collapses', () => normalizeZwnj('می\u200C\u200Cشود'), 'می\u200Cشود'],
  ['T10 ZWNJ at the edges removed', () => normalizeZwnj('\u200Cسلام\u200C'), 'سلام'],
  ['T11 ZWNJ next to a space removed', () => normalizeZwnj('می\u200C شود'), 'می شود'],
  ['T12 valid ZWNJ kept', () => normalizeZwnj('کلینیک\u200Cها'), 'کلینیک\u200Cها'],
  ['T13 ZWNJ outside Arabic script removed', () => normalizeZwnj('ZWNJ\u200Ctest'), 'ZWNJtest'],
  ['T14 ZWNJ before a digit removed', () => normalizeZwnj('سال\u200C۱۴۰۵'), 'سال۱۴۰۵'],
  ['T15 spaces collapse', () => collapseSpaces('  علی \u00A0  رضایی\u0009 '), 'علی رضایی'],
  [
    'T16 no space before comma and question mark',
    () => fixPersianSpacing('سلام ، خوبی ؟'),
    'سلام، خوبی؟',
  ],
  [
    'T17 space before ( and after )',
    () => fixPersianSpacing('دیاستم(فاصله)بین'),
    'دیاستم (فاصله) بین',
  ],
  ['T18 no space inside parentheses', () => fixPersianSpacing('( فاصله )'), '(فاصله)'],
  ['T19 space after comma', () => fixPersianSpacing('سلام،خوبی'), 'سلام، خوبی'],
  [
    'T20 bidi marks removed, letters, spacing',
    () => normalizePersian('\u200Eعلي   رضايي\u200F'),
    'علی رضایی',
  ],
  ['T21 tatweel removed', () => normalizePersian('س\u0640لام'), 'سلام'],
  ['T22 name keeps diacritics', () => normalizePersian('  محم\u0651د  علي '), 'محم\u0651د علی'],
  [
    'T23 default digits mode',
    () => normalizePersian('کد \u0664\u0665\u0666 و 789'),
    'کد ۴۵۶ و 789',
  ],
  [
    'T24 latin digits mode',
    () => normalizePersian('کد \u0664\u0665\u0666 و 789', { digits: 'latin' }),
    'کد 456 و 789',
  ],
  ['T25 thousands separator', () => formatNumberFa(200000000), '۲۰۰\u066C۰۰۰\u066C۰۰۰'],
  ['T26 four digits', () => formatNumberFa(1234), '۱\u066C۲۳۴'],
  ['T27 NFC composes alef and maddah', () => normalizePersian('ا\u0653درس'), 'آدرس'],
];

describe('persianText table T', () => {
  it.each(TABLE)('%s', (_id, actual, expected) => {
    expect(actual()).toBe(expected);
  });
});

describe('persianText rules', () => {
  it('T-IDEM normalizePersian is idempotent on rows T1, T2, T9, T20, T21 and edge inputs', () => {
    const inputs = [
      'علي',
      'كلينيك',
      'می\u200C\u200Cشود',
      '\u200Eعلي   رضايي\u200F',
      'س\u0640لام',
      // a removed invisible or a mapped presentation form exposes a pair NFC composes
      'ا\u0640\u0653درس',
      '\uFE8D\u0653درس',
      'می \u200C شود',
      ' سلام ،  خوبی ؟( فاصله )ها ',
    ];
    for (const input of inputs) {
      for (const spacing of ['collapse', 'typography'] as const) {
        const once = normalizePersian(input, { spacing });
        expect(normalizePersian(once, { spacing })).toBe(once);
      }
    }
  });

  it('T-ZWNJ exported constant is U+200C', () => {
    expect(ZWNJ.codePointAt(0)).toBe(0x200c);
    expect(ZWNJ.length).toBe(1);
  });

  it('T-INV stripInvisibles drops bidi controls, BOM, soft hyphen and tatweel only', () => {
    expect(stripInvisibles('\u200E\u200F\u202A\u202E\u2066\u2069\uFEFF\u00AD\u0640ab')).toBe('ab');
    expect(stripInvisibles(`a${ZWNJ}b`)).toBe(`a${ZWNJ}b`);
  });

  it('T-LIG word ligatures U+FDF0-U+FDFF are left alone', () => {
    expect(normalizeLetters('\uFDFC')).toBe('\uFDFC');
  });

  it('T-ARABIC-HAMZA NFC runs before the letter map, so Arabic yeh plus hamza stays U+0626', () => {
    expect(normalizePersian('\u064A\u0654')).toBe('\u0626');
  });

  it('T-LINES collapseSpaces normalizes line endings and blank-line runs', () => {
    expect(collapseSpaces('الف \r\n\r\n\r\n ب\rپ')).toBe('الف\n\nب\nپ');
  });

  it('T-DOT fixPersianSpacing leaves decimals, times and URLs alone', () => {
    expect(fixPersianSpacing('ساعت 10:30 و 2.5 و example.com')).toBe(
      'ساعت 10:30 و 2.5 و example.com',
    );
  });

  it('T-GUILLEMET fixPersianSpacing spaces guillemets like parentheses', () => {
    expect(fixPersianSpacing('عنوان« متن »بعدی')).toBe('عنوان «متن» بعدی');
  });

  it('T-FA digits option fa converts ASCII too', () => {
    expect(normalizePersian('کد 789', { digits: 'fa' })).toBe('کد ۷۸۹');
  });

  it('T-NAN formatNumberFa fails loud on a non-finite value', () => {
    expect(() => formatNumberFa(Number.NaN)).toThrow(RangeError);
    expect(() => formatNumberFa(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('T-LAZY importing the module builds no Intl.NumberFormat; the first format does, once', async () => {
    vi.resetModules();
    const spy = vi.spyOn(Intl, 'NumberFormat');
    const fresh = await import('./persianText');
    expect(spy).not.toHaveBeenCalled();
    fresh.formatNumberFa(1);
    fresh.formatNumberFa(2);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
