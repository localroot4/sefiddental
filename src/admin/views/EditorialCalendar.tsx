import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import { notFound } from 'next/navigation';
import type { AdminViewServerProps, Option } from 'payload';

import { isVerifiedStaff } from '@/admin/bookings/counts';
import { loadCalendar } from '@/admin/calendar';
import {
  CALENDAR_FILTERS,
  CalendarAgenda,
  type CalendarFilter,
} from '@/admin/components/ContentCalendar';

/** The review states with their Persian labels, from the articles config itself. */
function reviewStates(props: AdminViewServerProps): Array<{ value: string; label: string }> {
  const field = props.initPageResult.req.payload.collections.articles?.config.fields.find(
    (f) => 'name' in f && f.name === 'reviewState',
  ) as { options?: Option[] } | undefined;
  return (field?.options ?? []).map((o) =>
    typeof o === 'string' ? { value: o, label: o } : { value: o.value, label: String(o.label) },
  );
}

/**
 * `/admin/content-calendar` (H13): TOTP-verified staff only; everyone else gets the same 404 as
 * an unknown page (custom views are public by default). Lists what the viewer's navigation shows.
 */
export async function EditorialCalendar(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams, user } = props;
  const { req } = initPageResult;
  if (!(await isVerifiedStaff(req.payload, req.user))) notFound();
  const asked = searchParams?.kind;
  const kind = CALENDAR_FILTERS.includes(asked as CalendarFilter)
    ? (asked as CalendarFilter)
    : 'all';
  const now = new Date();
  const data = await loadCalendar(req.payload, initPageResult.visibleEntities.collections, now);
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={req.payload}
      permissions={initPageResult.permissions}
      req={req}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <CalendarAgenda data={data} kind={kind} now={now} reviewStates={reviewStates(props)} />
      </Gutter>
    </DefaultTemplate>
  );
}
