import type { ServerProps } from 'payload';

import panel from '@/admin/bookings/bookings.module.css';
import { isVerifiedStaff } from '@/admin/bookings/counts';
import { loadTrend, type TrendDay } from '@/admin/dashboard';
import { widgetRead } from '@/admin/widgets';
import { adminText } from '@/i18n/fa-admin';
import { formatJalaliKey, weekdayOfKey } from '@/lib/jalali';
import { formatNumberFa } from '@/lib/persianText';

import styles from './dashboard.module.css';

/** One letter per weekday, Sunday first, as Persian calendars head their columns. */
const WEEKDAY_LETTER = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'] as const;

const W = 280;
const H = 96;
const BAR = 24;

/**
 * Seven bars, oldest at the inline start of the reading order (the right in RTL), today in the
 * brand colour, each labelled with its count. Screen readers get the list beside it instead.
 */
function Bars({ days }: { days: TrendDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const step = W / days.length;
  return (
    <svg className={styles.trendChart} viewBox={`0 -16 ${W} ${H + 36}`} aria-hidden="true">
      {days.map((day, i) => {
        const x = W - (i + 1) * step + (step - BAR) / 2;
        const h = day.count === 0 ? 2 : Math.max(4, (day.count / max) * H);
        const today = i === days.length - 1;
        return (
          <g key={day.key}>
            <rect
              className={today ? styles.trendToday : styles.trendBar}
              x={x}
              y={H - h}
              width={BAR}
              height={h}
              rx={4}
            />
            {day.count > 0 ? (
              <text className={styles.trendValue} x={x + BAR / 2} y={H - h - 5} textAnchor="middle">
                {formatNumberFa(day.count)}
              </text>
            ) : null}
            <text className={styles.trendLabel} x={x + BAR / 2} y={H + 16} textAnchor="middle">
              {WEEKDAY_LETTER[weekdayOfKey(day.key)]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The week's requests per day; null is a failed read. Presentational. */
export function BookingsTrendBody({ days }: { days: TrendDay[] | null }) {
  const total = days?.reduce((sum, d) => sum + d.count, 0) ?? 0;
  return (
    <section aria-labelledby="bookings-trend" className={panel.today}>
      <h2 id="bookings-trend" className={panel.todayHeading}>
        {adminText('admin.trend.heading')}
      </h2>
      {days === null ? (
        <p className={styles.error}>{adminText('admin.home.failed')}</p>
      ) : total === 0 ? (
        <p className={styles.empty}>{adminText('admin.trend.empty')}</p>
      ) : (
        <>
          <p className={styles.trendTotal}>
            {adminText('admin.trend.total', { n: formatNumberFa(total) })}
          </p>
          <Bars days={days} />
          <ol className="sr-only">
            {days.map((day) => (
              <li key={day.key}>
                {adminText('admin.trend.day', {
                  day: formatJalaliKey(day.key, 'EEEE d MMMM'),
                  n: formatNumberFa(day.count),
                })}
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/** The dashboard's trend panel for TOTP-verified staff: one read (dashboard.ts loadTrend). */
export async function BookingsTrend({ payload, user }: ServerProps) {
  if (!(await isVerifiedStaff(payload, user))) return null;
  return (
    <BookingsTrendBody days={await widgetRead('trend', () => loadTrend(payload, new Date()))} />
  );
}
