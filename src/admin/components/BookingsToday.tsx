import type { ServerProps } from 'payload';

import styles from '@/admin/bookings/bookings.module.css';
import {
  bookingCounts,
  isVerifiedStaff,
  tehranDayStart,
  tehranMonthStart,
} from '@/admin/bookings/counts';
import { cond, listHref, tabHref } from '@/admin/bookings/tabs';
import { adminText, type AdminMessageKey } from '@/i18n/fa-admin';
import { formatNumberFa } from '@/lib/persianText';

const WIDGET_COUNTS = [
  'newToday',
  'emergencyToday',
  'waiting',
  'overdue',
  'suspiciousToday',
  'notUrgentMonth',
  'outcomeMonth',
  'openEmergency',
] as const;
type WidgetCounts = Record<(typeof WIDGET_COUNTS)[number], number | null>;

// A count that failed or never arrived is «نامشخص», never zero.
const num = (n: number | null | undefined) =>
  n === null || n === undefined ? adminText('admin.unknown') : formatNumberFa(n);

/** Each figure opens a list that holds exactly the requests it counts (counts.ts). */
function figureLinks(now: Date) {
  const today = cond(0, 'createdAt', 'greater_than_equal', [tehranDayStart(now).toISOString()]);
  const real = cond(1, 'status', 'not_in', ['suspicious', 'spam']);
  return {
    newToday: listHref([...today, ...real], 'urgencyRank'),
    emergencyToday: listHref(
      [...today, ...real, ...cond(2, 'kind', 'equals', ['emergency'])],
      'urgencyRank',
    ),
    // Every new request, as counted, most overdue first (H33); the «مهلت تماس» tab drops rows
    // without a due time.
    waiting: listHref(cond(0, 'status', 'equals', ['new']), 'callbackDueAt'),
    openEmergency: tabHref('emergency'),
    suspiciousToday: listHref(
      [...today, ...cond(1, 'status', 'equals', ['suspicious'])],
      '-createdAt',
    ),
    notUrgentMonth: listHref(
      [
        ...cond(0, 'createdAt', 'greater_than_equal', [tehranMonthStart(now).toISOString()]),
        ...cond(1, 'kind', 'equals', ['emergency']),
        ...cond(2, 'emergencyOutcome', 'equals', ['not_urgent']),
      ],
      '-createdAt',
    ),
  };
}

const FIGURES: ReadonlyArray<{
  label: AdminMessageKey;
  value: 'newToday' | 'emergencyToday' | 'waiting' | 'suspiciousToday';
  alert?: boolean;
}> = [
  { label: 'admin.today.new', value: 'newToday' },
  { label: 'admin.today.emergency', value: 'emergencyToday', alert: true },
  { label: 'admin.today.waiting', value: 'waiting' },
  { label: 'admin.today.suspicious', value: 'suspiciousToday' },
];

/** «۲۰٪», or why there is no share yet; a failed read is «نامشخص». */
function notUrgentShare(counts: WidgetCounts): string {
  const { notUrgentMonth: part, outcomeMonth: whole } = counts;
  if (part === null || whole === null) return adminText('admin.unknown');
  if (whole === 0) return adminText('admin.today.noOutcome');
  return adminText('admin.today.percent', { n: formatNumberFa(Math.round((100 * part) / whole)) });
}

/** The widget body; presentational, so tests render it from counts. */
export function BookingsTodayBody({ counts, now }: { counts: WidgetCounts; now: Date }) {
  const links = figureLinks(now);
  return (
    <section aria-labelledby="bookings-today" className={styles.today}>
      <h2 id="bookings-today" className={styles.todayHeading}>
        {adminText('admin.today.heading')}
      </h2>
      {counts.newToday === 0 ? (
        <p className={styles.todayEmpty}>{adminText('admin.today.empty')}</p>
      ) : null}
      <ul className={styles.figures}>
        {FIGURES.map((figure) => {
          const n = counts[figure.value];
          return (
            <li key={figure.value}>
              <a className={styles.figure} href={links[figure.value]}>
                <span className={styles.figureLabel}>{adminText(figure.label)}</span>
                <span
                  className={
                    figure.alert && n ? `${styles.figureValue} ${styles.alert}` : styles.figureValue
                  }
                >
                  {num(n)}
                </span>
                {figure.value === 'waiting' && counts.overdue !== 0 ? (
                  <span className={`${styles.figureNote} ${counts.overdue ? styles.alert : ''}`}>
                    {adminText('admin.today.overdue', { n: num(counts.overdue) })}
                  </span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
      <p className={styles.month}>
        <a className={styles.orderLink} href={links.notUrgentMonth}>
          {adminText('admin.today.notUrgent')}
        </a>
        <span className={styles.monthValue}>{notUrgentShare(counts)}</span>
      </p>
      {/* Open emergencies of every day, so one from yesterday is not lost under «امروز». */}
      <p className={styles.month}>
        <a className={styles.orderLink} href={links.openEmergency}>
          {adminText('admin.today.openEmergency')}
        </a>
        <span className={styles.figureNote}>{adminText('admin.today.openEmergencyNote')}</span>
        <span
          className={
            counts.openEmergency ? `${styles.monthValue} ${styles.alert}` : styles.monthValue
          }
        >
          {num(counts.openEmergency)}
        </span>
      </p>
    </section>
  );
}

/**
 * `beforeDashboard` (G15; not the experimental dashboard widgets API): today's requests for
 * TOTP-verified staff, counted from Tehran midnight, this Jalali month's «فوری نبود» share and
 * the open emergencies of every day (H33).
 * Counts only, so access is overridden after the role check.
 */
export async function BookingsToday({ payload, user }: ServerProps) {
  if (!(await isVerifiedStaff(payload, user))) return null;
  const now = new Date();
  return <BookingsTodayBody counts={await bookingCounts(payload, WIDGET_COUNTS, now)} now={now} />;
}
