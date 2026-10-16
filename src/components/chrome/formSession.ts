import type { HoursStateName } from '@/lib/hoursState';

/** The no-store answer of GET /api/form-session (src/app/(site)/api/form-session/handler.ts). */
export interface FormSession {
  csrf: string;
  ts: string;
  ttlSeconds: number;
  hours: {
    state: HoursStateName;
    callsAllowed: boolean;
    showClosedSheet: boolean;
    nextChangeAt: string;
    copy: { callback: string; closedSheet: string | null; emergencyClosedLine: string | null };
  };
  /** Client clock (Date.now()) when the answer arrived: the forms hold a submit 2 s past it (G5). */
  receivedAt?: number;
}

const ENDPOINT = '/api/form-session';

let pending: Promise<FormSession | null> | null = null;
let expiresAt = 0;

const afterLoad = (): Promise<void> =>
  document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));

/** One request, shared from now on by every caller of getFormSession. */
function request(url: string, now: number): Promise<FormSession | null> {
  expiresAt = Number.POSITIVE_INFINITY; // until this request settles
  pending = afterLoad()
    .then(() => fetch(url, { cache: 'no-store', credentials: 'same-origin' }))
    .then(async (response) => (response.ok ? ((await response.json()) as FormSession) : null))
    .then((session) => {
      // Shape check only: our own endpoint; zod stays out of the client bundle (nav spec R1).
      if (typeof session?.hours?.showClosedSheet !== 'boolean') throw new Error('form-session');
      session.receivedAt = Date.now();
      expiresAt = Math.min(Date.parse(session.hours.nextChangeAt), now + session.ttlSeconds * 1000);
      return session;
    })
    .catch(() => {
      expiresAt = 0;
      return null;
    });
  return pending;
}

/**
 * One shared request per page view, sent after `load` (conversion.md 6): every island that needs
 * the tokens or the hours state awaits the same promise. A new request goes out once the answer
 * expires (the next hours change or the token lifetime) or failed. Resolves null on any failure:
 * callers then behave as without JavaScript (a call link dials).
 */
export function getFormSession(now = Date.now()): Promise<FormSession | null> {
  if (pending && now < expiresAt) return pending;
  return request(ENDPOINT, now);
}

/**
 * After a 419: a new session for the expired time token `oldTs`, past the shared cache, which it
 * then replaces (both home forms held the old token). The server pre-ages a genuine expired token
 * (renewTimeToken, D-K5) and answers a fresh one for anything else.
 */
export function renewFormSession(oldTs: string, now = Date.now()): Promise<FormSession | null> {
  return request(`${ENDPOINT}?renew=${encodeURIComponent(oldTs)}`, now);
}
