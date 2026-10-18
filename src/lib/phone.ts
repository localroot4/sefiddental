import { z } from 'zod';

import { toLatinDigits, toPersianDigits } from './persianText';

/**
 * Iranian phone numbers: parse any digit form and common prefix, validate, store E.164, display
 * with Persian digits. The same parser runs in the browser and in route handlers; the server
 * result is the only one that counts. Error messages never include the input value.
 */

export type PhoneAccept = 'mobile' | 'mobile-or-landline';

export type PhoneParse =
  | { ok: true; kind: 'mobile' | 'landline'; national: string; e164: string }
  | { ok: false; reason: 'empty' | 'invalid' | 'landline' };

// conversion.md 5.1, exact copy.
export const PHONE_ERRORS: Record<'empty' | 'invalid' | 'landline', string> = {
  empty: 'شمارهٔ موبایل را وارد کنید.',
  invalid: 'شمارهٔ موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.',
  landline: 'این شمارهٔ تلفن ثابت است. شمارهٔ موبایل را وارد کنید.',
};

export const REGISTERED_NUMBER_LABEL = 'شمارهٔ ثبت\u200Cشده:';

const MOBILE = /^09\d{9}$/;
const LANDLINE = /^0[1-8]\d{9}$/;
const LOCAL_LANDLINE = /^[2-9]\d{7}$/;
const E164 = /^\+98\d{10}$/;

/** The national form (leading 0) of a digits-and-plus string, prefixes resolved. */
function toNational(compact: string): string {
  if (compact.startsWith('+98')) return `0${compact.slice(3).replace(/^0/, '')}`;
  if (compact.startsWith('0098')) return `0${compact.slice(4).replace(/^0/, '')}`;
  if (/^98\d{10}$/.test(compact)) return `0${compact.slice(2)}`;
  if (/^[1-9]\d{9}$/.test(compact)) return `0${compact}`;
  return compact;
}

export function parseIranPhone(input: unknown, options: { accept?: PhoneAccept } = {}): PhoneParse {
  const accept = options.accept ?? 'mobile';
  if (typeof input !== 'string') return { ok: false, reason: 'empty' };

  // Any separator, label or bidi mark is dropped, as the prototypes do.
  const compact = toLatinDigits(input).replace(/[^0-9+]/g, '');
  if (compact === '') return { ok: false, reason: 'empty' };
  if (compact.lastIndexOf('+') > 0) return { ok: false, reason: 'invalid' };

  const national = toNational(compact);
  if (MOBILE.test(national)) {
    return { ok: true, kind: 'mobile', national, e164: `+98${national.slice(1)}` };
  }
  const landline = LANDLINE.test(national);
  if (landline || LOCAL_LANDLINE.test(national)) {
    if (accept === 'mobile') return { ok: false, reason: 'landline' };
    // A local number without an area code has no E.164 form.
    if (!landline) return { ok: false, reason: 'invalid' };
    return { ok: true, kind: 'landline', national, e164: `+98${national.slice(1)}` };
  }
  return { ok: false, reason: 'invalid' };
}

/** Server boundary: a string of at most 64 characters, out as E.164 (mobile only). */
export const mobilePhoneSchema: z.ZodType<string> = z
  .string()
  .max(64)
  .transform((value, ctx) => {
    const result = parseIranPhone(value, { accept: 'mobile' });
    if (!result.ok) {
      ctx.issues.push({ code: 'custom', message: PHONE_ERRORS[result.reason], input: value });
      return z.NEVER;
    }
    return result.e164;
  });

function nationalOf(e164: string, caller: string): string {
  if (!E164.test(e164)) {
    throw new RangeError(`${caller}: expected an Iranian E.164 number (+98 and 10 digits)`);
  }
  return `0${e164.slice(3)}`;
}

/** '۰۹۱۲ ۳۴۵ ۶۷۸۹' for a mobile, '۰۲۱ ۵۵۱۰ ۱۰۵۴' for a landline. */
export function formatPhoneFa(e164: string): string {
  const n = nationalOf(e164, 'formatPhoneFa');
  const grouped = n.startsWith('09')
    ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`
    : `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`;
  return toPersianDigits(grouped);
}

/** First and last four national digits around three asterisks: '۰۹۱۲ *** ۶۷۸۹'. */
export function maskPhone(e164: string): string {
  const n = nationalOf(e164, 'maskPhone');
  // Asterisks: bullets beside Persian digits read as zeros.
  return toPersianDigits(`${n.slice(0, 4)} *** ${n.slice(-4)}`);
}

/**
 * The mask inside plain RTL text (the admin title, notification lines): an LTR isolate keeps its
 * groups in order, no-break spaces keep it on one line.
 */
export function maskPhoneInline(e164: string): string {
  return `\u2066${maskPhone(e164).replace(/ /g, '\u00A0')}\u2069`;
}

export function telHref(e164: string): string {
  nationalOf(e164, 'telHref');
  return `tel:${e164}`;
}

/**
 * Admin search fragment in Latin digits: '+98', '0098', '98' before a 10-digit mobile and one
 * leading 0 removed. null for text that is not a phone query or has fewer than 3 digits.
 */
export function phoneSearchFragment(query: string): string | null {
  const text = toLatinDigits(String(query ?? '')).replace(
    /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
    '',
  );
  if (/[^0-9+\s\-().]/.test(text)) return null;
  const compact = text.replace(/[^0-9+]/g, '');
  if (compact.lastIndexOf('+') > 0) return null;

  let digits = compact;
  if (digits.startsWith('+98')) digits = digits.slice(3);
  else if (digits.startsWith('0098')) digits = digits.slice(4);
  else if (/^989\d{9}$/.test(digits)) digits = digits.slice(2);
  digits = digits.replace(/^\+/, '').replace(/^0/, '');
  return digits.length >= 3 ? digits : null;
}
