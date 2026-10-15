import { z } from 'zod';

import {
  addDaysToKey,
  dayLabel,
  parseDateKey,
  weekdayOfKey,
  zonedDateKey,
  zonedParts,
  zonedWallTimeToInstant,
  type DateKey,
} from './jalali';
import { toPersianDigits } from './persianText';

/**
 * Clinic opening state at a given instant, evaluated in Asia/Tehran at request time, with the
 * callback copy for each state (conversion.md). Pure: the caller passes `now`.
 */

export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

/** 'HH:MM', close > open, same day. */
export interface WeeklyRule {
  days: Weekday[];
  open: string;
  close: string;
}

/** No open/close = closed all day (state 'holiday'); open and close = special hours that day. */
export interface HoursOverride {
  date: DateKey;
  labelFa?: string;
  open?: string;
  close?: string;
}

export interface ClinicHours {
  timezone: 'Asia/Tehran';
  weekly: WeeklyRule[];
  holidays: HoursOverride[];
  noteFa: string;
}

export interface HoursOptions {
  closingSoonMinutes?: number;
  callbackMinutes?: number;
  horizonDays?: number;
}

export type HoursStateName = 'before-open' | 'open' | 'closing-soon' | 'closed' | 'holiday';

export interface HoursState {
  state: HoursStateName;
  callsAllowed: boolean;
  showClosedSheet: boolean;
  /** ISO UTC instant when the state or the copy changes next. */
  nextChangeAt: string;
  nextOpen: { at: string; dayLabel: string; timeLabel: string } | null;
  copy: { callback: string; closedSheet: string | null; emergencyClosedLine: string | null };
}

const DEFAULTS = { closingSoonMinutes: 30, callbackMinutes: 10, horizonDays: 30 } as const;

// Index = Date.getUTCDay() / ZonedParts.weekday (0 = Sunday).
const WEEKDAY_BY_INDEX: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const ALL_WEEKDAYS = [
  'sat',
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
] as const satisfies readonly Weekday[];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Copy, conversion.md 5.x (exact). ZWNJ written as an escape.
const COPY = {
  open: (n: string) => `پذیرش معمولاً تا ${n} دقیقهٔ دیگر با شما تماس می\u200Cگیرد.`,
  beforeOpen: (time: string) => `پذیرش امروز از ساعت ${time} با شما تماس می\u200Cگیرد.`,
  later: (day: string, time: string) => `پذیرش ${day} از ساعت ${time} با شما تماس می\u200Cگیرد.`,
  holidayPrefix: 'امروز تعطیل رسمی است. ',
  noWorkingDay: 'پذیرش در اولین روز کاری با شما تماس می\u200Cگیرد.',
  closedSheet: (summary: string | null) =>
    summary ? `کلینیک الان بسته است. ساعات کاری: ${summary}` : 'کلینیک الان بسته است.',
  emergencyToday: (time: string) =>
    `پذیرش امروز از ساعت ${time}، پیش از بقیهٔ درخواست\u200Cها، با شما تماس می\u200Cگیرد.`,
  emergencyLater: (day: string, time: string) =>
    `پذیرش ${day} از ساعت ${time}، پیش از بقیهٔ درخواست\u200Cها، با شما تماس می\u200Cگیرد.`,
  summaryEveryDay: (open: string, close: string) =>
    `هر روز ${open} تا ${close}، به\u200Cجز تعطیلات رسمی.`,
  holidayCaveat: 'به\u200Cجز تعطیلات رسمی.',
} as const;

const minutesOf = (hhmm: string): number => {
  const match = HHMM.exec(hhmm);
  if (!match) throw new RangeError('hoursState: expected HH:MM');
  return Number(match[1]) * 60 + Number(match[2]);
};

/** «۱۰» on the hour, else «۱۰:۳۰» (decision D-H2). */
function timeLabel(hhmm: string): string {
  const minutes = minutesOf(hhmm);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return toPersianDigits(m === 0 ? String(h) : `${h}:${String(m).padStart(2, '0')}`);
}

type DayHours =
  { kind: 'holiday' } | { kind: 'closed' } | { kind: 'open'; open: string; close: string };

/** An override for the day wins over the weekly rule; no rule means a non-working day (R-H2). */
function hoursOn(key: DateKey, hours: ClinicHours): DayHours {
  const override = hours.holidays.find((h) => h.date === key);
  if (override) {
    return override.open && override.close
      ? { kind: 'open', open: override.open, close: override.close }
      : { kind: 'holiday' };
  }
  const weekday = WEEKDAY_BY_INDEX[weekdayOfKey(key)];
  const rule = hours.weekly.find((r) => weekday !== undefined && r.days.includes(weekday));
  return rule ? { kind: 'open', open: rule.open, close: rule.close } : { kind: 'closed' };
}

function nonNegativeInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`hoursState: ${name} must be a non-negative integer`);
  }
  return value;
}

export function hoursState(now: Date, hours: ClinicHours, options: HoursOptions = {}): HoursState {
  const closingSoon = nonNegativeInteger(
    options.closingSoonMinutes,
    DEFAULTS.closingSoonMinutes,
    'closingSoonMinutes',
  );
  const callback = nonNegativeInteger(
    options.callbackMinutes,
    DEFAULTS.callbackMinutes,
    'callbackMinutes',
  );
  const horizon = nonNegativeInteger(options.horizonDays, DEFAULTS.horizonDays, 'horizonDays');
  const tz = hours.timezone;

  const today = zonedDateKey(now, tz);
  const p = zonedParts(now, tz);
  const t = p.hour * 60 + p.minute + p.second / 60;
  const day = hoursOn(today, hours);
  const at = (key: DateKey, hhmm: string) => zonedWallTimeToInstant(key, hhmm, tz);
  const nextMidnight = at(addDaysToKey(today, 1), '00:00').toISOString();

  let state: HoursStateName;
  let nextChangeAt: string;
  if (day.kind === 'holiday') {
    state = 'holiday';
    nextChangeAt = nextMidnight;
  } else if (day.kind === 'closed') {
    state = 'closed';
    nextChangeAt = nextMidnight;
  } else {
    const open = minutesOf(day.open);
    const close = minutesOf(day.close);
    const closeAt = at(today, day.close).getTime();
    if (t < open) {
      state = 'before-open';
      nextChangeAt = at(today, day.open).toISOString();
    } else if (t >= close) {
      state = 'closed';
      nextChangeAt = nextMidnight;
    } else if (t >= close - closingSoon) {
      state = 'closing-soon';
      nextChangeAt = new Date(closeAt).toISOString();
    } else {
      state = 'open';
      nextChangeAt = new Date(closeAt - closingSoon * 60_000).toISOString();
    }
  }

  // Next working time (R-H4): today for before-open, none while open, else the next working day.
  let nextOpen: HoursState['nextOpen'] = null;
  if (state === 'before-open' && day.kind === 'open') {
    nextOpen = {
      at: at(today, day.open).toISOString(),
      dayLabel: dayLabel(today, now),
      timeLabel: timeLabel(day.open),
    };
  } else if (state !== 'open') {
    for (let k = 1; k <= horizon; k += 1) {
      const key = addDaysToKey(today, k);
      const next = hoursOn(key, hours);
      if (next.kind === 'open') {
        nextOpen = {
          at: at(key, next.open).toISOString(),
          dayLabel: dayLabel(key, now),
          timeLabel: timeLabel(next.open),
        };
        break;
      }
    }
  }

  const callsAllowed = state === 'open' || state === 'closing-soon';
  // An empty note (the Clinic global's default) never leaves a bare "ساعات کاری:".
  const closedSheet = callsAllowed ? null : COPY.closedSheet(hoursNote(hours));

  let callbackLine: string;
  let emergencyClosedLine: string | null = null;
  if (state === 'open') {
    callbackLine = COPY.open(toPersianDigits(String(callback)));
  } else if (state === 'before-open' && nextOpen) {
    callbackLine = COPY.beforeOpen(nextOpen.timeLabel);
    emergencyClosedLine = COPY.emergencyToday(nextOpen.timeLabel);
  } else if (nextOpen) {
    callbackLine = COPY.later(nextOpen.dayLabel, nextOpen.timeLabel);
    if (!callsAllowed)
      emergencyClosedLine = COPY.emergencyLater(nextOpen.dayLabel, nextOpen.timeLabel);
  } else {
    // No working day within the horizon (bad settings, R-H9): the status view reports it.
    callbackLine = COPY.noWorkingDay;
  }
  if (state === 'holiday') callbackLine = COPY.holidayPrefix + callbackLine;

  return {
    state,
    callsAllowed,
    showClosedSheet: !callsAllowed,
    nextChangeAt,
    nextOpen,
    copy: { callback: callbackLine, closedSheet, emergencyClosedLine },
  };
}

