import type { Logger } from 'pino';

import { BOOKING_FIELDS as F } from '@/components/booking/fields';
import type { ServerEnv } from '@/lib/env';
import type { EventRow } from '@/lib/events/allowlist';
import { callbackDueAt, type BookingStatus } from '@/hooks/booking';
import { checkFetchOrigin, FORM_COOKIE, sidHash, verifyFormTokens } from '@/lib/formTokens';
import { hoursClock, hoursState, type ClinicHours, type HoursOptions } from '@/lib/hoursState';
import { readTextCapped } from '@/lib/http/body';
import { clientIpFrom, hashIp } from '@/lib/http/clientIp';
import { FLASH_COOKIE, FLASH_COOKIE_OPTIONS, sealFlash, type Flash } from '@/lib/http/flash';
import type { RateLimiter } from '@/lib/http/rateLimit';
import { zonedDateKey } from '@/lib/jalali';
import type { NotifyEvent } from '@/lib/notify/types';
import { PAGE_PATHS } from '@/lib/paths';
import { maskPhone } from '@/lib/phone';

import {
  formValues,
  parseBookingRequest,
  parseEmergencyRequest,
  TRIAGE,
  type BookingRequest,
  type Catalog,
  type EmergencyRequest,
  type FieldErrors,
  type FormInput,
  type Triage,
} from './request';

/**
 * POST /api/booking and /api/emergency (booking-pipeline 5, emergency.md 6.3, freeze G2-G8).
 * Order: origin, process cap, size, fields, tokens, honeypot, per-IP, duplicates and per-phone
 * limit, persist, answer; notify and count after the answer. Suspicious requests are answered
 * exactly like real ones and stored up to a ceiling per IP key. Every limit counts database rows
 * and appended entries (rolling windows), so it holds across restarts.
 * Dependencies are injected (like form-session/handler.ts): unit tests run without Payload.
 */

type Id = number | string;
export type BookingKind = 'regular' | 'emergency';
export type BookingFlag = 'honeypot' | 'too_fast' | 'bad_token' | 'ip_rate' | 'emergency_ip_rate';

export interface DuplicateEntry {
  at: string;
  name: string | null;
  note: string | null;
  serviceKey: string | null;
  preferredTime: string | null;
  sourceUrl: string | null;
  triage: Triage[] | null;
  /** Counts the entry toward the per-IP rule; appends add no row. */
  ipHash: string | null;
  /** sidHash() of the sending browser: a later request from it may see the neutral answer (S4). */
  sidHash: string | null;
}

/** The row the handler creates (Bookings fields; hooks add listTitle, urgencyRank, callbackDueAt). */
export interface NewBooking {
  kind: BookingKind;
  status: 'new' | 'suspicious';
  flags: BookingFlag[];
  phone: string;
  phoneNational: string;
  name: string | null;
  note: string | null;
  bookingGroup: string | null;
  service: Id | null;
  serviceKey: string | null;
  tier: string | null;
  doctor: Id | null;
  preferredTime: string | null;
  triage: string[] | null;
  formLocation: string;
  sourceUrl: string | null;
  utm: Record<string, string>;
  device: 'mobile' | 'tablet' | 'desktop' | 'unknown';
  ipHash: string | null;
  sidHash: string | null;
  callbackDueAt: string | null;
  createdAt: string;
}

export interface BookingStore {
  /**
   * Rows of this phone and kind created at or after `sinceMs`, not suspicious or spam, newest
   * first, with the browser marks of the row (its createdAt) and of its appended entries (their
   * `at`): one per request that carried a sid hash.
   */
  recentClean(
    phone: string,
    kind: BookingKind,
    sinceMs: number,
  ): Promise<
    Array<{
      id: Id;
      createdAtMs: number;
      status: BookingStatus;
      marks: Array<{ sidHash: string; atMs: number }>;
    }>
  >;
  /**
   * Requests from this IP hash at or after `sinceMs` (one kind, or all): rows of any status plus
   * entries appended to rows.
   */
  countFromIp(ipHash: string, sinceMs: number, kind?: BookingKind): Promise<number>;
  /** Rows from this IP hash at or after `sinceMs` that are suspicious or spam (the S1 ceiling). */
  countSuspiciousFromIp(ipHash: string, sinceMs: number): Promise<number>;
  create(row: NewBooking): Promise<{ id: Id }>;
  /**
   * Appends to duplicateSubmissions and returns true; never overwrites. A row that already holds
   * `max` entries gets 1 added to its appendsDropped counter, atomically, and false (S10).
   */
  appendDuplicate(id: Id, entry: DuplicateEntry, max: number): Promise<boolean>;
}

