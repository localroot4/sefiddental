import { afterEach, describe, expect, it } from 'vitest';

import {
  clinicHoursSchema,
  hoursClock,
  hoursNote,
  hoursState,
  hoursTableNote,
  hoursSummary,
  QA_CLOCK_HEADER,
  type ClinicHours,
  type HoursOptions,
  type HoursOverride,
} from './hoursState';
import { maskPhone, REGISTERED_NUMBER_LABEL } from './phone';

// Fixtures of the utilities spec (test data, not the production holiday list).
const NOTE = 'همه\u200Cروزه به\u200Cجز روزهای تعطیل رسمی';
const CLINIC: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  holidays: [],
  noteFa: NOTE,
};
const closedDay = (date: HoursOverride['date']): HoursOverride => ({ date, labelFa: 'تعطیل' });
const NOWRUZ: ClinicHours = {
  ...CLINIC,
  holidays: ['2027-03-20', '2027-03-21', '2027-03-22', '2027-03-23', '2027-03-24'].map((d) =>
    closedDay(d as HoursOverride['date']),
  ),
};
const HALF_DAY: ClinicHours = {
  ...CLINIC,
  holidays: [{ date: '2026-10-13', labelFa: 'نیمه\u200Cوقت', open: '10:00', close: '14:00' }],
};
const SPLIT: ClinicHours = {
  ...CLINIC,
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed'], open: '10:30', close: '20:00' },
    { days: ['thu'], open: '10:00', close: '14:00' },
  ],
};
const NO_HOURS: ClinicHours = { ...CLINIC, weekly: [] };

const CALL_SOON = (n: string) => `پذیرش معمولاً تا ${n} دقیقهٔ دیگر با شما تماس می\u200Cگیرد.`;
const TODAY_AT = (t: string) => `پذیرش امروز از ساعت ${t} با شما تماس می\u200Cگیرد.`;
const LATER = (day: string, t: string) => `پذیرش ${day} از ساعت ${t} با شما تماس می\u200Cگیرد.`;
const HOLIDAY = 'امروز تعطیل رسمی است. ';
const THU_5_FARVARDIN = 'پنج\u200Cشنبه ۵ فروردین';

// Table H of the utilities spec: state and copy.callback (rows H1-H21).
const TABLE: Array<
  [
    id: string,
    now: string,
    hours: ClinicHours,
    options: HoursOptions,
    state: string,
    callback: string,
  ]
