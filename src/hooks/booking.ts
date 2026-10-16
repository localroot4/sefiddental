import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  PayloadRequest,
  Where,
} from 'payload';
import { ValidationError } from 'payload';

import { hasRole } from '@/access/roles';
import { toClinicHours, hoursOptionsFrom } from '@/lib/data/clinicHours';
import { hoursState, type ClinicHours, type HoursOptions } from '@/lib/hoursState';
import { normalizeLetters, normalizePersian } from '@/lib/persianText';
import { maskPhone, parseIranPhone, PHONE_ERRORS, phoneSearchFragment } from '@/lib/phone';

/** H-BOOKING and H-PHONESEARCH (spec-data 6.9, 6.10). Never logs a phone, name or note. */

export type BookingStatus =
  'new' | 'contacted' | 'scheduled' | 'done' | 'cancelled' | 'spam' | 'suspicious';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  new: 'جدید',
  contacted: 'تماس گرفته شد',
  scheduled: 'نوبت داده شد',
  done: 'انجام شد',
  cancelled: 'لغو شد',
  spam: 'هرزنامه',
  suspicious: 'مشکوک',
};

/** Editors' allowed moves; admins may set any status. */
export const STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  new: ['contacted', 'scheduled', 'cancelled', 'spam'],
  contacted: ['scheduled', 'done', 'cancelled', 'spam'],
  scheduled: ['done', 'cancelled'],
  suspicious: ['new', 'spam'],
  spam: ['new'],
  done: [],
  cancelled: [],
};

export function transitionRule(from: BookingStatus, to: BookingStatus): true | string {
  if (from === to || STATUS_TRANSITIONS[from].includes(to)) return true;
  return `تغییر وضعیت از «${BOOKING_STATUS_LABELS[from]}» به «${BOOKING_STATUS_LABELS[to]}» مجاز نیست.`;
}

/** Sort key: emergencies first, then by follow-up state (spec-data 6.9). */
export function urgencyRank(input: {
  kind: string | null | undefined;
  status: BookingStatus;
  priorityRemoved: boolean;
  /** The row carries `emergency_ip_rate`: its address sent 3 emergencies in the last 24 h. */
  ipRateFlagged?: boolean;
}): number {
  const { kind, status, priorityRemoved } = input;
  // S6: a flagged emergency ranks right after every clean one, still above regular requests.
  if (kind === 'emergency' && (status === 'new' || status === 'contacted') && !priorityRemoved)
    return input.ipRateFlagged ? 0.5 : 0;
  const ranks: Record<BookingStatus, number> = {
    new: 1,
    contacted: 2,
    scheduled: 3,
    suspicious: 4,
    done: 9,
    cancelled: 9,
    spam: 9,
  };
  return ranks[status];
}

export const PRIORITY_REMOVED = 'emergency_priority_removed';

type Row = Record<string, unknown>;

const fail = (path: string, message: string): never => {
  throw new ValidationError({ collection: 'bookings', errors: [{ path, message }] });
};

/** Phone to E.164 and the national form; landlines rejected; the name normalized. */
export const normalizeBooking: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) return data;
  const out = { ...data };
  if (typeof out.phone === 'string') {
    const parsed = parseIranPhone(out.phone, { accept: 'mobile' });
    if (!parsed.ok) fail('phone', PHONE_ERRORS[parsed.reason]);
    else {
      out.phone = parsed.e164;
      out.phoneNational = parsed.national;
    }
  }
  if (typeof out.name === 'string') out.name = normalizePersian(out.name) || null;
  return out;
};

/** When reception should call back: now plus the callback minutes, or after the next opening. */
export function callbackDueAt(now: Date, hours: ClinicHours, options: HoursOptions): string | null {
  const state = hoursState(now, hours, options);
  const minutes = (options.callbackMinutes ?? 10) * 60_000;
  const base = state.callsAllowed
    ? now.getTime()
    : state.nextOpen
      ? Date.parse(state.nextOpen.at)
      : NaN;
  return Number.isFinite(base) ? new Date(base + minutes).toISOString() : null;
}

async function callbackDue(req: PayloadRequest, now: Date): Promise<string | null> {
  try {
    const clinic = await req.payload.findGlobal({ slug: 'clinic', depth: 0, req });
    return callbackDueAt(now, toClinicHours(clinic), hoursOptionsFrom(clinic));
  } catch {
    return null;
  }
}

