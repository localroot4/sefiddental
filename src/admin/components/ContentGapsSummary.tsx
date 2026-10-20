import Link from 'next/link';
import type { ServerProps } from 'payload';

import { hasRole } from '@/access/roles';
import panel from '@/admin/bookings/bookings.module.css';
import { isVerifiedStaff } from '@/admin/bookings/counts';
import { type ContentGapsReport, getContentGaps } from '@/content-gaps/registry';
import { widgetRead } from '@/admin/widgets';
import { adminText } from '@/i18n/fa-admin';
import { formatNumberFa } from '@/lib/persianText';

import styles from './dashboard.module.css';

/** The widget body: open gaps per kind and the way to the full list; null is a failed read. */
export function ContentGapsSummaryBody({ report }: { report: ContentGapsReport | null }) {
  return (
    <section aria-labelledby="content-gaps-summary" className={panel.today}>
      <h2 id="content-gaps-summary" className={panel.todayHeading}>
        {adminText('admin.gaps.heading')}
      </h2>
      {report === null ? (
        <p className={styles.empty}>{adminText('admin.unknown')}</p>
      ) : report.total === 0 ? (
        <p className={styles.empty}>{adminText('admin.gaps.none')}</p>
      ) : (
        <>
          <p className={styles.count}>
            {adminText('admin.gaps.total', { n: formatNumberFa(report.total) })}
          </p>
          <ul className={styles.list}>
            {report.groups.map((group) => (
              <li key={group.kind} className={styles.item}>
                <span>{group.headingFa}</span>
                <span className={styles.count}>{formatNumberFa(group.items.length)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link className={styles.link} href="/admin/system-status#status-gaps" prefetch={false}>
        {adminText('admin.gaps.open')}
      </Link>
    </section>
  );
}

/**
 * `beforeDashboard`, admins only (H33): gap labels are written for the admin and never reach
 * editors (registry.ts). A failed read shows «نامشخص», never zero.
 */
export async function ContentGapsSummary({ payload, user }: ServerProps) {
  if (!hasRole(user, 'admin') || !(await isVerifiedStaff(payload, user))) return null;
  const report = await widgetRead('content_gaps', () => getContentGaps(payload));
  return <ContentGapsSummaryBody report={report} />;
}
