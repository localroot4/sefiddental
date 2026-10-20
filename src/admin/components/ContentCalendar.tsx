import { getVisibleEntities } from '@payloadcms/ui/shared';
import type { PayloadRequest, ServerProps } from 'payload';

import panel from '@/admin/bookings/bookings.module.css';
import { isVerifiedStaff } from '@/admin/bookings/counts';
import {
  CALENDAR_PATH,
  type CalendarData,
  type CalendarItem,
  type CalendarKind,
  groupByDay,
  loadCalendar,
} from '@/admin/calendar';
import { widgetRead } from '@/admin/widgets';
import { adminText, type AdminMessageKey } from '@/i18n/fa-admin';
import { dayLabel, formatJalali, formatTimeFa } from '@/lib/jalali';
import { formatNumberFa } from '@/lib/persianText';

import styles from './dashboard.module.css';

const WEEK_MS = 7 * 86_400_000;
const WIDGET_ROWS = 5;

export type CalendarFilter = 'all' | CalendarKind;
export const CALENDAR_FILTERS: readonly CalendarFilter[] = [
  'all',
  'scheduled',
  'published',
  'failed',
];

const KIND_LABEL: Record<CalendarKind, AdminMessageKey> = {
  scheduled: 'admin.calendar.kind.scheduled',
  published: 'admin.calendar.kind.published',
  failed: 'admin.calendar.kind.failed',
};

const when = (item: CalendarItem) =>
  `${formatJalali(new Date(item.at), 'EEEE d MMMM')}، ${formatTimeFa(new Date(item.at))}`;

/** One row: the document link, what happens and when; a failed row carries its block message. */
function Row({ item, showDay }: { item: CalendarItem; showDay: boolean }) {
  return (
    <li className={item.kind === 'failed' ? `${styles.item} ${styles.failed}` : styles.item}>
      <span className={styles.meta}>{showDay ? when(item) : formatTimeFa(new Date(item.at))}</span>
      <span className={styles.kind}>
        {adminText(item.unpublish ? 'admin.calendar.unpublish' : KIND_LABEL[item.kind])}
      </span>
      <a className={styles.link} href={item.href}>
        {item.title}
      </a>
      {item.message ? <p className={styles.message}>{item.message}</p> : null}
    </li>
  );
}

/**
 * The dashboard widget: failed publishes, then the next seven days; null is a failed read.
 * Presentational.
 */
export function ContentCalendarBody({ items, now }: { items: CalendarItem[] | null; now: Date }) {
  const failed = items?.filter((i) => i.kind === 'failed') ?? [];
  const end = now.getTime() + WEEK_MS;
  const week = (items ?? [])
    .filter((i) => i.kind === 'scheduled' && Date.parse(i.at) <= end)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return (
    <section aria-labelledby="content-calendar-widget" className={panel.today}>
      <h2 id="content-calendar-widget" className={panel.todayHeading}>
        {adminText('admin.calendar.title')}
      </h2>
      {items === null ? <p className={styles.empty}>{adminText('admin.unknown')}</p> : null}
      {failed.length > 0 ? (
        <a className={`${styles.link} ${styles.alertLink}`} href={`${CALENDAR_PATH}?kind=failed`}>
          {adminText('admin.calendar.failedCount', { n: formatNumberFa(failed.length) })}
        </a>
      ) : null}
      <h3 className={styles.subheading}>{adminText('admin.calendar.week')}</h3>
      {week.length > 0 ? (
        <ul className={styles.list}>
          {week.slice(0, WIDGET_ROWS).map((item) => (
            <Row key={`${item.collection}:${item.id}:${item.at}`} item={item} showDay />
          ))}
        </ul>
      ) : items === null ? null : (
        <p className={styles.empty}>{adminText('admin.calendar.weekEmpty')}</p>
      )}
      <a className={styles.link} href={CALENDAR_PATH}>
        {adminText('admin.calendar.open')}
      </a>
    </section>
  );
}

/**
 * The `/admin/content-calendar` view's content (H13): failed publishes on top, the filter, the
 * agenda by Tehran day, then article drafts by review state. Presentational.
 */