export interface FormHandlerDeps {
  env: () => Pick<
    ServerEnv,
    | 'formTokenSecrets'
    | 'formTokenTtlSeconds'
    | 'siteUrl'
    | 'ipHashSecret'
    | 'trustProxyHeaders'
    | 'trustedProxyHops'
    | 'qaRoutes'
  >;
  store: BookingStore;
  loadHours: () => Promise<{ hours: ClinicHours; options: HoursOptions }>;
  notify: (event: NotifyEvent) => Promise<void>;
  /** First-party counter row (freeze G8): the no-JS success, which sends no beacon. */
  countEvent: (row: EventRow) => Promise<void>;
  /** Runs work after the answer is sent (next/server `after`); notify and countEvent go here. */
  defer: (work: () => Promise<void>) => void;
  /** One window shared by both form routes (FORM_PROCESS_LIMIT); key 'all'. */
  limiter: RateLimiter;
  logger: Pick<Logger, 'child'>;
  now: () => number;
}

export interface BookingHandlerDeps extends FormHandlerDeps {
  catalog: () => Promise<Catalog>;
}

export interface EmergencyHandlerDeps extends FormHandlerDeps {
  /** features.emergencyEnabled; false answers 404 (freeze G12). */
  emergencyEnabled: () => Promise<boolean>;
}

export const BODY_MAX_BYTES = 16 * 1024;
export const IP_LIMIT = { count: 10, windowMs: 60 * 60_000 } as const;
export const EMERGENCY_IP_LIMIT = { count: 3, windowMs: 24 * 60 * 60_000 } as const;
export const PHONE_LIMIT = { count: 3, windowMs: 24 * 60 * 60_000 } as const;
export const EMERGENCY_PHONE_WINDOW_MS = 24 * 60 * 60_000;
export const DUPLICATE_WINDOW_MS = 10 * 60_000;
/** Suspicious rows one IP key may add in the rolling hour; later ones are answered, not stored (S1). */
export const SUSPICIOUS_IP_CEILING = 50;
/** Clients of unknown IP share one key with ten times every per-IP number (S2). */
export const UNKNOWN_IP_FACTOR = 10;
/** POSTs of both forms together per process, checked before the body is read (S1). */
export const FORM_PROCESS_LIMIT = { limit: 600, windowMs: 60_000 } as const;
/** Entries one row keeps: a flood of repeats must not grow a row (and its rewrite) without bound. */
export const DUPLICATE_MAX = 20;
// A repeat goes only to a row reception still works on, never a closed one; an emergency only
// while it still ranks first (urgencyRank). Otherwise the request is a new row.
const APPENDABLE: Record<BookingKind, readonly BookingStatus[]> = {
  regular: ['new', 'contacted', 'scheduled'],
  emergency: ['new', 'contacted'],
};
const SUSPICIOUS: readonly BookingFlag[] = ['honeypot', 'too_fast', 'bad_token', 'ip_rate'];

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...NO_STORE, 'Content-Type': 'application/json; charset=utf-8' },
  });
const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { ...NO_STORE, ...headers } });

/** Device class from the User-Agent; the string itself is never stored. */
export function deviceClass(userAgent: string | null): NewBooking['device'] {
  if (!userAgent) return 'unknown';
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(userAgent)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) return 'mobile';
  return 'desktop';
}

// One in-process queue per IP hash and per phone: a count and the write it decides must not
// interleave (booking-pipeline 5.4 concurrency note; the app runs as one instance by design).
// The IP queue is always taken first, so the two never wait on each other in a cycle.
const queues = new Map<string, Promise<unknown>>();
async function serialized<T>(key: string, work: () => Promise<T>): Promise<T> {
  const run = (queues.get(key) ?? Promise.resolve()).then(work, work);
  const tail = run.catch(() => undefined);
  queues.set(key, tail);
  try {
    return await run;
  } finally {
    if (queues.get(key) === tail) queues.delete(key);
  }
}

// One warning per process for both handlers (Q7).
let warnedUnknownIp = false;
// IP key -> time of its last form_dropped line: one line per key per hour (S1).
const droppedWarnedAt = new Map<string, number>();

