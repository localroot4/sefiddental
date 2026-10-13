import { afterEach, describe, expect, it } from 'vitest';

import {
  addDaysToKey,
  dayLabel,
  formatJalali,
  formatJalaliKey,
  formatTimeFa,
  jalaliToDateKey,
  parseDateKey,
  weekdayOfKey,
  zonedDateKey,
  zonedParts,
  zonedWallTimeToInstant,
} from './jalali';

const at = (iso: string) => new Date(iso);

// Table J of the utilities spec, rows J1-J23 (J19 is a throw, tested below).
const TABLE: Array<[id: string, actual: () => unknown, expected: unknown]> = [
  [
    'J1 weekday and date',
    () => formatJalali(at('2026-10-13T06:30:00Z'), 'EEEE d MMMM'),
    'سه\u200Cشنبه ۲۱ مهر',
  ],
  [
    'J2 Jalali with Persian digits',
    () => formatJalali(at('2026-10-13T06:30:00Z'), 'd MMMM yyyy'),
    '۲۱ مهر ۱۴۰۵',
  ],
  ['J3 numeric form', () => formatJalali(at('2026-10-13T06:30:00Z'), 'yyyy/MM/dd'), '۱۴۰۵/۰۷/۲۱'],
  [
    'J4 Tehran date, not UTC date',
    () => formatJalali(at('2026-10-13T20:45:00Z'), 'EEEE d MMMM'),
    'چهارشنبه ۲۲ مهر',
  ],
  [
    'J5 23:59:59 Tuesday in Tehran',
    () => formatJalali(at('2026-10-13T20:29:59Z'), 'EEEE d MMMM'),
    'سه\u200Cشنبه ۲۱ مهر',
  ],
  [
    'J6 Nowruz 1405 starts at Tehran midnight',
    () => formatJalali(at('2026-03-20T20:30:00Z'), 'EEEE d MMMM yyyy'),
    'شنبه ۱ فروردین ۱۴۰۵',
  ],
  [
    'J7 last day of 1405',
    () => formatJalali(at('2027-03-20T12:00:00Z'), 'EEEE d MMMM yyyy'),
    'شنبه ۲۹ اسفند ۱۴۰۵',
  ],
  [
    'J8 doc example is real in 1404',
    () => formatJalali(at('2025-10-04T08:00:00Z'), 'EEEE d MMMM'),
    'شنبه ۱۲ مهر',
  ],
  [
    'J9 the same day in 1405 is Sunday, spelled with ZWNJ',
    () => formatJalali(at('2026-10-04T08:00:00Z'), 'EEEE d MMMM'),
    'یک\u200Cشنبه ۱۲ مهر',
  ],
  [
    'J10 first working day after Nowruz',
    () => formatJalali(at('2027-03-25T08:00:00Z'), 'EEEE d MMMM'),
    'پنج\u200Cشنبه ۵ فروردین',
  ],
  ['J11 time in Tehran', () => formatTimeFa(at('2026-10-13T16:00:00Z')), '۱۹:۳۰'],
  [
    'J12 holiday key is the Tehran date',
    () => zonedDateKey(at('2026-10-13T20:45:00Z')),
    '2026-10-14',
  ],
  [
    'J13 store UTC',
    () => zonedWallTimeToInstant('2026-10-14', '10:00').toISOString(),
    '2026-10-14T06:30:00.000Z',
  ],
  ['J14 historical DST from tzdata', () => zonedParts(at('2022-06-01T05:30:00Z')).hour, 10],
  [
    'J15 historical DST, inverse',
    () => zonedWallTimeToInstant('2022-06-01', '10:00').toISOString(),
    '2022-06-01T05:30:00.000Z',
  ],
  ['J16 tomorrow', () => dayLabel('2026-10-14', at('2026-10-13T16:30:00Z')), 'فردا'],
  ['J17 today', () => dayLabel('2026-10-14', at('2026-10-13T20:45:00Z')), 'امروز'],
  [
    'J18 weekday and date otherwise',
    () => dayLabel('2026-10-15', at('2026-10-13T16:30:00Z')),
    'پنج\u200Cشنبه ۲۳ مهر',
  ],
  ['J20 admin enters holidays in Jalali', () => jalaliToDateKey('۱۴۰۵/۰۷/۲۱'), '2026-10-13'],
  ['J21 year boundary', () => jalaliToDateKey('1406/01/01'), '2027-03-21'],
  ['J22 1405 has no 30 Esfand', () => jalaliToDateKey('1405/12/30'), null],
  ['J23 1403 is a leap year', () => jalaliToDateKey('1403/12/30'), '2025-03-20'],
];

