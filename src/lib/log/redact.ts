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

/**
 * Keys whose values are personal or secret whatever they hold. `query` and `params` hold a failed
 * SQL statement and its bound values (drizzle's DrizzleQueryError), `detail` a Postgres error's
 * failing row (S3).
 */
const SENSITIVE_KEY =
  /^(?:phone\w*|mobile|tel|e164|national|cookie|authorization|password|token|secret|x-internal-token|ip|ipaddress|query|params|detail)$/i;

export function scrubPhones(text: string): string {
  return text.replace(PHONE, PHONE_MASK);
}

// drizzle-orm 0.45's DrizzleQueryError message (and so its stack, and every message or stack
// that wraps it) is `Failed query: ${query}\nparams: ${params}`. The values (a name, a note) may
// span lines, so everything after the marker goes: no bound value reaches a log line (S3).
const PARAMS_MARKER = '\nparams:';

export function cutParams(text: string): string {
  const at = text.indexOf(PARAMS_MARKER);
  return at === -1 ? text : `${text.slice(0, at)}${PARAMS_MARKER} ${REDACTED}`;
}

/** Every string the logger writes: query values cut, then phones masked. */
export function scrubText(text: string): string {
  return scrubPhones(cutParams(text));
}

/**
 * An error's stack, scrubbed. V8 writes `${name}: ${message}` before the frames, so a failed
 * query's frames survive the cut; any other stack is cut as a whole.
 */
export function stackOf(err: Error): string | undefined {
  const head = `${err.name}: ${err.message}`;
  if (!err.stack?.startsWith(head)) return err.stack && scrubText(err.stack);
  return scrubText(head) + scrubText(err.stack.slice(head.length));
}

const DRIVER_CODE = /^[A-Z0-9_]{2,40}$/;

/**
 * The cause chain as class and driver code only (SQLITE_BUSY, 23505): a driver's message may
 * quote a bound value, so it never goes in (S3).
 */
export function causesOf(err: Error): Array<{ type: string; code?: string }> {
  const out: Array<{ type: string; code?: string }> = [];
  for (let cause = err.cause; cause instanceof Error && out.length < 5; cause = cause.cause) {
    const code = (cause as { code?: unknown }).code;
    const valid = typeof code === 'string' && DRIVER_CODE.test(code);
    out.push({ type: cause.constructor.name, ...(valid ? { code } : {}) });
  }
  return out;
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
  if (typeof value === 'string') return scrubText(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[depth]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, depth + 1, seen));
  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  // A failed query's driver error goes in as class and code only (see causesOf).
  const failedQuery = value instanceof Error && value.message.includes(PARAMS_MARKER);
  if (value instanceof Error) {
    out.type = value.constructor.name;
    out.message = scrubText(value.message);
    if (value.stack) out.stack = stackOf(value);
    if (failedQuery) out.causes = causesOf(value);
  }
  for (const [key, inner] of Object.entries(value)) {
    if (key === 'raw') continue; // pino's serialized error keeps the original Error under `raw`
    if (failedQuery && key === 'cause') continue;
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : scrubDeep(inner, depth + 1, seen);
  }
  return out;
}
