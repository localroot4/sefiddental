import { describe, expect, it } from 'vitest';

import { persianSlug } from './persianSlug';

// Table S of the utilities spec. Invisible characters are written as escapes (G5).
const TABLE: Array<[id: string, input: string, expected: string]> = [
  ['S1 acceptance: لمینت سرامیکی', 'لمینت سرامیکی', 'لمینت-سرامیکی'],
  ['S2 Arabic ي and ك normalize', 'لمينت سراميكي', 'لمینت-سرامیکی'],
  ['S3 ZWNJ becomes a hyphen', 'جرم\u200Cگیری', 'جرم-گیری'],
  ['S4 آدرس keeps alef madda', 'آدرس', 'آدرس'],
  ['S5 decomposed input composes first', 'ا\u0653درس', 'آدرس'],
  ['S6 اینله و آنله', 'اینله و آنله', 'اینله-و-آنله'],
  [
    'S7 punctuation and hamza above removed',
    'بستن دیاستم (فاصله\u0654 بین دندان\u200Cها)',
    'بستن-دیاستم-فاصله-بین-دندان-ها',
  ],
  ['S8 whitespace runs and edges', '  جراحی   دندان عقل و فک  ', 'جراحی-دندان-عقل-و-فک'],
  ['S9 diacritics stripped', 'م\u064Fعای\u0650نه', 'معاینه'],
  ['S10 Latin kept and lowercased', 'ترمیم VIP', 'ترمیم-vip'],
  ['S11 one digit form', '۱۰ نکته برای \u0663 روز', '۱۰-نکته-برای-۳-روز'],
  ['S12 ASCII digits to Persian', '10 نکته', '۱۰-نکته'],
  ['S13 trailing punctuation dropped', 'درباره ما؟!', 'درباره-ما'],
  ['S14 slash never survives', 'راهنمای بیمار/اولین مراجعه', 'راهنمای-بیمار-اولین-مراجعه'],
  ['S15 heh with hamza to heh', 'مقالۀ اول', 'مقاله-اول'],
  ['S16 presentation forms', '\uFEDF\uFEE4\uFBFF\uFEE8\uFE96', 'لمینت'],
  ['S17 hyphen runs and edges', '-لمینت--سرامیکی-', 'لمینت-سرامیکی'],
  ['S18 nothing left', '؟!', ''],
  ['S19 empty input', '', ''],
  ['S20 tatweel removed', 'س\u0640لام دنیا', 'سلام-دنیا'],
];

describe('persianSlug table S', () => {
  it.each(TABLE)('%s', (_id, input, expected) => {
    expect(persianSlug(input)).toBe(expected);
  });

  it('S21 optional cut at a hyphen', () => {
    expect(persianSlug('جراحی دندان عقل و فک', { maxLength: 12 })).toBe('جراحی-دندان');
  });

  it.each(TABLE)('S22 idempotent: %s', (_id, input) => {
    const once = persianSlug(input);
    expect(persianSlug(once)).toBe(once);
  });
});

describe('persianSlug rules', () => {
  it('S-SEED published slugs and route segments are fixed points', () => {
    // docs/content/services.yaml slugs and docs/ia.md route segments: a seeder fails loudly if
    // persianSlug changes one.
    const published = [
      'زیبایی',
      'جراحی-و-جایگزینی-دندان',
      'درمان-دندان',
      'لمینت-سرامیکی',
      'کامپوزیت-دندان',
      'بلیچینگ-دندان',
      'بستن-دیاستم',
      'لیفت-لثه',
      'طراحی-لبخند',
      'ایمپلنت-دندان',
      'اوردنچر',
      'جراحی-دندان-عقل-و-فک',
      'جراحی-لثه',
      'کشیدن-دندان',
      'ترمیم-دندان',
      'جرم-گیری',
      'درمان-ریشه',
      'روکش-دندان',
      'اینله-و-آنله',
      'ارتودنسی',
      'دندانپزشکی-کودکان',
      'خدمات',
      'پزشکان',
      'قبل-و-بعد',
      'هزینه-و-پرداخت',
      'راهنمای-بیمار',
      'اولین-مراجعه',
      'ترس-از-دندانپزشکی',
      'مراقبت-بعد-از-درمان',
      'اورژانس',
      'درباره-ما',
      'آدرس',
      'رزرو-نوبت',
      'ثبت-شد',
      'مقالات',
      'دسته',
      'برچسب',
      'حریم-خصوصی',
      'vip',
    ];
    for (const slug of published) expect(persianSlug(slug)).toBe(slug);
  });

  it('S-ARABIC-HAMZA ي plus hamza composes to ئ before the letter map', () => {
    expect(persianSlug('ي\u0654')).toBe('ئ');
  });

  it('S-CUT maxLength keeps a slug that fits and hard-cuts one long word', () => {
    expect(persianSlug('لمینت سرامیکی', { maxLength: 13 })).toBe('لمینت-سرامیکی');
    expect(persianSlug('ارتودنسی', { maxLength: 4 })).toBe('ارتو');
    expect(persianSlug('لمینت سرامیکی', { maxLength: 6 })).toBe('لمینت');
  });

  it('S-CUT-INVALID maxLength must be a positive integer', () => {
    expect(() => persianSlug('لمینت', { maxLength: 0 })).toThrow(RangeError);
    expect(() => persianSlug('لمینت', { maxLength: 2.5 })).toThrow(RangeError);
  });

  it('S-NULLISH a missing value from a hook gives an empty slug', () => {
    expect(persianSlug(undefined as unknown as string)).toBe('');
  });
});
