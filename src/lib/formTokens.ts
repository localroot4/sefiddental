import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Form tokens (server only): a signed CSRF double-submit token bound to an anonymous form
 * cookie, and a signed time token for the 2-second trap. Imported by route handlers and the
 * proxy; no Payload, node:fs or next/headers imports. Tokens, the cookie and the sid are never
 * logged or put into an error message.
 *
 * Formats (spec 7.4):
 *   csrf = base64url(HMAC-SHA256(secret, 'csrf.v1|' + sid))
 *   ts   = 'v1.' + t36 + '.' + base64url(HMAC-SHA256(secret, 'ts.v1|' + sid + '|' + t36))
 * The labels keep the two uses of one key apart; the time MAC covers both sid and t.
 */

export const FORM_COOKIE = '__Host-sefid-form';
export const FORM_COOKIE_OPTIONS: {
  path: '/';
  secure: true;
  httpOnly: true;
  sameSite: 'lax';
  maxAge: 86400;
} = { path: '/', secure: true, httpOnly: true, sameSite: 'lax', maxAge: 86400 };
/** Request header the proxy uses to hand the sid to the booking and emergency renders. */
export const FORM_SID_HEADER = 'x-sefid-form-sid';
export const MIN_AGE_MS = 2000;
export const CLOCK_SKEW_MS = 5000;
const DEFAULT_TTL_MS = 7200 * 1000;

const SID = /^[A-Za-z0-9_-]{43}$/;
const CSRF = /^[A-Za-z0-9_-]{43}$/;
const TIME_TOKEN = /^v1\.([0-9a-z]{1,11})\.([A-Za-z0-9_-]{43})$/;

export type TokenStatus = 'ok' | 'too-fast' | 'expired' | 'invalid' | 'missing';

/** 32 random bytes, base64url: 43 characters. */
export function newSid(): string {
  return randomBytes(32).toString('base64url');
}

export function isWellFormedSid(value: string | undefined): value is string {
  return typeof value === 'string' && SID.test(value);
}

const mac = (secret: string, message: string): string =>
  createHmac('sha256', secret).update(message).digest('base64url');

/** Constant-time comparison; unequal lengths return false (timingSafeEqual would throw). */
function sameString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function usableSecrets(secrets: readonly string[]): readonly string[] {
  const usable = secrets.filter((s) => typeof s === 'string' && s.length > 0);
  if (usable.length === 0) throw new Error('formTokens: no form token secret is configured');
  return usable;
}

/** Deterministic per sid, so several forms and tabs share one value. */
export function csrfFor(secret: string, sid: string): string {
  return mac(secret, `csrf.v1|${sid}`);
}

const SID_HASH_LABEL = 'sefid-form-sid-hash.v1';

/**
 * The mark a booking row keeps of the browser that sent it (S4): HMAC-SHA256 of the sid under a key
 * derived from the current secret by its own label, hex. Never the sid, never equal to a token.
 */
export function sidHash(secrets: readonly string[], sid: string): string {
  const key = createHmac('sha256', usableSecrets(secrets)[0] as string)
    .update(SID_HASH_LABEL)
    .digest();
  return createHmac('sha256', key).update(sid).digest('hex');
}

export function issueTimeToken(
  secret: string,
  sid: string,
  nowMs: number,
  options: { preAgedMs?: number } = {},
): string {
  const issuedAt = nowMs - (options.preAgedMs ?? 0);
  if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) {
    throw new RangeError('issueTimeToken: the issue time must be a non-negative integer of ms');
  }
  const t36 = issuedAt.toString(36);
  return `v1.${t36}.${mac(secret, `ts.v1|${sid}|${t36}`)}`;
}

/** Issue time of a time token whose MAC is valid for `sid` under one of `secrets`, else null. */
function signedIssueTime(secrets: readonly string[], sid: string, ts: string): number | null {
  const match = TIME_TOKEN.exec(ts);
  if (!match) return null;
  const [, t36 = '', signature = ''] = match;
  const valid = secrets.some((secret) => sameString(mac(secret, `ts.v1|${sid}|${t36}`), signature));
  return valid ? Number.parseInt(t36, 36) : null;
}

export function verifyFormTokens(input: {
  secrets: readonly string[];
  cookieSid: string | undefined;
  csrf: string | undefined;
  ts: string | undefined;
  nowMs: number;
  minAgeMs?: number;
  ttlMs?: number;
  skewMs?: number;
}): { status: TokenStatus; ageMs?: number } {
  const secrets = usableSecrets(input.secrets);
  const { cookieSid, csrf, ts, nowMs } = input;
  const minAgeMs = input.minAgeMs ?? MIN_AGE_MS;
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const skewMs = input.skewMs ?? CLOCK_SKEW_MS;

  // A form rendered without tokens (no-JS home form): not stored, re-rendered with its values.
  if (!csrf && !ts) return { status: 'missing' };
  if (!isWellFormedSid(cookieSid) || !csrf || !ts || !CSRF.test(csrf)) return { status: 'invalid' };
  if (!secrets.some((secret) => sameString(csrfFor(secret, cookieSid), csrf))) {
    return { status: 'invalid' };
  }

  const issuedAt = signedIssueTime(secrets, cookieSid, ts);
  if (issuedAt === null) return { status: 'invalid' };
  const ageMs = nowMs - issuedAt;
  if (ageMs < -skewMs) return { status: 'invalid' };
  if (ageMs < minAgeMs) return { status: 'too-fast', ageMs };
  if (ageMs > ttlMs) return { status: 'expired', ageMs };
  return { status: 'ok', ageMs };
}

/**
 * A fresh time token, signed with the current secret (secrets[0]). When `oldTs` is a genuine,
 * expired token for this sid, the new one is pre-aged by `minAgeMs`, so the visitor's immediate
 * second press after a 419 is not flagged; any other value gives a normal fresh token, so renewal
 * cannot skip the time trap (decision D-K5).
 */
export function renewTimeToken(input: {
  secrets: readonly string[];
  sid: string;
  oldTs: string | undefined;
  nowMs: number;
  minAgeMs?: number;
  ttlMs?: number;
}): string {
  const secrets = usableSecrets(input.secrets);
  const minAgeMs = input.minAgeMs ?? MIN_AGE_MS;
  const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
  const current = secrets[0] as string;

  const issuedAt = input.oldTs ? signedIssueTime(secrets, input.sid, input.oldTs) : null;
  const expired = issuedAt !== null && input.nowMs - issuedAt > ttlMs;
  return issueTimeToken(current, input.sid, input.nowMs, { preAgedMs: expired ? minAgeMs : 0 });
}

/**
 * Cross-site request check (OWASP fetch metadata with an Origin fallback): with Sec-Fetch-Site,
 * only 'same-origin' and 'none' pass; else an Origin must equal the site origin; with neither
 * header the request continues (non-browser clients; the tokens still apply).
 */
export function checkFetchOrigin(input: {
  secFetchSite: string | null;
  origin: string | null;
  baseOrigin: string;
}): 'pass' | 'reject' {
  if (input.secFetchSite !== null) {
    const site = input.secFetchSite.trim().toLowerCase();
    return site === 'same-origin' || site === 'none' ? 'pass' : 'reject';
  }
  if (input.origin !== null) return input.origin.trim() === input.baseOrigin ? 'pass' : 'reject';
  return 'pass';
}
