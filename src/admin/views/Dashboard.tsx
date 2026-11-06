import type { DashboardViewServerProps } from '@payloadcms/next/views';
import { Gutter } from '@payloadcms/ui';
import { CollectionCards } from '@payloadcms/ui/rsc';
import Link from 'next/link';
import type { ServerProps } from 'payload';
import { Suspense } from 'react';

import { hasRole } from '@/access/roles';
import { BookingsToday } from '@/admin/components/BookingsToday';
import { BookingsTrend } from '@/admin/components/BookingsTrend';
import { ContentCalendar } from '@/admin/components/ContentCalendar';
import { ContentGapsSummary } from '@/admin/components/ContentGapsSummary';
import { SeoHealth } from '@/admin/components/SeoHealth';
import { greetingKey, quickActions } from '@/admin/dashboard';
import { adminText } from '@/i18n/fa-admin';
import { CLINIC_TZ, formatJalali, zonedDateKey } from '@/lib/jalali';

import styles from './Dashboard.module.css';

/** A panel's place while its read is in flight: the same frame, grey bars, no layout jump. */
function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <span className="sr-only">{adminText('admin.home.loading')}</span>
      <span className={styles.skeletonHeading} />
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={styles.skeletonLine} />
      ))}
    </div>
  );
}

/**
 * `admin.components.views.dashboard`: the greeting with today's Jalali date, quick actions, then
 * the widgets (each checks its own role and TOTP session, and streams in behind a skeleton),
 * then Payload's own collection cards. The widgets are unchanged; this view only lays them out.
 */
export function Dashboard(props: DashboardViewServerProps) {
  const { initPageResult, payload, permissions, user } = props;
  const now = new Date();
  const name = (user as { name?: string } | undefined)?.name?.trim();
  const greeting = adminText(greetingKey(now));
  const actions = quickActions(user, Boolean(permissions?.collections?.articles?.create));
  const widget = { payload, user, i18n: props.i18n, permissions } as ServerProps;
  const { cookies, locale, permissions: pagePermissions, req } = initPageResult;

  return (
    <Gutter className={`dashboard ${styles.root}`}>
      <header className={styles.head}>
        <div className={styles.hello}>
          <h1 className={styles.greeting}>
            {name ? adminText('admin.home.hello', { greeting, name }) : greeting}
          </h1>
          <p className={styles.date}>
            <time dateTime={zonedDateKey(now, CLINIC_TZ)}>
              {formatJalali(now, 'EEEE d MMMM yyyy')}
            </time>
          </p>
        </div>
        {actions.length > 0 ? (
          <nav aria-label={adminText('admin.home.actions')} className={styles.actions}>
            {actions.map((action) => (
              <Link
                key={action.href}
                className={action.primary ? `${styles.action} ${styles.primary}` : styles.action}
                href={action.href}
                prefetch={false}
              >
                {action.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <div className={styles.grid}>
        <div className={styles.kpi}>
          <Suspense fallback={<PanelSkeleton rows={2} />}>
            <BookingsToday {...widget} />
          </Suspense>
        </div>
        <div className={styles.trend}>
          <Suspense fallback={<PanelSkeleton rows={2} />}>
            <BookingsTrend {...widget} now={now} />
          </Suspense>
        </div>
        <div className={styles.calendar}>
          <Suspense fallback={<PanelSkeleton rows={4} />}>
            <ContentCalendar {...widget} />
          </Suspense>
        </div>
        <div className={styles.side}>
          <Suspense fallback={<PanelSkeleton />}>
            <SeoHealth {...widget} />
          </Suspense>
        </div>
        <div className={styles.side}>
          <Suspense fallback={hasRole(user as object, 'admin') ? <PanelSkeleton rows={2} /> : null}>
            <ContentGapsSummary {...widget} />
          </Suspense>
        </div>
      </div>

      {/* Payload's collection cards, grouped as the navigation is; a hairline sets them apart. */}
      <div className={styles.sections}>
        <CollectionCards
          cookies={cookies}
          locale={locale}
          permissions={pagePermissions}
          req={req}
          user={user}
          widgetSlug="collections"
        />
      </div>
    </Gutter>
  );
}