export const bookingRules: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const out: Row = { ...data };
  const before = (originalDoc ?? {}) as Row;
  const editor = hasRole(req.user, 'editor') && !hasRole(req.user, 'admin');
  const now = new Date();

  const status = (out.status ?? before.status ?? 'new') as BookingStatus;
  const prevStatus = (before.status ?? 'new') as BookingStatus;
  let flags = (Array.isArray(out.flags) ? out.flags : (before.flags ?? [])) as string[];

  if (operation === 'update' && editor) {
    const rule = transitionRule(prevStatus, status);
    if (rule !== true) fail('status', rule);
    const without = (list: unknown) =>
      ((list ?? []) as string[])
        .filter((f) => f !== PRIORITY_REMOVED)
        .sort()
        .join(',');
    if (without(flags) !== without(before.flags)) {
      fail('flags', 'فقط علامت «اولویت فوری برداشته شد» را می‌توانید تغییر دهید.');
    }
  }
  if (
    operation === 'update' &&
    (prevStatus === 'suspicious' || prevStatus === 'spam') &&
    status === 'new'
  ) {
    flags = [...new Set([...flags, 'restored'])];
  }
  out.flags = flags;

  // Who first acted on a booking is set only here, never from the request (SF-5).
  out.handledBy = before.handledBy ?? null;
  out.handledAt = before.handledAt ?? null;
  if (
    operation === 'update' &&
    prevStatus === 'new' &&
    status !== 'new' &&
    !before.handledBy &&
    req.user
  ) {
    out.handledBy = req.user.id;
    out.handledAt = now.toISOString();
  }

  // Notes: new rows get author and time; editors cannot change or remove earlier rows.
  if (Array.isArray(out.adminNotes)) {
    const earlier = new Map(((before.adminNotes ?? []) as Row[]).map((row) => [row.id, row]));
    if (editor) {
      const kept = new Set((out.adminNotes as Row[]).map((row) => row.id));
      for (const [id, row] of earlier) {
        const next = (out.adminNotes as Row[]).find((r) => r.id === id);
        if (!kept.has(id) || next?.text !== row.text) {
          fail('adminNotes', 'یادداشت‌های قبلی ویرایش نمی‌شوند؛ یادداشت تازه اضافه کنید.');
        }
      }
    }
    out.adminNotes = (out.adminNotes as Row[]).map((row) => {
      const old = row.id === undefined ? undefined : earlier.get(row.id);
      if (old) return { ...row, author: old.author, at: old.at };
      return { ...row, author: req.user?.id ?? null, at: now.toISOString() };
    });
  }

  const phone = (out.phone ?? before.phone) as string | undefined;
  const name = (out.name ?? before.name) as string | null | undefined;
  if (phone) {
    let masked = '';
    try {
      masked = maskPhone(phone);
    } catch {
      masked = '';
    }
    out.listTitle = `${name || 'بدون نام'} · ${masked}`;
  }

  let priorityRemoved = flags.includes(PRIORITY_REMOVED);
  if (!priorityRemoved && phone && (out.kind ?? before.kind) === 'emergency') {
    const { totalDocs } = await req.payload.count({
      collection: 'bookings',
      where: { and: [{ phone: { equals: phone } }, { flags: { in: [PRIORITY_REMOVED] } }] },
      req,
    });
    priorityRemoved = totalDocs > 0;
  }
  out.urgencyRank = urgencyRank({
    kind: (out.kind ?? before.kind) as string,
    status,
    priorityRemoved,
    ipRateFlagged: flags.includes('emergency_ip_rate'),
  });

  if (operation === 'create' && !out.callbackDueAt) out.callbackDueAt = await callbackDue(req, now);
  return out;
};

/**
 * Admin list search: Persian or Arabic digits, spaces, '+98', '0098', a missing leading 0. A
 * `like` or `contains` condition on the phone becomes `phoneNational contains <digits>`; exact
 * matches (`equals`, used by code) are left alone. Names get Persian ی and ک.
 */
export function rewritePhoneSearch(where: Where): Where {
  const out: Where = {};
  for (const [key, condition] of Object.entries(where)) {
    if ((key === 'and' || key === 'or') && Array.isArray(condition)) {
      out[key] = (condition as Where[]).map(rewritePhoneSearch);
      continue;
    }
    if (typeof condition !== 'object' || condition === null) {
      out[key] = condition;
      continue;
    }
    const ops = condition as Record<string, unknown>;
    if (key === 'phone' || key === 'phoneNational') {
      const query = ops.like ?? ops.contains;
      const fragment = typeof query === 'string' ? phoneSearchFragment(query) : null;
      if (fragment) {
        out.phoneNational = { contains: fragment };
        continue;
      }
    }
    if (key === 'name') {
      out[key] = Object.fromEntries(
        Object.entries(ops).map(([op, v]) => [op, typeof v === 'string' ? normalizeLetters(v) : v]),
      );
      continue;
    }
    out[key] = condition;
  }
  return out;
}

export const phoneSearch: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation !== 'read') return args;
  const withWhere = args as { where?: Where };
  if (withWhere.where) withWhere.where = rewritePhoneSearch(withWhere.where);
  return args;
};