> = [
  ['H1 before-open', '2026-10-13T05:00:00Z', CLINIC, {}, 'before-open', TODAY_AT('۱۰')],
  [
    'H2 before-open boundary 09:59:59',
    '2026-10-13T06:29:59Z',
    CLINIC,
    {},
    'before-open',
    TODAY_AT('۱۰'),
  ],
  [
    'H3 open starts at 10:00 inclusive',
    '2026-10-13T06:30:00Z',
    CLINIC,
    {},
    'open',
    CALL_SOON('۱۰'),
  ],
  [
    'H4 callbackMinutes is a setting',
    '2026-10-13T12:00:00Z',
    CLINIC,
    { callbackMinutes: 5 },
    'open',
    CALL_SOON('۵'),
  ],
  ['H5 open boundary 19:29:59', '2026-10-13T15:59:59Z', CLINIC, {}, 'open', CALL_SOON('۱۰')],
  ['H6 closing-soon', '2026-10-13T16:00:00Z', CLINIC, {}, 'closing-soon', LATER('فردا', '۱۰')],
  [
    'H7 closing-soon boundary 19:59:59',
    '2026-10-13T16:29:59Z',
    CLINIC,
    {},
    'closing-soon',
    LATER('فردا', '۱۰'),
  ],
  ['H8 closed', '2026-10-13T16:30:00Z', CLINIC, {}, 'closed', LATER('فردا', '۱۰')],
  [
    'H9 closed 23:59:59, still Tuesday in Tehran',
    '2026-10-13T20:29:59Z',
    CLINIC,
    {},
    'closed',
    LATER('فردا', '۱۰'),
  ],
  [
    'H10 Tehran midnight while UTC is Tuesday',
    '2026-10-13T20:30:00Z',
    CLINIC,
    {},
    'before-open',
    TODAY_AT('۱۰'),
  ],
  [
    'H11 holiday across four holidays',
    '2027-03-21T07:00:00Z',
    NOWRUZ,
    {},
    'holiday',
    HOLIDAY + LATER(THU_5_FARVARDIN, '۱۰'),
  ],
  [
    'H12 holiday wins over before-open',
    '2027-03-21T03:00:00Z',
    NOWRUZ,
    {},
    'holiday',
    HOLIDAY + LATER(THU_5_FARVARDIN, '۱۰'),
  ],
  [
    'H13 closed, tomorrow is a holiday',
    '2027-03-19T17:00:00Z',
    NOWRUZ,
    {},
    'closed',
    LATER(THU_5_FARVARDIN, '۱۰'),
  ],
  [
    'H14 closing-soon before a holiday run',
    '2027-03-19T16:10:00Z',
    NOWRUZ,
    {},
    'closing-soon',
    LATER(THU_5_FARVARDIN, '۱۰'),
  ],
  [
    'H15 last holiday evening',
    '2027-03-24T17:00:00Z',
    NOWRUZ,
    {},
    'holiday',
    HOLIDAY + LATER('فردا', '۱۰'),
  ],
  [
    'H16 override with hours',
    '2026-10-13T10:00:00Z',
    HALF_DAY,
    {},
    'closing-soon',
    LATER('فردا', '۱۰'),
  ],
  [
    'H17 closed after the override close',
    '2026-10-13T11:00:00Z',
    HALF_DAY,
    {},
    'closed',
    LATER('فردا', '۱۰'),
  ],
  [
    'H18 no hard-coded offset (UTC+04:30 in 2022)',
    '2022-06-01T05:30:00Z',
    CLINIC,
    {},
    'open',
    CALL_SOON('۱۰'),
  ],
  [
    'H19 next working day skips a non-working day',
    '2026-10-15T11:00:00Z',
    SPLIT,
    {},
    'closed',
    LATER('شنبه ۲۵ مهر', '۱۰:۳۰'),
  ],
  [
    'H20 open time with minutes',
    '2026-10-13T05:00:00Z',
    SPLIT,
    {},
    'before-open',
    TODAY_AT('۱۰:۳۰'),
  ],
  [
    'H21 no working day in 30 days',
    '2026-10-13T08:00:00Z',
    NO_HOURS,
    {},
    'closed',
    'پذیرش در اولین روز کاری با شما تماس می\u200Cگیرد.',
  ],
];

const run = (now: string, hours: ClinicHours, options: HoursOptions = {}) =>
  hoursState(new Date(now), hours, options);