describe('jalali table J', () => {
  it.each(TABLE)('%s', (_id, actual, expected) => {
    expect(actual()).toEqual(expected);
  });

  it('J19 fail loud on invalid input', () => {
    expect(() => formatJalali(new Date('x'), 'd MMMM')).toThrow(RangeError);
    expect(() => zonedParts(new Date(Number.NaN))).toThrow(RangeError);
  });
});

// J24: the host time zone never leaks. `npm run test:tz` runs this file under three TZ values;
// this test also switches TZ inside the process (Node applies a runtime change of
// process.env.TZ), so a plain `vitest run` catches a leak too.
const ZONES = ['UTC', 'Asia/Tehran', 'America/Los_Angeles', 'Pacific/Kiritimati'];
const ORIGINAL_TZ = process.env.TZ;

function switchesTz(): boolean {
  const offsets = new Set<number>();
  for (const zone of ['UTC', 'Pacific/Kiritimati']) {
    process.env.TZ = zone;
    offsets.add(new Date(2026, 0, 1).getTimezoneOffset());
  }
  restoreTz();
  return offsets.size === 2;
}

function restoreTz(): void {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
}

describe('jalali time-zone independence', () => {
  afterEach(restoreTz);

  it.skipIf(!switchesTz())('J24 rows J1-J23 give identical results under every host zone', () => {
    const baseline = TABLE.map(([, actual]) => actual());
    for (const zone of ZONES) {
      process.env.TZ = zone;
      expect(
        TABLE.map(([, actual]) => actual()),
        zone,
      ).toEqual(baseline);
    }
  });
});

describe('jalali helpers', () => {
  it('J-KEY addDaysToKey crosses months, years and leap days', () => {
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('J-KEY-INVALID malformed or impossible keys throw', () => {
    expect(() => parseDateKey('2026-02-30')).toThrow(RangeError);
    expect(() => parseDateKey('2026-2-3')).toThrow(RangeError);
    expect(() => addDaysToKey('2026-10-13', 1.5)).toThrow(RangeError);
    expect(() => zonedWallTimeToInstant('2026-10-13', '24:00')).toThrow(RangeError);
  });

  it('J-WEEKDAY weekdayOfKey reads the calendar date', () => {
    expect(weekdayOfKey('2026-10-13')).toBe(2);
    expect(weekdayOfKey('2026-10-16')).toBe(5);
    expect(zonedParts(at('2026-10-13T20:45:00Z')).weekday).toBe(3);
  });

  it('J-MIDNIGHT zonedParts reports hour 0 at Tehran midnight', () => {
    expect(zonedParts(at('2026-10-13T20:30:00Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 14,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 3,
    });
  });

  it('J-KEYFORMAT formatJalaliKey formats a calendar date', () => {
    expect(formatJalaliKey('2027-03-25', 'EEEE d MMMM yyyy')).toBe('پنج\u200Cشنبه ۵ فروردین ۱۴۰۶');
  });

  it('J-PARSE jalaliToDateKey rejects malformed input', () => {
    for (const bad of ['', '1405-07-21', '1405/13/01', '1405/00/10', '1405/07/32', '۱۴۰۵/۷']) {
      expect(jalaliToDateKey(bad)).toBeNull();
    }
    expect(jalaliToDateKey(' 1405/7/21 ')).toBe('2026-10-13');
  });
});
