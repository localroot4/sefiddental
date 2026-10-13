import { format, getDate, getMonth, getYear, newDate } from 'date-fns-jalali';

import { toLatinDigits, toPersianDigits } from './persianText';

/**
 * Time-zone and Jalali display helpers. Every calendar decision is made in Asia/Tehran through
 * Intl (tzdata), never in the host zone and never with a hard-coded offset. Persian month and
 * weekday names come only from date-fns-jalali: Intl 'fa-IR' spells some weekdays without ZWNJ,
 * and two spellings would differ between server and browser.
 */

export const CLINIC_TZ = 'Asia/Tehran';

/** Gregorian calendar date in CLINIC_TZ, 'YYYY-MM-DD'. */
export type DateKey = `${number}-${number}-${number}`;

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday */
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Date tokens only: the floating date used for formatting carries no meaningful time. */
export type JalaliPattern =
  'd MMMM' | 'EEEE d MMMM' | 'd MMMM yyyy' | 'EEEE d MMMM yyyy' | 'yyyy/MM/dd';

const WEEKDAYS: Record<string, ZonedParts['weekday']> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MS_PER_DAY = 86_400_000;

const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // en-US keeps the parts ASCII and stable across ICU versions.
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
      weekday: 'short',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function assertValidDate(instant: Date, caller: string): void {
  if (!(instant instanceof Date) || Number.isNaN(instant.getTime())) {
    throw new RangeError(`${caller}: Invalid Date`);
  }
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(instant: Date, timeZone: string = CLINIC_TZ): ZonedParts {
  assertValidDate(instant, 'zonedParts');
  const out: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) out[part.type] = part.value;
  const weekday = WEEKDAYS[out.weekday ?? ''];
  if (weekday === undefined) throw new RangeError('zonedParts: unexpected weekday from Intl');
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday,
  };
}

const pad = (value: number, width: number): string => String(value).padStart(width, '0');

function toKey(year: number, month: number, day: number): DateKey {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as DateKey;
}

/** Year, month and day of a DateKey; throws on a malformed or impossible date. */
export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const match = DATE_KEY.exec(key);
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCMonth() === month - 1 && check.getUTCDate() === day) {
      return { year, month, day };
    }
  }
  throw new RangeError('parseDateKey: expected a valid YYYY-MM-DD date');
}

export function zonedDateKey(instant: Date, timeZone: string = CLINIC_TZ): DateKey {
  const p = zonedParts(instant, timeZone);
  return toKey(p.year, p.month, p.day);
}

export function addDaysToKey(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key);
  if (!Number.isInteger(days)) throw new RangeError('addDaysToKey: days must be an integer');
  const d = new Date(Date.UTC(year, month - 1, day) + days * MS_PER_DAY);
  return toKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Weekday of a DateKey (0 = Sunday); the calendar date alone decides it. */
export function weekdayOfKey(key: DateKey): ZonedParts['weekday'] {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() as ZonedParts['weekday'];
}

/** The instant at which the wall clock in `timeZone` shows `hhmm` on `key`. */
export function zonedWallTimeToInstant(
  key: DateKey,
  hhmm: string,
  timeZone: string = CLINIC_TZ,
): Date {
  const { year, month, day } = parseDateKey(key);
  const time = HHMM.exec(hhmm);
  if (!time) throw new RangeError('zonedWallTimeToInstant: expected HH:MM');
  const wall = Date.UTC(year, month - 1, day, Number(time[1]), Number(time[2]));
  let guess = wall;
  // The offset read back at the guess corrects it; a second pass settles offset changes.
  for (let pass = 0; pass < 3; pass += 1) {
    const p = zonedParts(new Date(guess), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    if (shown === wall) break;
    guess += wall - shown;
  }
  return new Date(guess);
}

/** Local noon of a Gregorian date: date-fns-jalali reads local getters; noon avoids DST gaps. */
const floating = (year: number, month: number, day: number): Date =>
  new Date(year, month - 1, day, 12);

/** Jalali date of the Tehran calendar day of `instant`, Persian digits. */
export function formatJalali(instant: Date, pattern: JalaliPattern): string {
  const p = zonedParts(instant, CLINIC_TZ);
  return toPersianDigits(format(floating(p.year, p.month, p.day), pattern));
}

export function formatJalaliKey(key: DateKey, pattern: JalaliPattern): string {
  const { year, month, day } = parseDateKey(key);
  return toPersianDigits(format(floating(year, month, day), pattern));
}

/** 'HH:mm' in Tehran with Persian digits. */
export function formatTimeFa(instant: Date): string {
  const p = zonedParts(instant, CLINIC_TZ);
  return toPersianDigits(`${pad(p.hour, 2)}:${pad(p.minute, 2)}`);
}

/** «امروز», «فردا», or the weekday and Jalali date of `target` as seen in Tehran at `now`. */
export function dayLabel(target: DateKey, now: Date): string {
  const today = zonedDateKey(now, CLINIC_TZ);
  if (target === today) return 'امروز';
  if (target === addDaysToKey(today, 1)) return 'فردا';
  return formatJalaliKey(target, 'EEEE d MMMM');
}

/**
 * A Jalali 'YYYY/MM/DD' (any digits) to the Gregorian DateKey; null when the date does not
 * exist (no roll-over from 30 Esfand of a common year into Farvardin).
 */
export function jalaliToDateKey(input: string): DateKey | null {
  if (typeof input !== 'string') return null;
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(toLatinDigits(input.trim()));
  if (!match) return null;
  const [jy, jm, jd] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const date = newDate(jy, jm - 1, jd, 12);
  if (getYear(date) !== jy || getMonth(date) !== jm - 1 || getDate(date) !== jd) return null;
  return toKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}
