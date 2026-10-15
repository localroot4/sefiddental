import { describe, expect, it } from 'vitest';

import {
  FLASH_HEADER,
  FLASH_TTL_MS,
  flashHeaderValue,
  openFlash,
  readFlash,
  sealFlash,
  type Flash,
} from './flash';

const K = 'k'.repeat(48);
const OLD = 'o'.repeat(48);
const NOW = Date.parse('2026-10-13T08:00:00Z');
const FLASH: Flash = {
  form: 'booking',
  to: '/رزرو-نوبت',
  outcome: 'invalid',
  at: NOW,
  values: { phone: '0912 345 6789', name: 'سارا', note: 'درد دارم' },
  errors: { phone: 'invalid' },
};

describe('form flash cookie (freeze G3)', () => {
  it('FL1 sealed and opened with the same secret; the value hides the content', () => {
    const value = sealFlash(K, FLASH);
    expect(value).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(value).not.toContain('0912');
    expect(Buffer.from(value, 'base64url').toString('utf8')).not.toContain('سارا');
    expect(openFlash([K], value, NOW + 1000)).toEqual(FLASH);
  });

  it('FL2 a tampered value, another secret or a malformed value opens to null', () => {
    const value = sealFlash(K, FLASH);
    const flipped = `${value.slice(0, -2)}${value.endsWith('A') ? 'B' : 'A'}${value.slice(-1)}`;
    expect(openFlash([K], flipped, NOW)).toBeNull();
    expect(openFlash(['x'.repeat(48)], value, NOW)).toBeNull();
    expect(openFlash([K], 'not-a-flash', NOW)).toBeNull();
    expect(openFlash([K], '', NOW)).toBeNull();
  });

  it('FL3 ten minutes of life; a previous secret still opens during a rotation', () => {
    const value = sealFlash(OLD, FLASH);
    expect(openFlash([K, OLD], value, NOW + FLASH_TTL_MS)).toEqual(FLASH);
    expect(openFlash([K, OLD], value, NOW + FLASH_TTL_MS + 1)).toBeNull();
  });

  it('FL4 a note too long for one cookie is dropped from the kept values, nothing else', () => {
    const long = { ...FLASH, values: { ...FLASH.values, note: '一'.repeat(1000) } };
    const value = sealFlash(K, long);
    expect(value.length).toBeLessThanOrEqual(3800);
    expect(openFlash([K], value, NOW)?.values).toEqual({ ...FLASH.values, note: '' });
  });

  it('FL6 still too long without the note: the kept values and boxes are dropped, never the outcome', () => {
    const huge = {
      ...FLASH,
      values: { ...FLASH.values, name: '一'.repeat(2000) },
      triage: ['x'.repeat(3000)],
    };
    const value = sealFlash(K, huge);
    expect(value.length).toBeLessThanOrEqual(3800);
    const { values: _values, ...rest } = FLASH;
    expect(openFlash([K], value, NOW)).toEqual(rest);
  });

  it('FL5 the render reads the header the proxy set; anything else is null', () => {
    const headers = new Headers({ [FLASH_HEADER]: flashHeaderValue(FLASH) });
    expect(readFlash(headers)).toEqual(FLASH);
    expect(readFlash(new Headers())).toBeNull();
    expect(readFlash(new Headers({ [FLASH_HEADER]: 'e30' }))).toBeNull(); // {}
    expect(readFlash(new Headers({ [FLASH_HEADER]: '%%%' }))).toBeNull();
  });
});
