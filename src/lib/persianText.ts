/**
 * Persian text normalization: letters, digits, ZWNJ and spacing.
 *
 * Pure functions, no I/O. Invisible characters are written as unicode escapes (bidi controls never
 * appear literally in src/**). The normalizer fixes what users and pasted text get wrong; it never
 * inserts a ZWNJ and never changes diacritics.
 */

export const ZWNJ = '\u200C';

const DIGIT_ZERO_FA = 0x06f0;
const DIGIT_ZERO_AR = 0x0660;

// LRM, RLM, LRE..RLO, LRI..PDI, BOM, soft hyphen and tatweel (R-T2).
const INVISIBLES = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF\u00AD\u0640]/g;

// Arabic presentation forms A (without the word ligatures U+FDF0-U+FDFF) and B (R-T1).
const PRESENTATION_FORMS = /[\uFB50-\uFDCF\uFE70-\uFEFC]/g;

const ARABIC_SCRIPT = /\p{Script=Arabic}/u;
const LETTER = /\p{L}/u;
const LETTER_OR_MARK = /[\p{L}\p{M}]/u;

/** ASCII and Arabic-Indic digits to Persian digits. */
export function toPersianDigits(input: string): string {
  return input.replace(/[0-9\u0660-\u0669]/g, (d) => {
    const code = d.charCodeAt(0);
    const value = code <= 0x39 ? code - 0x30 : code - DIGIT_ZERO_AR;
    return String.fromCharCode(DIGIT_ZERO_FA + value);
  });
}

/** Persian and Arabic-Indic digits to ASCII digits, for parsing. */
export function toLatinDigits(input: string): string {
  return input.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => {
    const code = d.charCodeAt(0);
    const zero = code >= DIGIT_ZERO_FA ? DIGIT_ZERO_FA : DIGIT_ZERO_AR;
    return String.fromCharCode(0x30 + code - zero);
  });
}

/** Removes bidi controls, BOM, soft hyphen and tatweel. */
export function stripInvisibles(input: string): string {
  return input.replace(INVISIBLES, '');
}

/** Presentation forms to base letters, then Arabic yeh, alef maksura and kaf to Persian letters. */
export function normalizeLetters(input: string): string {
  return input
    .replace(PRESENTATION_FORMS, (c) => c.normalize('NFKC'))
    .replace(/[\u064A\u0649]/g, '\u06CC')
    .replace(/\u0643/g, '\u06A9');
}

const isArabicLetterOrMark = (c: string | undefined): boolean =>
  c !== undefined && ARABIC_SCRIPT.test(c) && LETTER_OR_MARK.test(c);
const isArabicLetter = (c: string | undefined): boolean =>
  c !== undefined && ARABIC_SCRIPT.test(c) && LETTER.test(c);

/**
 * A ZWNJ run collapses to one ZWNJ, kept only between an Arabic-script letter (or mark) and an
 * Arabic-script letter (R-T4). Every other ZWNJ is dropped; two words are never joined.
 */
export function normalizeZwnj(input: string): string {
  const chars = Array.from(input);
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const c = chars[i] as string;
    if (c !== ZWNJ) {
      out += c;
      continue;
    }
    let end = i;
    while (chars[end + 1] === ZWNJ) end += 1;
    if (isArabicLetterOrMark(chars[i - 1]) && isArabicLetter(chars[end + 1])) out += ZWNJ;
    i = end;
  }
  return out;
}

/** Line endings, unusual spaces, space runs and blank-line runs (R-T5). */
export function collapseSpaces(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[\t\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/ {2,}/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Editorial typography (opt-in, never for user notes, R-T6): no space before closing punctuation,
 * none inside brackets and guillemets, one space around them when a word touches them. A dot or a
 * colon followed by text is left alone (decimals, times, URLs).
 */
export function fixPersianSpacing(input: string): string {
  return collapseSpaces(input)
    .replace(/ +([\u060C\u061B\u061F.!)\u00BB])/g, '$1')
    .replace(/([(\u00AB]) +/g, '$1')
    .replace(/([\p{L}\p{M}\p{N}])([(\u00AB])/gu, '$1 $2')
    .replace(/([)\u00BB])([\p{L}\p{N}])/gu, '$1 $2')
    .replace(/([\u060C\u061B\u061F])([\p{L}\p{N}])/gu, '$1 $2');
}

interface NormalizePersianOptions {
  /** 'keep' (default): only Arabic-Indic digits become Persian; ASCII may be an LTR island. */
  digits?: 'keep' | 'fa' | 'latin';
  /** 'collapse' (default) or 'typography' for editorial prose. */
  spacing?: 'collapse' | 'typography';
}

function convertDigits(input: string, mode: 'keep' | 'fa' | 'latin'): string {
  if (mode === 'fa') return toPersianDigits(input);
  if (mode === 'latin') return toLatinDigits(input);
  return input.replace(/[\u0660-\u0669]/g, (d) =>
    String.fromCharCode(DIGIT_ZERO_FA + d.charCodeAt(0) - DIGIT_ZERO_AR),
  );
}

/**
 * The full normalizer (R-T7): NFC, letters, invisibles, digits, ZWNJ, spacing. Keeps diacritics.
 * Idempotent: invisibles go before NFC and a second NFC follows the presentation-form mapping, so
 * no pair that only composes after a removal or a mapping survives the first pass.
 */
export function normalizePersian(input: string, options: NormalizePersianOptions = {}): string {
  const { digits = 'keep', spacing = 'collapse' } = options;
  let text = stripInvisibles(input).normalize('NFC');
  text = normalizeLetters(text).normalize('NFC');
  text = convertDigits(text, digits);
  text = normalizeZwnj(text);
  return spacing === 'typography' ? fixPersianSpacing(text) : collapseSpaces(text);
}

const NUMBER_FA = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });

/** Integer with Persian digits and the separator U+066C. */
export function formatNumberFa(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError('formatNumberFa: the value is not a finite number');
  }
  return NUMBER_FA.format(value);
}
