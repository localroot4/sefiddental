/*
 * Value-based redaction shared by the pino logger and the proxy's access lines. Phone numbers
 * never reach a log (00-master.md, architecture.md 212-213): key-based redaction misses a phone
 * inside a message, an error text or a URL, so every string is scrubbed too. Dependency-free.
 */

const D = '[0-9\\u06F0-\\u06F9\\u0660-\\u0669]';
const SEP = '[\\s-]?';
// No ASCII letter or digit may touch the number (hex ids, hashes and long numbers stay intact);
// Persian letters may, since Persian text often omits the space.
const BEFORE = '(?<![A-Za-z\\p{N}+])';
const AFTER = '(?![\\p{N}A-Za-z])';

// One digit value in Latin, Persian and Arabic-Indic forms.
const ZERO = '[0\\u06F0\\u0660]';
const NINE = '[9\\u06F9\\u0669]';
const EIGHT = '[8\\u06F8\\u0668]';
const IR = `(?:\\+|${ZERO}${ZERO})${NINE}${EIGHT}`;

/**
 * Iranian mobiles (+98 / 0098 / 98 / 0 / none, then 9xx xxx xxxx), Iranian landlines (0 or +98,
 * then 2-digit area code and 8 digits) and any E.164 number, in Latin, Persian or Arabic-Indic
 * digits, with optional single spaces or dashes between groups.
 */
const PHONE = new RegExp(
  [
    `${BEFORE}(?:${IR}${SEP}|${NINE}${EIGHT}|${ZERO})?${NINE}${D}{2}${SEP}${D}{3}${SEP}${D}{4}${AFTER}`,
    `${BEFORE}(?:${IR}${SEP}|${ZERO})${D}{2}${SEP}${D}{4}${SEP}${D}{4}${AFTER}`,
    `(?<![A-Za-z\\p{N}])\\+${D}{8,15}${AFTER}`,
  ].join('|'),
  'gu',
);

export const PHONE_MASK = '[phone]';
export const REDACTED = '[redacted]';

/** Keys whose values are personal or secret whatever they hold. */
const SENSITIVE_KEY =
  /^(?:phone\w*|mobile|tel|e164|national|cookie|authorization|password|token|secret|x-internal-token|ip|ipaddress)$/i;

export function scrubPhones(text: string): string {
  return text.replace(PHONE, PHONE_MASK);
}

const MAX_DEPTH = 8;

/**
 * Deep copy with every string scrubbed, sensitive keys replaced and errors turned into plain
 * `{ type, message, stack, ... }` objects. Never throws; cycles and deep nesting are cut.
 */
export function scrubDeep(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (typeof value === 'string') return scrubPhones(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[depth]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1, seen));
  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  if (value instanceof Error) {
    out.type = value.constructor.name;
    out.message = scrubPhones(value.message);
    if (value.stack) out.stack = scrubPhones(value.stack);
  }
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'raw') continue; // pino's serialized error keeps the original Error under `raw`
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubDeep(inner, depth + 1, seen);
  }
  return out;
}