// Submitted text the form page shows again without JavaScript (G3), each capped for the cookie.
const KEPT_FIELDS: Record<'booking' | 'emergency', ReadonlyArray<[string, number]>> = {
  booking: [
    [F.phone, 64],
    [F.name, 100],
    [F.service, 40],
    [F.serviceKey, 100],
    [F.tier, 40],
    [F.dentist, 200],
    [F.timePref, 20],
    [F.note, 1000],
    [F.location, 20],
  ],
  emergency: [
    [F.phone, 64],
    [F.name, 100],
    [F.note, 1000],
  ],
};

type Outcome =
  | { kind: 'stored'; status: 'new' | 'suspicious'; id: Id }
  | { kind: 'dropped'; count: number }
  | { kind: 'appended'; reason: 'duplicate' | 'limit' | 'repeat' | 'capped'; id: Id };

function createFormHandler<R extends BookingRequest | EmergencyRequest>(
  form: 'booking' | 'emergency',
  deps: FormHandlerDeps,
  parse: (input: FormInput) => Promise<{ ok: true; data: R } | { ok: false; errors: FieldErrors }>,
  enabled: () => Promise<boolean>,
) {
  const route = form === 'booking' ? '/api/booking' : '/api/emergency';
  const kind: BookingKind = form === 'booking' ? 'regular' : 'emergency';
  const formPage = form === 'booking' ? PAGE_PATHS.booking : PAGE_PATHS.emergency;
  const successPage = form === 'booking' ? PAGE_PATHS['booking-success'] : PAGE_PATHS.emergency;
  // Busy answers since this route's last form_busy line; one line per cap window.
  let busy = { count: 0, loggedAt: -Infinity };

  return async function handle(request: Request): Promise<Response> {
    const nowMs = deps.now();
    const reqId = request.headers.get('x-request-id') ?? undefined;
    const log = deps.logger.child({ reqId, route });
    const env = deps.env();
    const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');
    let input: FormInput = { fields: {}, triage: [] };

    // 303 to a page with a one-time flash (no-JS flows); the values never go into the URL.
    const redirect = (to: string, flash: Omit<Flash, 'form' | 'to' | 'at'>) => {
      const secret = env.formTokenSecrets[0];
      if (!secret) throw new Error(`${route}: FORM_TOKEN_SECRET is not configured`);
      const value = sealFlash(secret, { form, to, at: nowMs, ...flash });
      const cookie = [
        `${FLASH_COOKIE}=${value}`,
        `Path=${FLASH_COOKIE_OPTIONS.path}`,
        `Max-Age=${FLASH_COOKIE_OPTIONS.maxAge}`,
        'Secure',
        'HttpOnly',
        'SameSite=Lax',
      ].join('; ');
      return new Response(null, {
        status: 303,
        headers: { ...NO_STORE, Location: encodeURI(to), 'Set-Cookie': cookie },
      });
    };
    const kept = () => ({
      values: Object.fromEntries(
        KEPT_FIELDS[form].map(([name, max]) => [name, (input.fields[name] ?? '').slice(0, max)]),
      ),
      // Known boxes only: any other value would only grow the cookie.
      ...(form === 'emergency' ? { triage: TRIAGE.filter((v) => input.triage.includes(v)) } : {}),
    });

    try {
      if (!(await enabled())) return empty(404);
      const origin = checkFetchOrigin({
        secFetchSite: request.headers.get('sec-fetch-site'),
        origin: request.headers.get('origin'),
        baseOrigin: new URL(env.siteUrl).origin,
      });
      if (origin === 'reject') {
        log.info({ msg: 'form_rejected', status: 403 });
        return empty(403);
      }
      // After the origin check (headers only), so cross-site posts never spend it; before the body.
      const gate = deps.limiter.hit('all', nowMs);
      if (!gate.ok) {
        busy.count += 1;
        if (nowMs - busy.loggedAt >= FORM_PROCESS_LIMIT.windowMs) {
          log.warn({ msg: 'form_busy', count: busy.count });
          busy = { count: 0, loggedAt: nowMs };
        }
        // No-JS: the form page's server notice, which gives the clinic number.
        return wantsJson
          ? empty(503, { 'Retry-After': String(gate.retryAfterSec) })
          : redirect(formPage, { outcome: 'server' });
      }
      const text = await readTextCapped(request, BODY_MAX_BYTES);
      if (text === null) {
        log.info({ msg: 'form_rejected', status: 413 });
        return empty(413);
      }
      try {
        const contentType = request.headers.get('content-type') ?? '';
        input = formValues(
          await new Response(text, { headers: { 'content-type': contentType } }).formData(),
        );
      } catch {
        log.info({ msg: 'form_rejected', status: 400 });
        return empty(400);
      }

      // Fields first: a stored row needs a valid phone (booking-pipeline 5.4 step 2).
      const parsed = await parse(input);
      if (!parsed.ok) {
        log.info({ msg: 'form_invalid', fields: Object.keys(parsed.errors) });
        return wantsJson
          ? json(422, { ok: false, errors: parsed.errors })
          : redirect(formPage, { outcome: 'invalid', errors: parsed.errors, ...kept() });
      }
      const data = parsed.data;

      const flags: BookingFlag[] = [];
      const ts = input.fields[F.ts] ?? '';
      const cookieSid = cookieValue(request.headers.get('cookie'), FORM_COOKIE);
      const token = verifyFormTokens({
        secrets: env.formTokenSecrets,
        cookieSid,
        csrf: input.fields[F.csrf] ?? '',
        ts,
        nowMs,
        ttlMs: env.formTokenTtlSeconds * 1000,
      });
      if (token.status === 'missing' || token.status === 'expired') {
        log.info({ msg: 'form_tokens', token: token.status });
        if (wantsJson) return json(419, { ok: false, error: 'expired' });
        return token.status === 'missing'
          ? redirect(formPage, { outcome: 'retry', ...kept() })
          : redirect(formPage, { outcome: 'expired', renewTs: ts, ...kept() });
      }
      if (token.status === 'invalid') flags.push('bad_token');
      if (token.status === 'too-fast') flags.push('too_fast');
      if ((input.fields[F.honeypot] ?? '') !== '') flags.push('honeypot');
      // Only a verified sid marks the browser (S4); a forged token has none.
      const browser =
        token.status !== 'invalid' && cookieSid ? sidHash(env.formTokenSecrets, cookieSid) : null;

      const ip = clientIpFrom(request.headers, env);
      // Unknown clients share one key ('unknown' is never an address) with ten times the limits.
      const ipHash = hashIp(ip ?? 'unknown', env.ipHashSecret);
      const factor = ip === null ? UNKNOWN_IP_FACTOR : 1;
      if (ip === null && !warnedUnknownIp) {
        warnedUnknownIp = true;
        // Production sets TRUST_PROXY_HEADERS (deploy.md 2.4); without it everyone shares one IP.
        log.warn({ msg: 'form_ip_unknown', rule: 'per_ip_shared' });
      }
      // One hours reading for the stored callback time and the answer's line (G6); QA-CLOCK
      // moves the hours only, never token ages or limit windows. A failed read loses no request.
      const reading = await deps.loadHours().catch((error: unknown) => {
        log.error({ msg: 'form_hours_failed', ...errorFields(error) });
        return null;
      });
      const clock = hoursClock(request.headers, env.qaRoutes, nowMs);
      const booking = 'formLocation' in data ? (data as BookingRequest) : null;
      const triage = 'triage' in data ? (data as EmergencyRequest).triage : null;

      const decide = async () => {
        // This browser's own earlier requests make this one a repeat (S4); set below.
        let repeat = false;
        let spike: { ipHashPrefix: string; count: number } | null = null;
        const lastHour = await deps.store.countFromIp(ipHash, nowMs - IP_LIMIT.windowMs);
        // Every request above the limit asks; the notifier sends one per window.
        if (lastHour >= IP_LIMIT.count * factor) {
          flags.push('ip_rate');
          spike = { ipHashPrefix: ipHash.slice(0, 8), count: lastHour + 1 };
        }
        if (kind === 'emergency') {
          const today = await deps.store.countFromIp(
            ipHash,
            nowMs - EMERGENCY_IP_LIMIT.windowMs,
            'emergency',
          );
          if (today >= EMERGENCY_IP_LIMIT.count * factor) flags.push('emergency_ip_rate');
        }
        const suspicious = flags.some((flag) => SUSPICIOUS.includes(flag));

        const row: NewBooking = {
          kind,
          status: suspicious ? 'suspicious' : 'new',
          flags,
          phone: data.phone,
          phoneNational: data.phoneNational,
          name: data.name,
          note: data.note,
          bookingGroup: booking?.bookingGroup ?? null,
          service: booking?.serviceId ?? null,
          serviceKey: booking?.serviceKey ?? null,
          tier: booking?.tier ?? null,
          doctor: booking?.doctorId ?? null,
          preferredTime: booking?.preferredTime ?? null,
          triage,
          formLocation: booking?.formLocation ?? 'emergency',
          sourceUrl: data.sourceUrl,
          utm: data.utm,
          device: deviceClass(request.headers.get('user-agent')),
          ipHash,
          sidHash: browser,
          callbackDueAt: reading ? callbackDueAt(clock, reading.hours, reading.options) : null,
          createdAt: new Date(nowMs).toISOString(),
        };

        // Suspicious requests never count toward or meet the phone rules (Q4): a new row, up to
        // the ceiling of this IP key; past it nothing is stored (S1).
        const storeSuspicious = async (): Promise<Outcome> => {
          const count = await deps.store.countSuspiciousFromIp(ipHash, nowMs - IP_LIMIT.windowMs);
          if (count >= SUSPICIOUS_IP_CEILING * factor) return { kind: 'dropped', count };
          return { kind: 'stored', status: 'suspicious', id: (await deps.store.create(row)).id };
        };
        const outcome: Outcome = suspicious
          ? await storeSuspicious()
          : await serialized(data.phone, async (): Promise<Outcome> => {
              const window =
                kind === 'emergency' ? EMERGENCY_PHONE_WINDOW_MS : PHONE_LIMIT.windowMs;
              // Three windows back: every mark of the last two lies on one of these rows (an
              // entry lands at most one window after its row), whoever sent the row.
              const rows = await deps.store.recentClean(data.phone, kind, nowMs - 3 * window);
              repeat = ownRepeat(
                kind,
                rows.flatMap((r) =>
                  r.marks
                    .filter((m) => m.sidHash === browser && m.atMs >= nowMs - 2 * window)
                    .map((m) => ({ atMs: m.atMs, open: APPENDABLE[kind].includes(r.status) })),
                ),
                nowMs,
              );
              const recent = rows.filter((r) => r.createdAtMs >= nowMs - window);
              const open = recent.filter((r) => APPENDABLE[kind].includes(r.status));
              const newest = open[0];
              const append = async (
                target: (typeof open)[number],
                reason: 'duplicate' | 'limit' | 'repeat',
              ) => {
                const added = await deps.store.appendDuplicate(
                  target.id,
                  {
                    at: row.createdAt,
                    name: row.name,
                    note: row.note,
                    serviceKey: row.serviceKey,
                    preferredTime: row.preferredTime,
                    sourceUrl: row.sourceUrl,
                    triage,
                    ipHash,
                    sidHash: browser,
                  },
                  DUPLICATE_MAX,
                );
                return {
                  kind: 'appended',
                  reason: added ? reason : 'capped',
                  id: target.id,
                } as const;
              };
              if (kind === 'emergency') {
                const first = open.at(-1);
                if (first) return append(first, 'repeat');
              } else if (newest) {
                if (newest.createdAtMs >= nowMs - DUPLICATE_WINDOW_MS) {
                  return append(newest, 'duplicate');
                }
                if (recent.length >= PHONE_LIMIT.count) return append(newest, 'limit');
              }
              return { kind: 'stored', status: 'new', id: (await deps.store.create(row)).id };
            });
        return { outcome, spike, suspicious, row, repeat };
      };
      // Per IP key first: parallel posts from one address must not all read the same count.
      const { outcome, spike, suspicious, row, repeat } = await serialized(`ip:${ipHash}`, decide);

      if (outcome.kind === 'appended') {
        log.info({
          msg: outcome.reason === 'capped' ? 'form_append_capped' : 'form_appended',
          reason: outcome.reason,
          bookingId: outcome.id,
          kind,
        });
      } else if (outcome.kind === 'dropped') {
        const last = droppedWarnedAt.get(ipHash);
        if (last === undefined || nowMs - last >= IP_LIMIT.windowMs) {
          for (const [key, at] of droppedWarnedAt) {
            if (nowMs - at >= IP_LIMIT.windowMs) droppedWarnedAt.delete(key);
          }
          droppedWarnedAt.set(ipHash, nowMs);
          log.warn({ msg: 'form_dropped', ipHashPrefix: ipHash.slice(0, 8), count: outcome.count });
        }
      } else {
        log.info({
          msg: 'form_stored',
          bookingId: outcome.id,
          kind,
          status: outcome.status,
          flags,
          location: row.formLocation,
        });
      }

      // Persisted above; notify and count after the answer, so its timing does not show how the
      // request was classified (S4). A failure there never loses or rolls back the row.
      deps.defer(async () => {
        if (outcome.kind === 'stored' && outcome.status === 'new') {
          await safely(log, 'notify_failed', () =>
            deps.notify({ type: 'booking', bookingId: outcome.id, kind, requestId: reqId }),
          );
        }
        if (spike) {
          const alert = spike;
          await safely(log, 'notify_failed', () =>
            deps.notify({ type: 'ip_spike', ...alert, requestId: reqId }),
          );
        }
        if (!wantsJson && !suspicious && (form === 'booking' || outcome.kind !== 'appended')) {
          await safely(log, 'event_count_failed', () =>
            deps.countEvent({
              date: zonedDateKey(new Date(nowMs)),
              event: form === 'booking' ? 'booking_success' : 'emergency_submit',
              location: form === 'booking' ? (booking?.formLocation ?? 'page') : 'none',
              pageType: form === 'booking' ? 'booking' : 'emergency',
              serviceKey: booking?.serviceKey ?? 'none',
            }),
          );
        }
      });

      // Only the browser that sent the earlier request learns it was a repeat (S4); anyone else
      // gets the normal success answer.
      if (repeat) {
        return wantsJson
          ? json(200, { ok: true, state: 'neutral', duplicate: true })
          : redirect(formPage, { outcome: 'neutral', ...kept() });
      }
      const callback = reading
        ? hoursState(clock, reading.hours, reading.options).copy.callback
        : null;
      const masked = maskPhone(data.phone);
      return wantsJson
        ? json(200, { ok: true, state: 'success', callback, masked })
        : redirect(successPage, { outcome: 'success', callback: callback ?? undefined, masked });
    } catch (error) {
      log.error({ msg: 'form_error', ...errorFields(error) });
      if (wantsJson) return json(500, { ok: false, error: 'server', requestId: reqId ?? null });
      try {
        return redirect(formPage, { outcome: 'server', ...kept() });
      } catch {
        return empty(500);
      }
    }
  };
}

