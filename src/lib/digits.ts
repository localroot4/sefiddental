/**
 * Digit helpers, apart from src/lib/persianText.ts: the public form islands need only these, and
 * a shared module ships the union of what every client bundle uses, the admin's normalizer too.
 */

export const DIGIT_ZERO_FA = 0x06f0;
export const DIGIT_ZERO_AR = 0x0660;

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

// Built on first use: constructing it takes about 10 ms, and at module scope that ran during
// hydration on every page whose client code imports this module.
let numberFa: Intl.NumberFormat | null = null;

/** Integer with Persian digits and the separator U+066C. */
export function formatNumberFa(value: number): string {
  if (!Number.isFinite(value)) {
    throw new RangeError('formatNumberFa: the value is not a finite number');
  }
  numberFa ??= new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 });
  return numberFa.format(value);
}
