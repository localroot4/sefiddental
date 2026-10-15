import { describe, expect, it } from 'vitest';

import { allMessages, getLocale, SYSTEM_LINKS } from '@/i18n/fa';
import { CONTENT_MESSAGES } from '@/i18n/fa-content';
import { hoursState, hoursSummary, type ClinicHours } from '@/lib/hoursState';
import { TOO_MANY_ATTEMPTS_FA } from '@/lib/http/systemResponses';
import { PHONE_ERRORS, REGISTERED_NUMBER_LABEL } from '@/lib/phone';
import { STATIC_PAGE_COPY } from '@/lib/system-pages/staticPage';

const EVERY_DAY = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const;
const HOURS: ClinicHours = {
  timezone: 'Asia/Tehran',
  weekly: [{ days: [...EVERY_DAY], open: '10:00', close: '20:00' }],
  holidays: [],
  noteFa: '',
};

/** Every line of the hoursState COPY, from one instant per state (Tehran is UTC+3:30). */
function hoursCopy(): string[] {
  const holiday: ClinicHours = { ...HOURS, holidays: [{ date: '2026-10-14' as never }] };
  const samples = [
    hoursState(new Date('2026-10-14T08:00:00Z'), HOURS), // open
    hoursState(new Date('2026-10-14T05:00:00Z'), HOURS), // before open
    hoursState(new Date('2026-10-14T17:00:00Z'), HOURS), // closed, after hours
    hoursState(new Date('2026-10-14T08:00:00Z'), holiday), // holiday
    hoursState(new Date('2026-10-14T08:00:00Z'), { ...HOURS, weekly: [] }), // no working day
  ];
  const lines = samples.flatMap((s) => [
    s.copy.callback,
    s.copy.closedSheet,
    s.copy.emergencyClosedLine,
  ]);
  return [...lines, hoursSummary(HOURS)].filter((line): line is string => Boolean(line));
}

/** Every Persian string a visitor or an admin sees from this lane. */
function visibleCopy(): string[] {
  const staticCopy = [
    STATIC_PAGE_COPY.siteName,
    STATIC_PAGE_COPY.callLabel,
    STATIC_PAGE_COPY.hoursLine,
    STATIC_PAGE_COPY.urgentLabel,
    STATIC_PAGE_COPY.linksHeading,
    ...STATIC_PAGE_COPY.links.map((l) => l.label),
    ...Object.values(STATIC_PAGE_COPY.maintenance),
    ...Object.values(STATIC_PAGE_COPY.gone),
  ];
  // CONTENT_MESSAGES is listed until fa.ts merges it; the Set then drops the repeats.
  return [
    ...new Set([
      ...allMessages(),
      ...Object.values(CONTENT_MESSAGES),
      ...staticCopy,
      TOO_MANY_ATTEMPTS_FA,
      ...hoursCopy(),
      ...Object.values(PHONE_ERRORS),
      REGISTERED_NUMBER_LABEL,
    ]),
  ];
}

// copy-guidelines.md: banned words and claims, plus the five labels banned by conversion.md 2.
const BANNED = [
  'بهترین',
  'بی‌نظیر',
  'بینظیر',
  'تضمینی',
  'بدون درد',
  'ارزان‌ترین',
  'معجزه',
  'تماس با ما',
  'بیشتر بدانید',
  'کلیک کنید',
  'همین حالا تماس بگیرید',
  'انتخاب این سطح',
];

describe('Persian copy (copy-guidelines.md)', () => {
  it.each(visibleCopy())('CP1 %s', (text) => {
    for (const word of BANNED) expect(text).not.toContain(word);
    expect(text).not.toMatch(/[يكى]/); // Arabic yeh, kaf, alef maksura
    expect(text).not.toMatch(/[—–]/); // em and en dash
    expect(text).not.toMatch(/[0-9]/); // Persian digits only (phone numbers live in E.164 fields)
    // The common missing-ZWNJ forms (copy-facts CR-31): «می شود», «درمان های».
    expect(text).not.toMatch(/(^|[\s«])ن?می [آ-ی]/);
    expect(text).not.toMatch(/ (ها|های|هایی|تر|ترین)([\s.،؟»]|$)/);
  });

  it('CP1b the hours samples reach every line of the hoursState COPY', () => {
    const lines = hoursCopy().join('\n');
    for (const part of [
      'دقیقهٔ دیگر', // open
      'امروز از ساعت ۱۰ با', // before open
      'فردا از ساعت ۱۰ با', // later
      'امروز تعطیل رسمی است.', // holiday prefix
      'اولین روز کاری', // no working day
      'کلینیک الان بسته است.\n', // closed sheet without a summary
      'امروز از ساعت ۱۰، پیش از', // emergency today
      'فردا از ساعت ۱۰، پیش از', // emergency later
      'هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.', // summary
    ]) {
      expect(lines, part).toContain(part);
    }
  });

  it('CP2 one label per intent: the call and emergency labels', () => {
    expect(allMessages()).toContain('تماس با کلینیک');
    expect(allMessages()).toContain('درد شدید دارید؟');
  });

  it('CP3 locale and system links', () => {
    expect(getLocale()).toEqual({ lang: 'fa', dir: 'rtl' });
    expect(SYSTEM_LINKS.map((l) => l.href)).toEqual(STATIC_PAGE_COPY.links.map((l) => l.href));
  });
});