type Mark = { atMs: number; open: boolean };

/**
 * Whether a request repeats this browser's own earlier ones (S4, review finding 1): the phone
 * rules of the handler replayed over this browser's marks only, as if no one else had sent the
 * number; each mark is open while its row is. Which row the store picked never enters, so the
 * answer cannot show that someone else sent this number.
 */
function ownRepeat(kind: BookingKind, marks: Mark[], nowMs: number): boolean {
  const window = kind === 'emergency' ? EMERGENCY_PHONE_WINDOW_MS : PHONE_LIMIT.windowMs;
  const rows: Mark[] = [];
  const repeats = (atMs: number) => {
    const recent = rows.filter((r) => r.atMs >= atMs - window);
    const newest = recent.filter((r) => r.open).at(-1);
    if (!newest) return false;
    if (kind === 'emergency') return true;
    return newest.atMs >= atMs - DUPLICATE_WINDOW_MS || recent.length >= PHONE_LIMIT.count;
  };
  for (const mark of [...marks].sort((a, b) => a.atMs - b.atMs)) {
    if (!repeats(mark.atMs)) rows.push(mark);
  }
  return repeats(nowMs);
}

/** Runs a side effect after the row is safe; a failure is logged, never thrown. */
async function safely(
  log: Pick<Logger, 'error'>,
  msg: string,
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    log.error({ msg, ...errorFields(error) });
  }
}

/**
 * What a log line may say about an error: its name and the driver's code. A failed query's
 * message, stack and params carry the bound values, a name or a note among them (S3). A class
 * that keeps the name 'Error' (DrizzleQueryError) is named by its constructor; the server bundle
 * is not minified (next.config serverMinification: false).
 */
function errorFields(error: unknown): { errName: string; code?: string | number } {
  const own = error as { name?: unknown; code?: unknown; cause?: { code?: unknown } } | null;
  const code = own?.cause?.code ?? own?.code;
  const name = typeof own?.name === 'string' ? own.name : typeof error;
  return {
    errName: name === 'Error' && error instanceof Error ? error.constructor.name : name,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
  };
}

/** One cookie's value from a Cookie header. */
function cookieValue(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

export function createBookingHandler(deps: BookingHandlerDeps) {
  return createFormHandler<BookingRequest>(
    'booking',
    deps,
    async (input) => parseBookingRequest(input, await deps.catalog()),
    async () => true,
  );
}

export function createEmergencyHandler(deps: EmergencyHandlerDeps) {
  return createFormHandler<EmergencyRequest>(
    'emergency',
    deps,
    async (input) => parseEmergencyRequest(input),
    deps.emergencyEnabled,
  );
}