describe('hoursState table H', () => {
  it.each(TABLE)('%s', (_id, now, hours, options, state, callback) => {
    const result = run(now, hours, options);
    expect(result.state).toBe(state);
    expect(result.copy.callback).toBe(callback);
  });

  it('H22 closed sheet before opening, next open today', () => {
    const r = run('2026-10-13T05:00:00Z', CLINIC);
    expect([r.callsAllowed, r.showClosedSheet, r.nextOpen?.at]).toEqual([
      false,
      true,
      '2026-10-13T06:30:00.000Z',
    ]);
  });

  it('H23 closed sheet generated from the schedule', () => {
    expect(run('2026-10-13T05:00:00Z', CLINIC).copy.closedSheet).toBe(
      'کلینیک الان بسته است. ساعات کاری: هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.',
    );
  });

  it('H24 emergency line before opening', () => {
    expect(run('2026-10-13T05:00:00Z', CLINIC).copy.emergencyClosedLine).toBe(
      'پذیرش امروز از ساعت ۱۰، پیش از بقیهٔ درخواست\u200Cها، با شما تماس می\u200Cگیرد.',
    );
  });

  it('H25 closing-soon: calls still allowed', () => {
    const r = run('2026-10-13T16:00:00Z', CLINIC);
    expect([
      r.callsAllowed,
      r.showClosedSheet,
      r.copy.closedSheet,
      r.copy.emergencyClosedLine,
    ]).toEqual([true, false, null, null]);
  });

  it('H26 non-uniform week: the sheet falls back to the clinic note', () => {
    expect(run('2026-10-16T08:00:00Z', SPLIT).copy.closedSheet).toBe(
      `کلینیک الان بسته است. ساعات کاری: ${NOTE}`,
    );
  });

  it('H27 success line label and mask', () => {
    expect(`${REGISTERED_NUMBER_LABEL} ${maskPhone('+989123456789')}`).toBe(
      'شمارهٔ ثبت\u200Cشده: ۰۹۱۲ \u2022\u2022\u2022 ۶۷۸۹',
    );
  });

  it.each([
    [
      'H29 before-open changes at opening',
      '2026-10-13T05:00:00Z',
      CLINIC,
      '2026-10-13T06:30:00.000Z',
    ],
    [
      'H30 open changes at close minus 30 min',
      '2026-10-13T06:30:00Z',
      CLINIC,
      '2026-10-13T16:00:00.000Z',
    ],
    [
      'H31 closing-soon changes at close',
      '2026-10-13T16:00:00Z',
      CLINIC,
      '2026-10-13T16:30:00.000Z',
    ],
    [
      'H32 closed changes at Tehran midnight',
      '2026-10-13T16:30:00Z',
      CLINIC,
      '2026-10-13T20:30:00.000Z',
    ],
    [
      'H33 holiday changes at Tehran midnight',
      '2027-03-21T07:00:00Z',
      NOWRUZ,
      '2027-03-21T20:30:00.000Z',
    ],
  ])('%s', (_id, now, hours, expected) => {
    expect(run(now, hours).nextChangeAt).toBe(expected);
  });
});

// H28: rows H1-H21 under several host zones (npm run test:tz also runs this file per zone).
const ZONES = ['UTC', 'Asia/Tehran', 'America/Los_Angeles', 'Pacific/Kiritimati'];
const ORIGINAL_TZ = process.env.TZ;

function restoreTz(): void {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
}

function switchesTz(): boolean {
  const offsets = new Set<number>();
  for (const zone of ['UTC', 'Pacific/Kiritimati']) {
    process.env.TZ = zone;
    offsets.add(new Date(2026, 0, 1).getTimezoneOffset());
  }
  restoreTz();
  return offsets.size === 2;
}

describe('hoursState time-zone independence', () => {
  afterEach(restoreTz);

  it.skipIf(!switchesTz())('H28 rows H1-H21 give identical results under every host zone', () => {
    const all = () => TABLE.map(([, now, hours, options]) => run(now, hours, options));
    const baseline = all();
    for (const zone of ZONES) {
      process.env.TZ = zone;
      expect(all(), zone).toEqual(baseline);
    }
  });
});