/** The conversion.md every-day sentence for one rule covering the whole week, else null. */
export function hoursSummary(hours: ClinicHours): string | null {
  const [rule, ...rest] = hours.weekly;
  if (!rule || rest.length > 0) return null;
  if (!ALL_WEEKDAYS.every((d) => rule.days.includes(d))) return null;
  return COPY.summaryEveryDay(timeLabel(rule.open), timeLabel(rule.close));
}

/** The one-line hours fact: the every-day sentence (F14), else the clinic's own note. */
export function hoursNote(hours: ClinicHours): string | null {
  return hoursSummary(hours) ?? (hours.noteFa.trim() || null);
}

/** The line under an hours table, whose rows already say the days and times: the holiday caveat
 * of the every-day sentence, else the clinic's own note. */
export function hoursTableNote(hours: ClinicHours): string | null {
  return hoursSummary(hours) ? COPY.holidayCaveat : hours.noteFa.trim() || null;
}

// Admin-facing validation messages for the clinic global.
const MESSAGES = {
  time: 'ساعت را به شکل ۱۰:۰۰ وارد کنید.',
  order: 'ساعت پایان باید بعد از ساعت شروع باشد.',
  pair: 'ساعت شروع و پایان را با هم وارد کنید یا هر دو را خالی بگذارید.',
  date: 'تاریخ معتبر نیست.',
  weekday: 'هر روز هفته فقط در یک ردیف بیاید.',
  holiday: 'این تاریخ دو بار وارد شده است.',
} as const;

const hhmmSchema = z.string().regex(HHMM, MESSAGES.time);

// The order check runs only on two well-formed times; a malformed one already has its issue.
const ordered = (open: string | undefined, close: string | undefined): boolean =>
  open === undefined ||
  close === undefined ||
  !HHMM.test(open) ||
  !HHMM.test(close) ||
  close > open;

const dateKeySchema = z
  .string()
  .refine((v) => {
    try {
      parseDateKey(v);
      return true;
    } catch {
      return false;
    }
  }, MESSAGES.date)
  .transform((v) => v as DateKey);

const weeklyRuleSchema = z
  .object({
    days: z.array(z.enum(ALL_WEEKDAYS)).min(1),
    open: hhmmSchema,
    close: hhmmSchema,
  })
  .refine((r) => ordered(r.open, r.close), { message: MESSAGES.order, path: ['close'] });

const overrideSchema = z
  .object({
    date: dateKeySchema,
    labelFa: z.string().optional(),
    open: hhmmSchema.optional(),
    close: hhmmSchema.optional(),
  })
  .refine((o) => (o.open === undefined) === (o.close === undefined), {
    message: MESSAGES.pair,
    path: ['close'],
  })
  .refine((o) => ordered(o.open, o.close), {
    message: MESSAGES.order,
    path: ['close'],
  });

/** The `hours` value of the clinic global (5.1 rules). */
export const clinicHoursSchema: z.ZodType<ClinicHours> = z
  .object({
    timezone: z.literal('Asia/Tehran'),
    weekly: z.array(weeklyRuleSchema),
    holidays: z.array(overrideSchema),
    noteFa: z.string(),
  })
  .superRefine((value, ctx) => {
    const seenDays = new Set<Weekday>();
    value.weekly.forEach((rule, index) => {
      for (const d of rule.days) {
        if (seenDays.has(d)) {
          ctx.addIssue({
            code: 'custom',
            message: MESSAGES.weekday,
            path: ['weekly', index, 'days'],
          });
          return;
        }
        seenDays.add(d);
      }
    });
    const seenDates = new Set<string>();
    value.holidays.forEach((h, index) => {
      if (seenDates.has(h.date)) {
        ctx.addIssue({
          code: 'custom',
          message: MESSAGES.holiday,
          path: ['holidays', index, 'date'],
        });
      }
      seenDates.add(h.date);
    });
  });

/** QA-CLOCK (freeze G18): request header that moves the hours clock, never tokens or limits. */
export const QA_CLOCK_HEADER = 'x-qa-hours-at';
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * The instant every hours reader evaluates `hoursState` at: the QA clock header (an ISO instant)
 * when QA routes are on (QA_ROUTES=1, never production), else `nowMs`.
 */
export function hoursClock(headers: Headers, qaRoutes: boolean, nowMs: number): Date {
  const value = qaRoutes ? headers.get(QA_CLOCK_HEADER) : null;
  const at = value !== null && ISO_INSTANT.test(value) ? Date.parse(value) : NaN;
  return new Date(Number.isFinite(at) ? at : nowMs);
}
