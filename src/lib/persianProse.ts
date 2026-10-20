import {
  isArabicLetter,
  isArabicLetterOrMark,
  normalizeLetters,
  normalizePersian,
  stripInvisibles,
  toPersianDigits,
  ZWNJ,
} from './persianText';

/**
 * Editorial prose rules of the save normalizer (H9). Server and admin only: the public form
 * islands import persianText, so this code stays out of it and out of their bundles.
 */

const LATIN_LETTER = /[A-Za-z]/;
const ARABIC_INDIC = /[٠-٩]/g;
const arabicIndicToPersian = (input: string): string =>
  input.replace(ARABIC_INDIC, (d) => toPersianDigits(d));

/** ASCII digits to Persian unless their word (no white space) has a Latin letter: CO2, URLs. */
export function proseDigits(input: string): string {
  return input.replace(/\S+/g, (word) =>
    LATIN_LETTER.test(word) ? arabicIndicToPersian(word) : toPersianDigits(word),
  );
}

/** Straight double quotes in pairs to guillemets; an odd count (inches, a typo) is left alone. */
export function pairQuotes(input: string): string {
  const count = input.split('"').length - 1;
  if (count === 0 || count % 2 === 1) return input;
  let open = true;
  return input.replace(/"/g, () => {
    const mark = open ? '«' : '»';
    open = !open;
    return mark;
  });
}

/**
 * A prose field value: quote pairs, the prose digit rule (C32: content collections only), then
 * the full normalizer. Quotes go before the spacing pass, so the result is idempotent.
 */
export function normalizeProse(
  input: string,
  options: { spacing?: 'collapse' | 'typography'; digits?: boolean } = {},
): string {
  const { spacing = 'typography', digits = true } = options;
  return normalizePersian(pairQuotes(digits ? proseDigits(input) : input), { spacing });
}

/**
 * One text split into rich-text nodes (bold, links): letters, invisibles, Arabic-Indic digits and
 * quote pairs per node; ZWNJ, space runs and the prose digit rule across node boundaries. A node
 * keeps its leading and trailing space, so «متن » + bold + « ادامه» never glue together.
 * Returns one string per input node; idempotent.
 */
export function normalizeRuns(
  segments: readonly string[],
  options: { digits?: 'keep' | 'prose' } = {},
): string[] {
  const local = segments.map((segment) => {
    let text = stripInvisibles(segment).normalize('NFC');
    text = normalizeLetters(text).normalize('NFC');
    text = arabicIndicToPersian(text).replace(/[\t  -   　]/g, ' ');
    return pairQuotes(text);
  });
  const chars: { c: string; node: number }[] = [];
  local.forEach((text, node) => {
    for (const c of text) chars.push({ c, node });
  });
  // A digit stays ASCII when its word, across nodes, has a Latin letter.
  const latinWord = new Array<boolean>(chars.length).fill(false);
  for (let start = 0; start < chars.length;) {
    let end = start;
    while (end < chars.length && !/\s/.test(chars[end]!.c)) end += 1;
    if (chars.slice(start, end).some(({ c }) => LATIN_LETTER.test(c))) {
      latinWord.fill(true, start, end);
    }
    start = end + 1;
  }
  const out = local.map(() => '');
  let previous = '';
  for (let i = 0; i < chars.length; i += 1) {
    const { c, node } = chars[i]!;
    if (c === ZWNJ) {
      // A ZWNJ run keeps one ZWNJ between two Arabic-script letters, as normalizeZwnj does.
      let end = i;
      while (chars[end + 1]?.c === ZWNJ) end += 1;
      if (isArabicLetterOrMark(chars[i - 1]?.c) && isArabicLetter(chars[end + 1]?.c)) {
        out[node] += ZWNJ;
        previous = ZWNJ;
      }
      i = end;
      continue;
    }
    if (c === ' ' && previous === ' ') continue;
    const mapped = options.digits === 'prose' && !latinWord[i] ? toPersianDigits(c) : c;
    out[node] += mapped;
    previous = mapped;
  }
  return out;
}