export function CalendarAgenda({
  data,
  kind,
  now,
  reviewStates,
}: {
  data: CalendarData;
  kind: CalendarFilter;
  now: Date;
  reviewStates: ReadonlyArray<{ value: string; label: string }>;
}) {
  // Failed publishes sit in their own block on top, except when they are the filter.
  const failed = kind === 'failed' ? [] : data.items.filter((i) => i.kind === 'failed');
  const days = groupByDay(
    data.items.filter((i) => (kind === 'all' ? i.kind !== 'failed' : i.kind === kind)),
  );
  const drafts = reviewStates
    .map((state) => ({ ...state, docs: data.drafts.filter((d) => d.reviewState === state.value) }))
    .filter((state) => state.docs.length > 0);
  return (
    <div className={styles.root} id="content-calendar">
      <h1 className={styles.title}>{adminText('admin.calendar.title')}</h1>
      <p className={styles.lead}>{adminText('admin.calendar.lead')}</p>
      {failed.length > 0 ? (
        <section aria-labelledby="calendar-failed" className={styles.section}>
          <h2 id="calendar-failed" className={styles.heading}>
            {adminText('admin.calendar.failedHeading')}
          </h2>
          <p className={styles.lead}>{adminText('admin.calendar.failedHelp')}</p>
          <ul className={styles.list}>
            {failed.map((item) => (
              <Row key={`${item.collection}:${item.id}:${item.at}`} item={item} showDay />
            ))}
          </ul>
        </section>
      ) : null}
      <nav aria-label={adminText('admin.calendar.filter')}>
        <ul className={styles.chips}>
          {CALENDAR_FILTERS.map((filter) => (
            <li key={filter}>
              <a
                className={styles.chip}
                href={filter === 'all' ? CALENDAR_PATH : `${CALENDAR_PATH}?kind=${filter}`}
                aria-current={filter === kind ? 'page' : undefined}
              >
                {adminText(filter === 'all' ? 'admin.calendar.kind.all' : KIND_LABEL[filter])}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {days.length === 0 ? (
        <p className={`${styles.empty} ${styles.section}`}>
          {adminText(`admin.calendar.empty.${kind}`)}
        </p>
      ) : (
        days.map((day) => (
          <section key={day.key} aria-labelledby={`day-${day.key}`} className={styles.section}>
            <h2 id={`day-${day.key}`} className={styles.heading}>
              {dayLabel(day.key, now)}
            </h2>
            <ul className={styles.list}>
              {day.items.map((item) => (
                <Row key={`${item.collection}:${item.id}:${item.at}`} item={item} showDay={false} />
              ))}
            </ul>
          </section>
        ))
      )}
      <section aria-labelledby="calendar-drafts" className={styles.section}>
        <h2 id="calendar-drafts" className={styles.heading}>
          {adminText('admin.calendar.drafts')}
        </h2>
        {drafts.length === 0 ? (
          <p className={styles.empty}>{adminText('admin.calendar.draftsEmpty')}</p>
        ) : (
          drafts.map((state) => (
            <div key={state.value}>
              <h3 className={styles.subheading}>
                {state.label}{' '}
                <span className={styles.count}>{formatNumberFa(state.docs.length)}</span>
              </h3>
              <ul className={styles.list}>
                {state.docs.map((doc) => (
                  <li key={String(doc.id)} className={styles.item}>
                    <a className={styles.link} href={`/admin/collections/articles/${doc.id}`}>
                      {doc.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

/**
 * `beforeDashboard`: the calendar widget for TOTP-verified staff, over the collections the viewer
 * sees in the navigation. Reads with access overridden after that check (calendar.ts).
 */
export async function ContentCalendar({ payload, user }: ServerProps) {
  if (!(await isVerifiedStaff(payload, user))) return null;
  const now = new Date();
  // DefaultDashboard passes no visibleEntities, so work them out as Payload's navigation does.
  const data = await widgetRead('calendar', () =>
    loadCalendar(
      payload,
      getVisibleEntities({ req: { payload, user } as PayloadRequest }).collections,
      now,
    ),
  );
  return <ContentCalendarBody items={data?.items ?? null} now={now} />;
}
