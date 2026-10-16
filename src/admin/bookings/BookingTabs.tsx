import type { BeforeListTableServerProps } from 'payload';

import { hasRole } from '@/access/roles';
import { adminText, type AdminMessageKey } from '@/i18n/fa-admin';
import { formatNumberFa } from '@/lib/persianText';

import styles from './bookings.module.css';
import { bookingCounts, isVerifiedStaff } from './counts';
import { ExportCsv } from './ExportCsv';
import {
  activeTab,
  BOOKING_TABS,
  savedOrderNotice,
  tabHref,
  TABS_NAV_ID,
  type BookingTabKey,
} from './tabs';

/** The three numbers the badges show; the dashboard reads the rest. */
const TAB_COUNTS = ['overdue', 'openEmergency', 'suspiciousToday'] as const;
type TabCounts = Record<(typeof TAB_COUNTS)[number], number | null>;

type Badge = { text: string; alert: boolean } | null;

/** Only a number that needs action earns a badge; a failed read says so instead of 0. */
function badgeOf(key: BookingTabKey, counts: TabCounts): Badge {
  const pick: Partial<Record<BookingTabKey, [number | null, AdminMessageKey | null]>> = {
    callbackDue: [counts.overdue, 'admin.tabs.overdue'],
    emergency: [counts.openEmergency, null],
    suspicious: [counts.suspiciousToday, 'admin.tabs.today'],
  };
  const entry = pick[key];
  if (!entry) return null;
  const [n, message] = entry;
  if (n === null) return { text: adminText('admin.unknown'), alert: false };
  if (n === 0) return null;
  const text = message ? adminText(message, { n: formatNumberFa(n) }) : formatNumberFa(n);
  return { text, alert: key !== 'suspicious' };
}

/**
 * `beforeListTable` of bookings: the view tabs with their counts and, for admins, the CSV
 * export of the current filter. Server-rendered; TOTP-verified staff only.
 */
export async function BookingTabs({
  payload,
  user,
  searchParams,
  listPreferences,
}: BeforeListTableServerProps) {
  if (!(await isVerifiedStaff(payload, user))) return null;
  const counts = await bookingCounts(payload, TAB_COUNTS);
  const params = searchParams ?? {};
  const current = activeTab(params, listPreferences?.sort);
  return (
    <div className={styles.toolbar}>
      <nav aria-label={adminText('admin.tabs.nav')} className={styles.tabs} id={TABS_NAV_ID}>
        <ul className={styles.tabList}>
          {BOOKING_TABS.map((tab) => {
            const badge = badgeOf(tab.key, counts);
            return (
              <li key={tab.key}>
                <a
                  className={styles.tab}
                  href={tabHref(tab.key)}
                  aria-current={current === tab.key ? 'page' : undefined}
                >
                  {adminText(tab.label)}
                  {badge ? (
                    <span
                      className={
                        badge.alert ? `${styles.badge} ${styles.badgeAlert}` : styles.badge
                      }
                    >
                      {badge.text}
                    </span>
                  ) : null}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {hasRole(user, 'admin') ? <ExportCsv /> : null}
      {savedOrderNotice(params, listPreferences?.sort) ? (
        <p className={styles.orderNote}>
          {adminText('admin.tabs.savedOrder')}{' '}
          <a className={styles.orderLink} href={tabHref('all')}>
            {adminText('admin.tabs.urgencyOrder')}
          </a>
        </p>
      ) : null}
    </div>
  );
}
