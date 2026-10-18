import { toLatinDigits, toPersianDigits } from '@/lib/persianText';

/*
 * The browser twin of parseIranPhone(value, { accept: 'mobile' }) and maskPhone in src/lib/phone.ts.
 * That module imports zod at load for its server schema, so a form island importing it would ship
 * zod to every visitor. phoneInput.test.ts runs both parsers over the same inputs. The server
 * result is the only one that counts.
 */

export type MobileParse =
  | { ok: true; national: string; e164: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'landline' };

const MOBILE = /^09\d{9}$/;
const LANDLINE = /^0[1-8]\d{9}$/;
const LOCAL_LANDLINE = /^[2-9]\d{7}$/;

function toNational(compact: string): string {
  if (compact.startsWith('+98')) return `0${compact.slice(3).replace(/^0/, '')}`;
  if (compact.startsWith('0098')) return `0${compact.slice(4).replace(/^0/, '')}`;
  if (/^98\d{10}$/.test(compact)) return `0${compact.slice(2)}`;
  if (/^[1-9]\d{9}$/.test(compact)) return `0${compact}`;
  return compact;
}

export function parseMobile(input: string): MobileParse {
  const compact = toLatinDigits(input).replace(/[^0-9+]/g, '');
  if (compact === '') return { ok: false, reason: 'empty' };
  if (compact.lastIndexOf('+') > 0) return { ok: false, reason: 'invalid' };
  const national = toNational(compact);
  if (MOBILE.test(national)) return { ok: true, national, e164: `+98${national.slice(1)}` };
  if (LANDLINE.test(national) || LOCAL_LANDLINE.test(national)) {
    return { ok: false, reason: 'landline' };
  }
  return { ok: false, reason: 'invalid' };
}

/** «۰۹۱۲ *** ۶۷۸۹» from a national mobile number (conversion.md 5.4 item 3). */
export function maskNational(national: string): string {
  return toPersianDigits(`${national.slice(0, 4)} *** ${national.slice(-4)}`);
}
