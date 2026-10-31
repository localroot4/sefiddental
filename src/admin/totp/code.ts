import { toLatinDigits } from '@/lib/digits';

/**
 * A TOTP code as the endpoints take it: Persian and Arabic-Indic digits become ASCII (a Persian
 * keyboard layout types ۰-۹), and whitespace, '-' and ZWNJ go. Anything else stays, so the
 * plugin refuses the token.
 */
export function normalizeCode(input: string): string {
  return toLatinDigits(input).replace(/[\s‌-]/g, '');
}

/** The digits of a typed, pasted or autofilled code for the six boxes: nothing but 0-9. */
export function codeDigits(input: string): string {
  return toLatinDigits(input).replace(/\D/g, '');
}
