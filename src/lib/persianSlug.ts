import { normalizeLetters, stripInvisibles, toPersianDigits } from './persianText';

/**
 * URL slug from Persian (or mixed) text. The output is raw Unicode: Persian letters, Persian
 * digits, ASCII a-z and single hyphens. It is stored as is; only URLs percent-encode it.
 * Idempotent, so re-saving an unchanged document never changes its slug.
 */

// Harakat, tanwin, shadda, sukun, maddah, hamza above and below, superscript alef, Quranic marks.
const DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

// The Persian alphabet plus hamza forms and teh marbuta, Persian digits and ASCII a-z (D-S2).
const NOT_KEPT =
  /[^\u0621-\u063A\u0641-\u0648\u067E\u0686\u0698\u06A9\u06AF\u06CC\u06F0-\u06F9a-z]+/g;

interface PersianSlugOptions {
  /** Optional cut at the last hyphen at or before this many characters (decision D-S4). */
  maxLength?: number;
}

export function persianSlug(input: string, options: PersianSlugOptions = {}): string {
  // NFC first keeps alef madda: under NFD it splits into alef plus maddah and the diacritic
  // strip below would drop the maddah. Presentation forms can expose a composable pair, so NFC
  // runs again after the letter map.
  let slug = stripInvisibles(String(input ?? '')).normalize('NFC');
  slug = normalizeLetters(slug).normalize('NFC');
  slug = slug.replace(DIACRITICS, '').replace(/\u06C0/g, '\u0647');
  slug = toPersianDigits(slug).replace(/[A-Z]/g, (c) => c.toLowerCase());
  slug = slug.replace(NOT_KEPT, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');

  const { maxLength } = options;
  if (maxLength === undefined) return slug;
  if (!Number.isInteger(maxLength) || maxLength < 1) {
    throw new RangeError('persianSlug: maxLength must be a positive integer');
  }
  if (slug.length <= maxLength) return slug;
  const cut = slug.lastIndexOf('-', maxLength);
  return (cut > 0 ? slug.slice(0, cut) : slug.slice(0, maxLength)).replace(/-$/, '');
}