describe('hoursState details', () => {
  it('H-NEXTOPEN labels: «فردا» and the hour, or weekday, date and H:MM', () => {
    expect(run('2026-10-13T16:30:00Z', CLINIC).nextOpen).toEqual({
      at: '2026-10-14T06:30:00.000Z',
      dayLabel: 'فردا',
      timeLabel: '۱۰',
    });
    expect(run('2026-10-15T11:00:00Z', SPLIT).nextOpen).toEqual({
      at: '2026-10-17T07:00:00.000Z',
      dayLabel: 'شنبه ۲۵ مهر',
      timeLabel: '۱۰:۳۰',
    });
    expect(run('2026-10-13T08:00:00Z', CLINIC).nextOpen).toBeNull();
  });

  it('H-HOLIDAY copy: closed sheet and emergency line as closed', () => {
    const r = run('2027-03-21T07:00:00Z', NOWRUZ);
    expect(r.callsAllowed).toBe(false);
    expect(r.copy.closedSheet).toBe(
      'کلینیک الان بسته است. ساعات کاری: هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.',
    );
    expect(r.copy.emergencyClosedLine).toBe(
      `پذیرش ${THU_5_FARVARDIN} از ساعت ۱۰، پیش از بقیهٔ درخواست\u200Cها، با شما تماس می\u200Cگیرد.`,
    );
  });

  it('H-NONWORKING a day without a rule is closed and changes at midnight', () => {
    const r = run('2026-10-16T08:00:00Z', SPLIT);
    expect(r.state).toBe('closed');
    expect(r.nextChangeAt).toBe('2026-10-16T20:30:00.000Z');
    expect(r.copy.callback).toBe(LATER('فردا', '۱۰:۳۰'));
  });

  it('H-FALLBACK no working day: no next open, no emergency line', () => {
    const r = run('2026-10-13T08:00:00Z', NO_HOURS);
    expect(r.nextOpen).toBeNull();
    expect(r.copy.emergencyClosedLine).toBeNull();
    expect(r.copy.closedSheet).toBe(`کلینیک الان بسته است. ساعات کاری: ${NOTE}`);
  });

  it('H-NOTE-EMPTY split hours and an empty note: the closed sheet ends after the first sentence', () => {
    for (const noteFa of ['', '  ']) {
      const r = run('2026-10-14T17:30:00Z', { ...SPLIT, noteFa });
      expect(r.callsAllowed).toBe(false);
      expect(r.copy.closedSheet).toBe('کلینیک الان بسته است.');
    }
  });

  it('H-HORIZON horizonDays limits the search for the next working day', () => {
    // Thu 14:30 in SPLIT: Saturday is two days ahead.
    expect(run('2026-10-15T11:00:00Z', SPLIT, { horizonDays: 1 }).nextOpen).toBeNull();
    expect(run('2026-10-15T11:00:00Z', SPLIT, { horizonDays: 2 }).nextOpen?.dayLabel).toBe(
      'شنبه ۲۵ مهر',
    );
  });

  it('H-SHORT an interval shorter than the closing-soon window is closing-soon from opening', () => {
    const short: ClinicHours = {
      ...CLINIC,
      weekly: [{ ...CLINIC.weekly[0]!, open: '10:00', close: '10:20' }],
    };
    expect(run('2026-10-13T06:30:00Z', short).state).toBe('closing-soon');
  });

  it('H-OPTIONS invalid option values fail loud', () => {
    expect(() => run('2026-10-13T06:30:00Z', CLINIC, { callbackMinutes: -1 })).toThrow(RangeError);
    expect(() => run('2026-10-13T06:30:00Z', CLINIC, { closingSoonMinutes: 1.5 })).toThrow(
      RangeError,
    );
  });

  it('H-PURE the input is not mutated and repeated calls agree', () => {
    const hours = structuredClone(NOWRUZ);
    const first = run('2027-03-21T07:00:00Z', hours);
    expect(hours).toEqual(NOWRUZ);
    expect(run('2027-03-21T07:00:00Z', hours)).toEqual(first);
  });
});

describe('hoursSummary', () => {
  it('H-SUM one rule for the whole week gives the sentence, anything else null', () => {
    expect(hoursSummary(CLINIC)).toBe('هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.');
    expect(hoursSummary(SPLIT)).toBeNull();
    expect(hoursSummary(NO_HOURS)).toBeNull();
    expect(
      hoursSummary({
        ...CLINIC,
        weekly: [{ days: ['sat', 'sun'], open: '10:00', close: '20:00' }],
      }),
    ).toBeNull();
  });
});

