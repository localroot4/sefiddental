import { describe, expect, it } from 'vitest';

import { normalizeProse, normalizeRuns } from './persianProse';

describe('persianProse prose rules (H9)', () => {
  it('PR1 prose digits: ASCII becomes Persian unless its word has a Latin letter', () => {
    expect(normalizeProse('2 جلسه، ساعت 10:30')).toBe('۲ جلسه، ساعت ۱۰:۳۰');
    expect(normalizeProse('گاز CO2 و رده A1')).toBe('گاز CO2 و رده A1');
    expect(normalizeProse('نشانی https://x.ir/123 را ببینید')).toBe(
      'نشانی https://x.ir/123 را ببینید',
    );
    expect(normalizeProse('کد \u0664\u0665 و A\u0661')).toBe('کد ۴۵ و A۱');
  });

  it('PR2 a pair of straight double quotes becomes guillemets; an odd one stays', () => {
    expect(normalizeProse('به آن "لبخند لثه‌ای" می‌گویند')).toBe('به آن «لبخند لثه‌ای» می‌گویند');
    expect(normalizeProse('"یک" و "دو"')).toBe('«یک» و «دو»');
    expect(normalizeProse('اینچ 5"')).toBe('اینچ ۵"');
    expect(normalizeProse('"x"')).toBe('«x»');
  });

  it('PR3 prose options are idempotent', () => {
    for (const input of ['"یک" 2 CO2', ' "الف"ب ۲ 3', 'A1 "x" 10:30']) {
      for (const spacing of ['collapse', 'typography'] as const) {
        const once = normalizeProse(input, { spacing });
        expect(normalizeProse(once, { spacing })).toBe(once);
      }
    }
  });
});

describe('normalizeRuns: one text split across rich-text nodes (H9)', () => {
  const runs = (parts: string[], digits: 'keep' | 'prose' = 'prose') =>
    normalizeRuns(parts, { digits });

  it('NR1 spaces at a formatting boundary are kept; nothing is trimmed per node', () => {
    expect(runs(['متن ', 'پررنگ', ' ادامه'])).toEqual(['متن ', 'پررنگ', ' ادامه']);
    expect(runs(['  متن  ', ' ادامه'])).toEqual([' متن ', 'ادامه']);
  });

  it('NR2 a ZWNJ at a node boundary is judged by the letters of both nodes', () => {
    expect(runs(['می\u200C', 'شود'])).toEqual(['می\u200C', 'شود']);
    expect(runs(['می', '\u200Cشود'])).toEqual(['می', '\u200Cشود']);
    expect(runs(['می\u200C', ' شود'])).toEqual(['می', ' شود']);
    expect(runs(['می\u200C\u200C', '\u200Cشود'])).toEqual(['می\u200C', 'شود']);
  });

  it('NR3 letters, invisibles and digits are mapped in every node; a Latin word keeps its digits', () => {
    expect(runs(['علي ', '\u200Eكلينيك', ' 2 جلسه'])).toEqual(['علی ', 'کلینیک', ' ۲ جلسه']);
    expect(runs(['CO', '2 و ۲'])).toEqual(['CO', '2 و ۲']);
    expect(runs(['ساعت 10'], 'keep')).toEqual(['ساعت 10']);
    expect(runs(['"x" و', ' "y'])).toEqual(['«x» و', ' "y']);
  });

  it('NR4 idempotent on its own output', () => {
    const inputs = [
      ['متن ', 'پررنگ', ' ادامه'],
      ['می\u200C', ' شود', '  '],
      ['علي ', '\u200Eكلينيك', ' 2 جلسه', '"x"'],
      ['', ' ', 'الف'],
    ];
    for (const input of inputs) {
      const once = runs(input);
      expect(runs(once)).toEqual(once);
    }
  });
});
