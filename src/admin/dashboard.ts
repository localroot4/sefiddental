import type { Payload } from 'payload';

import { hasRole } from '@/access/roles';
import { real, since, tehranDayStart } from '@/admin/bookings/counts';
import { cond, listHref } from '@/admin/bookings/tabs';
import { CALENDAR_PATH } from '@/admin/calendar';
import { adminText, type AdminMessageKey } from '@/i18n/fa-admin';
import { addDaysToKey, CLINIC_TZ, type DateKey, zonedDateKey, zonedParts } from '@/lib/jalali';
import { ADMIN_ROUTE } from '@/lib/paths';

export const TREND_DAYS = 7;
// shortcut: a week with more requests than this undercounts its oldest days; switch to one
// count per day if the clinic ever takes over 2 000 requests a week.
const TREND_CAP = 2000;

/** The dashboard greeting for the hour on the Tehran clock. */
export function greetingKey(now: Date): AdminMessageKey {
  const { hour } = zonedParts(now, CLINIC_TZ);
  if (hour >= 5 && hour < 12) return 'admin.home.greeting.morning';
  if (hour >= 12 && hour < 16) return 'admin.home.greeting.noon';
  if (hour >= 16 && hour < 20) return 'admin.home.greeting.evening';
  return 'admin.home.greeting.night';
}

export type TrendDay = { key: DateKey; count: number };

/** Requests per Tehran day for the last `days` days, oldest first, today last. */
export function trendDays(createdAts: readonly string[], now: Date, days = TREND_DAYS): TrendDay[] {
  const today = zonedDateKey(now, CLINIC_TZ);
  const out = Array.from({ length: days }, (_, i) => ({
    key: addDaysToKey(today, i - days + 1),
    count: 0,
  }));
  const index = new Map(out.map((day, i) => [day.key, i]));
  for (const at of createdAts) {
    const i = index.get(zonedDateKey(new Date(at), CLINIC_TZ));
    if (i !== undefined) out[i]!.count += 1;
  }
  return out;
}

/**
 * One read of createdAt alone (indexed, no personal data) for the real requests of the last
 * seven Tehran days. Access is overridden: callers check isVerifiedStaff first.
 */
export async function loadTrend(payload: Payload, now: Date): Promise<TrendDay[]> {
  const first = tehranDayStart(new Date(now.getTime() - (TREND_DAYS - 1) * 86_400_000));
  const { docs } = await payload.find({
    collection: 'bookings',
    where: { and: [since(first), real] },
    select: { createdAt: true },
    sort: '-createdAt',
    limit: TREND_CAP,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  return trendDays(
    docs.map((doc) => doc.createdAt),
    now,
  );
}

type QuickAction = { href: string; label: string; primary?: boolean };

/** The same links the navigation offers each role (CalendarNavLink, SystemStatusNavLink). */
export function quickActions(user: unknown, canWriteArticles: boolean): QuickAction[] {
  const actions: QuickAction[] = [];
  if (!hasRole(user as object, 'admin', 'editor')) return actions;
  actions.push({
    href: listHref(cond(0, 'status', 'equals', ['new']), 'callbackDueAt'),
    label: adminText('admin.home.action.bookings'),
    primary: true,
  });
  if (canWriteArticles) {
    actions.push({
      href: `${ADMIN_ROUTE}/collections/articles/create`,
      label: adminText('admin.home.action.article'),
    });
  }
  actions.push({ href: CALENDAR_PATH, label: adminText('admin.calendar.title') });
  if (hasRole(user as object, 'admin')) {
    actions.push({
      href: `${ADMIN_ROUTE}/system-status`,
      label: adminText('admin.home.action.status'),
    });
  }
  return actions;
}
