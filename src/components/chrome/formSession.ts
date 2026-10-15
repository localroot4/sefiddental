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
}

let pending: Promise<FormSession | null> | null = null;
let expiresAt = 0;

const afterLoad = (): Promise<void> =>
  document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise((resolve) => window.addEventListener('load', () => resolve(), { once: true }));

/**
 * One shared request per page view, sent after `load` (conversion.md 6): every island that needs
 * the tokens or the hours state awaits the same promise. A new request goes out once the answer
 * expires (the next hours change or the token lifetime) or failed. Resolves null on any failure:
 * callers then behave as without JavaScript (a call link dials).
 */
export function getFormSession(now = Date.now()): Promise<FormSession | null> {
  if (pending && now < expiresAt) return pending;
  expiresAt = Number.POSITIVE_INFINITY; // until this request settles
  pending = afterLoad()
    .then(() => fetch('/api/form-session', { cache: 'no-store', credentials: 'same-origin' }))
    .then(async (response) => (response.ok ? ((await response.json()) as FormSession) : null))
    .then((session) => {
      // Shape check only: our own endpoint; zod stays out of the client bundle (nav spec R1).
      if (typeof session?.hours?.showClosedSheet !== 'boolean') throw new Error('form-session');
      expiresAt = Math.min(Date.parse(session.hours.nextChangeAt), now + session.ttlSeconds * 1000);
      return session;
    })
    .catch(() => {
      expiresAt = 0;
      return null;
    });
  return pending;
}
