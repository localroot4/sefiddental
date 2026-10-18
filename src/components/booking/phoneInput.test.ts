import { describe, expect, it } from 'vitest';

import { maskPhone, parseIranPhone } from '@/lib/phone';

import { maskNational, parseMobile } from './phoneInput';

/** The server parser's answer in the island parser's shape. */
function server(input: string) {
  const result = parseIranPhone(input, { accept: 'mobile' });
  return result.ok ? { ok: true, national: result.national, e164: result.e164 } : result;
}

const CASES = [
  '',
  '   ',
  '09123456789',
  '۰۹۱۲۳۴۵۶۷۸۹',
  '٠٩١٢٣٤٥٦٧٨٩',
  '0912 345 6789',
  '0912-345-6789',
  '+989123456789',
  '+98 912 345 6789',
  '00989123456789',
  '989123456789',
  '9123456789',
  '+9809123456789',
  '009809123456789',
  '02155101054',
  '021 5510 1054',
  '55101054',
  '+982155101054',
  '0912345678',
  '091234567890',
  '0812345678',
  '12345',
  '+98+9123456789',
  '9+123456789',
  'abc',
  'شماره: ۰۹۲۰ ۵۴۵ ۱۰۵۴',
  '\u200E09123456789\u200F',
  '0992 123 4567',
  '+1 202 555 0100',
];

// Deterministic fuzz over the characters a visitor can type or paste.
function fuzz(count: number): string[] {
  const alphabet = '0123456789۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩+ -()9800';
  let seed = 20261015;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  return Array.from({ length: count }, () => {
    const prefix = ['', '0', '09', '+98', '0098', '98', '9'][Math.floor(next() * 7)] ?? '';
    const length = Math.floor(next() * 14);
    let text = prefix;
    for (let i = 0; i < length; i++) text += alphabet[Math.floor(next() * alphabet.length)];
    return text;
  });
}

describe('parseMobile (zod-free twin of parseIranPhone, mobile only)', () => {
  it.each(CASES)('PH1 agrees with the server parser: %j', (input) => {
    expect(parseMobile(input)).toEqual(server(input));
  });

  it('PH2 agrees on 5000 fuzzed inputs, valid mobiles among them', () => {
    const inputs = fuzz(5000);
    let valid = 0;
    for (const input of inputs) {
      const mine = parseMobile(input);
      expect(mine, input).toEqual(server(input));
      if (mine.ok) valid++;
    }
    expect(valid).toBeGreaterThan(20);
  });

  it('PH3 the mask equals maskPhone of the E.164 number', () => {
    for (const input of ['09123456789', '+989205451054', '۰۹۹۲ ۱۲۳ ۴۵۶۷']) {
      const parsed = parseMobile(input);
      if (!parsed.ok) throw new Error(`expected a mobile: ${input}`);
      expect(maskNational(parsed.national)).toBe(maskPhone(parsed.e164));
    }
    expect(maskNational('09123456789')).toBe('۰۹۱۲ *** ۶۷۸۹');
  });
});
