import type { Payload, PayloadRequest, Where } from 'payload';
import { totpAccess } from 'payload-totp';

import { hasRole } from '@/access/roles';
import {
  CLINIC_TZ,
  formatJalali,
  jalaliToDateKey,
  zonedDateKey,
  zonedWallTimeToInstant,
} from '@/lib/jalali';
import { log } from '@/lib/log/logger';
import { toLatinDigits } from '@/lib/persianText';

/** Tehran midnight of `now`: "today" for the clinic, whatever the server's zone. */
export function tehranDayStart(now: Date): Date {
  return zonedWallTimeToInstant(zonedDateKey(now, CLINIC_TZ), '00:00', CLINIC_TZ);
}

/** Tehran midnight of the first day of the Jalali month of `now` ("this month", R-10). */
export function tehranMonthStart(now: Date): Date {
  const [year, month] = toLatinDigits(formatJalali(now, 'yyyy/MM/dd')).split('/');
  const first = jalaliToDateKey(`${year}/${month}/01`);
  if (!first) throw new RangeError('tehranMonthStart: no first day');
  return zonedWallTimeToInstant(first, '00:00', CLINIC_TZ);
}

const real: Where = { status: { not_in: ['suspicious', 'spam'] } };
const emergency: Where = { kind: { equals: 'emergency' } };
const since = (start: Date): Where => ({ createdAt: { greater_than_equal: start.toISOString() } });

/** Every number the tabs and the dashboard show, as a filter on bookings (admin-notify.md 4.9). */
const QUERIES = {
  newToday: (now: Date) => ({ and: [since(tehranDayStart(now)), real] }),
  emergencyToday: (now: Date) => ({ and: [since(tehranDayStart(now)), real, emergency] }),
  waiting: () => ({ status: { equals: 'new' } }),
  overdue: (now: Date): Where => ({
    and: [{ status: { equals: 'new' } }, { callbackDueAt: { less_than_equal: now.toISOString() } }],
  }),
  openEmergency: () => ({ and: [emergency, { status: { in: ['new', 'contacted'] } }] }),
  suspiciousToday: (now: Date) => ({
    and: [since(tehranDayStart(now)), { status: { equals: 'suspicious' } }],
  }),
  // R-10: this month's emergencies marked «فوری نبود», over those with any outcome.
  notUrgentMonth: (now: Date) => ({
    and: [since(tehranMonthStart(now)), emergency, { emergencyOutcome: { equals: 'not_urgent' } }],
  }),
  outcomeMonth: (now: Date) => ({
    and: [since(tehranMonthStart(now)), emergency, { emergencyOutcome: { exists: true } }],
  }),
} satisfies Record<string, (now: Date) => Where>;

export type CountName = keyof typeof QUERIES;
export const COUNT_NAMES = Object.keys(QUERIES) as CountName[];

const staff = totpAccess(({ req }: { req: PayloadRequest }) =>
  hasRole(req.user, 'admin', 'editor'),
);

/**
 * Staff whose session entered its TOTP code. The slots that show counts get `payload` and `user`
 * but no `req`; totpAccess reads only those two.
 */
export async function isVerifiedStaff(payload: Payload, user: unknown): Promise<boolean> {
  return (await staff({ req: { payload, user } as unknown as PayloadRequest })) === true;
}

/**
 * The named counts only (each one query, run together), no personal data, read with access
 * overridden: callers check isVerifiedStaff first, as SystemStatusView checks its role. Suspicious and spam rows
 * are not real requests (R-6).
 */
export async function bookingCounts<K extends CountName>(
  payload: Payload,
  names: readonly K[],
  now = new Date(),
): Promise<Record<K, number | null>> {
  const values = await Promise.all(
    names.map(async (name) => {
      try {
        const where = QUERIES[name](now);
        return (await payload.count({ collection: 'bookings', where, overrideAccess: true }))
          .totalDocs;
      } catch (err) {
        log.warn({ msg: 'booking_count_failed', count: name, err });
        return null;
      }
    }),
  );
  return Object.fromEntries(names.map((name, i) => [name, values[i]])) as Record<K, number | null>;
}
