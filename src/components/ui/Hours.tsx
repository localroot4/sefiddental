import { format } from 'date-fns-jalali';
import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';
import type { ClinicHours, HoursStateName, Weekday } from '@/lib/hoursState';
import { toPersianDigits } from '@/lib/persianText';

import { cx } from './cx';

// The Iranian week, Saturday first.
const WEEK: readonly Weekday[] = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];

/**
 * Weekday names from date-fns-jalali, the one spelling source of src/lib/jalali.ts (Intl drops
 * the ZWNJ in some names). 2024-01-06 was a Saturday; noon UTC is the same day in every zone
 * the server runs in.
 */
function weekdayName(index: number): string {
  return format(new Date(Date.UTC(2024, 0, 6 + index, 12)), 'EEEE');
}

/** «۱۰» on the hour, else «۱۰:۳۰» (hoursState decision D-H2). */
function clock(hhmm: string): string {
  const [h = '0', m = '00'] = hhmm.split(':');
  return toPersianDigits(m === '00' ? String(Number(h)) : `${Number(h)}:${m}`);
}

export type HoursRow = { days: string; hours: string | null };

/**
 * The weekly rules as table rows: consecutive days with the same hours share a row («شنبه تا
 * چهارشنبه»), a full week reads «هر روز», a day without a rule is closed (hours null).
 */
export function hoursRows(hours: ClinicHours): HoursRow[] {
  const perDay = WEEK.map((day) => {
    const rule = hours.weekly.find((r) => r.days.includes(day));
    return rule ? `${clock(rule.open)} ${t('ui.hours.to')} ${clock(rule.close)}` : null;
  });
  const rows: HoursRow[] = [];
  let start = 0;
  for (let i = 1; i <= WEEK.length; i++) {
    if (i < WEEK.length && perDay[i] === perDay[start]) continue;
    const days =
      start === 0 && i === WEEK.length
        ? t('ui.hours.everyDay')
        : i - start === 1
          ? weekdayName(start)
          : `${weekdayName(start)} ${t('ui.hours.to')} ${weekdayName(i - 1)}`;
    rows.push({ days, hours: perDay[start] ?? null });
    start = i;
  }
  return rows;
}

/**
 * Opening hours as a table (address page, booking block). Static: today's state is never in the
 * server HTML (CC-6), so the live HoursBadge goes into `status`, whose box is reserved.
 */
export function HoursTable(props: {
  hours: ClinicHours;
  status?: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('grid content-start gap-3', props.className)}>
      {props.status ? <div className="min-h-8">{props.status}</div> : null}
      <table className="w-full border-collapse text-small">
        <caption className="sr-only">{t('ui.hours.caption')}</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('ui.hours.day')}</th>
            <th scope="col">{t('ui.hours.time')}</th>
          </tr>
        </thead>
        <tbody>
          {hoursRows(props.hours).map((row) => (
            <tr key={row.days} className="border-b border-line">
              <th scope="row" className="py-3 pe-4 text-start font-semibold">
                {row.days}
              </th>
              <td className={cx('py-3 text-end', row.hours ? 'text-ink' : 'text-ink-muted')}>
                {row.hours ?? t('ui.hours.closedDay')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {props.note ? <p className="text-caption text-ink-muted">{props.note}</p> : null}
    </div>
  );
}

const LABEL_KEYS = {
  open: 'ui.hours.state.open',
  'closing-soon': 'ui.hours.state.closingSoon',
  'before-open': 'ui.hours.state.beforeOpen',
  closed: 'ui.hours.state.closed',
  holiday: 'ui.hours.state.holiday',
} as const satisfies Record<HoursStateName, Parameters<typeof t>[0]>;

/** The five HoursBadge labels, for a server parent to hand to the island that knows the state. */
export function hoursBadgeLabels(): Record<HoursStateName, string> {
  return Object.fromEntries(
    Object.entries(LABEL_KEYS).map(([state, key]) => [state, t(key)]),
  ) as Record<HoursStateName, string>;
}
