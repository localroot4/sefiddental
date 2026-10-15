import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

/**
 * One-time flash for the no-JavaScript form flows (freeze G3): after a POST the handler answers
 * 303 and sets this encrypted cookie with the outcome (and the submitted values when the form
 * page must show them again). The proxy opens it on the next GET of its target page, hands it to
 * the render in a request header and deletes it. Values never travel in a URL (access logs,
 * Referer). AES-256-GCM with a key derived from FORM_TOKEN_SECRET; no Payload imports (the proxy
 * loads this module).
 */

export const FLASH_COOKIE = '__Host-sefid-flash';
/** Request header the proxy uses to hand the opened flash to the render (proxy-owned). */
export const FLASH_HEADER = 'x-sefid-flash';
export const FLASH_TTL_MS = 10 * 60_000;
export const FLASH_COOKIE_OPTIONS: {
  path: '/';
  secure: true;
  httpOnly: true;
  sameSite: 'lax';
  maxAge: number;
} = { path: '/', secure: true, httpOnly: true, sameSite: 'lax', maxAge: FLASH_TTL_MS / 1000 };

export type FlashOutcome = 'success' | 'neutral' | 'invalid' | 'retry' | 'expired' | 'server';

export interface Flash {
  form: 'booking' | 'emergency';
  /** Public path whose next GET consumes the flash. */
  to: string;
  outcome: FlashOutcome;
  /** Issue time, ms. */
  at: number;
  /** success: the callback line computed at submit time and the masked number. */
  callback?: string;
  masked?: string;
  /** Other outcomes: the submitted text fields, the ticked triage boxes, the field error codes. */
  values?: Record<string, string>;
  triage?: string[];
  errors?: Record<string, string>;
  /** expired: the old time token, so the page renews it pre-aged (renewTimeToken, D-K5). */
  renewTs?: string;
}

const LABEL = 'flash.v1';
// Browsers keep a cookie of at most 4096 bytes for name and value together.
const MAX_COOKIE_VALUE = 3800;

const keyFor = (secret: string): Buffer => createHmac('sha256', secret).update(LABEL).digest();

function encrypt(secret: string, plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  cipher.setAAD(Buffer.from(LABEL));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function decrypt(secret: string, value: string): string | null {
  const raw = Buffer.from(value, 'base64url');
  if (raw.length < 29) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(LABEL));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/**
 * The cookie value, sealed with the current secret. shortcut: a no-JS note too long for one
 * cookie is dropped from the kept values (its error still shows), then, if still too long, all
 * kept values and boxes; the outcome always fits. A JS form never uses the flash.
 */
export function sealFlash(secret: string, flash: Flash): string {
  const sealed = encrypt(secret, JSON.stringify(flash));
  if (sealed.length <= MAX_COOKIE_VALUE) return sealed;
  if (flash.values?.note) {
    return sealFlash(secret, { ...flash, values: { ...flash.values, note: '' } });
  }
  const { values: _values, triage: _triage, ...rest } = flash;
  return encrypt(secret, JSON.stringify(rest));
}

const isFlash = (value: unknown): value is Flash => {
  const f = value as Partial<Flash> | null;
  return (
    typeof f === 'object' &&
    f !== null &&
    (f.form === 'booking' || f.form === 'emergency') &&
    typeof f.to === 'string' &&
    typeof f.outcome === 'string' &&
    typeof f.at === 'number'
  );
};

/** The flash sealed under one of `secrets` and younger than 10 minutes, else null. */
export function openFlash(secrets: readonly string[], value: string, nowMs: number): Flash | null {
  for (const secret of secrets) {
    const text = secret ? decrypt(secret, value) : null;
    if (text === null) continue;
    try {
      const flash = JSON.parse(text) as unknown;
      return isFlash(flash) && nowMs - flash.at <= FLASH_TTL_MS && flash.at <= nowMs + 5000
        ? flash
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

/** Header value for the render: base64url JSON (header values are ASCII). */
export function flashHeaderValue(flash: Flash): string {
  return Buffer.from(JSON.stringify(flash), 'utf8').toString('base64url');
}

/** The flash the proxy handed to this render, or null. Server components call it with headers(). */
export function readFlash(headers: Headers): Flash | null {
  const value = headers.get(FLASH_HEADER);
  if (!value) return null;
  try {
    const flash = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    return isFlash(flash) ? flash : null;
  } catch {
    return null;
  }
}