describe('hoursNote', () => {
  it('H-NOTE the every-day sentence (F14), else the trimmed clinic note, else null', () => {
    expect(hoursNote({ ...CLINIC, noteFa: 'یادداشت' })).toBe(
      'هر روز ۱۰ تا ۲۰، به\u200Cجز تعطیلات رسمی.',
    );
    expect(hoursNote({ ...SPLIT, noteFa: ' یادداشت ' })).toBe('یادداشت');
    expect(hoursNote({ ...SPLIT, noteFa: '  ' })).toBeNull();
  });

  it('H-NOTE2 under a table only the holiday caveat repeats nothing the rows say', () => {
    expect(hoursTableNote({ ...CLINIC, noteFa: 'یادداشت' })).toBe('به\u200Cجز تعطیلات رسمی.');
    expect(hoursTableNote({ ...SPLIT, noteFa: ' یادداشت ' })).toBe('یادداشت');
    expect(hoursTableNote({ ...SPLIT, noteFa: '  ' })).toBeNull();
  });
});

describe('clinicHoursSchema', () => {
  const issues = (value: unknown) => {
    const result = clinicHoursSchema.safeParse(value);
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
  };

  it('H-SCHEMA accepts every fixture', () => {
    for (const fixture of [CLINIC, NOWRUZ, HALF_DAY, SPLIT, NO_HOURS]) {
      expect(clinicHoursSchema.parse(fixture)).toEqual(fixture);
    }
  });

  it('H-SCHEMA-TIME HH:MM and close after open', () => {
    expect(
      issues({ ...CLINIC, weekly: [{ days: ['sat'], open: '9:00', close: '20:00' }] }),
    ).toEqual(['weekly.0.open']);
    expect(
      issues({ ...CLINIC, weekly: [{ days: ['sat'], open: '20:00', close: '10:00' }] }),
    ).toEqual(['weekly.0.close']);
    expect(
      issues({ ...CLINIC, weekly: [{ days: ['sat'], open: '10:00', close: '24:00' }] }),
    ).toEqual(['weekly.0.close']);
  });

  it('H-SCHEMA-WEEKDAY a weekday appears in at most one rule', () => {
    const twice = {
      ...CLINIC,
      weekly: [
        { days: ['sat', 'sun'], open: '10:00', close: '20:00' },
        { days: ['sun'], open: '10:00', close: '14:00' },
      ],
    };
    expect(issues(twice)).toEqual(['weekly.1.days']);
  });

  it('H-SCHEMA-HOLIDAY unique valid dates, open and close together', () => {
    expect(
      issues({ ...CLINIC, holidays: [closedDay('2026-10-13'), closedDay('2026-10-13')] }),
    ).toEqual(['holidays.1.date']);
    expect(issues({ ...CLINIC, holidays: [{ date: '2026-02-30' }] })).toEqual(['holidays.0.date']);
    expect(issues({ ...CLINIC, holidays: [{ date: '2026-10-13', open: '10:00' }] })).toEqual([
      'holidays.0.close',
    ]);
    expect(issues({ ...CLINIC, timezone: 'UTC' })).toEqual(['timezone']);
  });
});

describe('hoursClock (QA-CLOCK, freeze G18)', () => {
  const NOW = Date.parse('2026-10-13T08:00:00Z');
  const at = (value: string) => new Headers({ [QA_CLOCK_HEADER]: value });

  it('H-QA1 the header sets the hours clock only when QA routes are on', () => {
    expect(hoursClock(at('2026-10-13T18:00:00Z'), true, NOW).toISOString()).toBe(
      '2026-10-13T18:00:00.000Z',
    );
    expect(hoursClock(at('2026-10-13T21:30:00+03:30'), true, NOW).toISOString()).toBe(
      '2026-10-13T18:00:00.000Z',
    );
  });

  it('H-QA2 ignored without QA_ROUTES, when absent, and when not an ISO instant', () => {
    for (const [headers, qa] of [
      [at('2026-10-13T18:00:00Z'), false],
      [new Headers(), true],
      [at('tomorrow'), true],
      [at('1760378400000'), true],
      [at('2026-13-45T99:00:00Z'), true],
    ] as const) {
      expect(hoursClock(headers, qa, NOW).getTime()).toBe(NOW);
    }
  });
});
