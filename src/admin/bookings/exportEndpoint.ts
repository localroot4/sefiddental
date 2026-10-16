import { APIError, type PayloadHandler, type PayloadRequest, type Where } from 'payload';
import { mergeListSearchAndWhere } from 'payload/shared';
import { totpAccess } from 'payload-totp';

import { hasRole } from '@/access/roles';
import { writeAudit } from '@/hooks/audit';
import { adminText } from '@/i18n/fa-admin';
import { formatJalali, formatTimeFa } from '@/lib/jalali';
import { formatNumberFa, toLatinDigits } from '@/lib/persianText';

import { bookingsCsv, CSV_MAX_ROWS } from './csv';

// Custom endpoints are not wrapped by payload-totp: the check is explicit (as SystemStatusView).
const verifiedAdmin = totpAccess(({ req }: { req: PayloadRequest }) => hasRole(req.user, 'admin'));

/** Field paths of a filter, never its values (a phone search is a value). */
function wherePaths(where: unknown, out = new Set<string>()): string[] {
  if (Array.isArray(where)) for (const item of where) wherePaths(item, out);
  else if (where && typeof where === 'object') {
    for (const [key, value] of Object.entries(where)) {
      if (key === 'and' || key === 'or') wherePaths(value, out);
      else out.add(key);
    }
  }
  return [...out].sort();
}

/**
 * A date condition whose value is not a date. The database adapter drops such a value and the
 * query then fails as a server error, so the filter is refused first.
 */
function hasBadDate(where: unknown, dates: ReadonlySet<string>): boolean {
  if (Array.isArray(where)) return where.some((item) => hasBadDate(item, dates));
  if (!where || typeof where !== 'object') return false;
  return Object.entries(where).some(([key, value]) => {
    if (key === 'and' || key === 'or') return hasBadDate(value, dates);
    if (!dates.has(key) || !value || typeof value !== 'object') return false;
    return Object.entries(value).some(
      ([op, operand]) =>
        op !== 'exists' && [operand].flat().some((d) => Number.isNaN(Date.parse(String(d)))),
    );
  });
}

const json = (message: string, status: number) =>
  Response.json({ message }, { status, headers: { 'Cache-Control': 'no-store' } });

/**
 * GET /api/bookings/export?where…&search… (D-8): the list's current filter as a CSV, for a
 * TOTP-verified admin only, at most CSV_MAX_ROWS rows, never stored on the server. One audit
 * row names the count and the filtered field paths; without it there is no file.
 */
export const exportBookingsCsv: PayloadHandler = async (req) => {
  if ((await verifiedAdmin({ req })) !== true) {
    return json(adminText('admin.csv.forbidden'), 403);
  }
  const collection = req.payload.collections.bookings.config;
  const query = (req.query ?? {}) as { where?: Where; search?: unknown };
  const where = mergeListSearchAndWhere({
    collectionConfig: collection,
    search: typeof query.search === 'string' ? query.search : '',
    where: query.where && typeof query.where === 'object' ? query.where : {},
  });
  const dates = new Set(
    collection.flattenedFields.filter((f) => f.type === 'date').map((f) => f.name),
  );
  if (hasBadDate(where, dates)) return json(adminText('admin.csv.badFilter'), 400);

  let result;
  try {
    result = await req.payload.find({
      collection: 'bookings',
      where,
      sort: ['urgencyRank', '-createdAt'],
      limit: CSV_MAX_ROWS,
      depth: 1,
      populate: { services: { navLabel: true }, doctors: { name: true }, users: { name: true } },
      overrideAccess: false,
      user: req.user,
      req,
    });
  } catch (error) {
    // A filter Payload refuses (QueryError for an unknown field, or another 4xx) is the user's.
    if (error instanceof APIError && error.status < 500) {
      return json(adminText('admin.csv.badFilter'), 400);
    }
    throw error;
  }
  if (result.totalDocs > CSV_MAX_ROWS) return json(adminText('admin.csv.tooMany'), 400);

  const paths = wherePaths(where);
  // No file leaves without its audit row (D-8): writeAudit logs its own failure.
  const audited = await writeAudit(req, {
    action: 'export',
    entityType: 'collection',
    entitySlug: 'bookings',
    note: [
      adminText('admin.csv.audit', { n: formatNumberFa(result.docs.length) }),
      ...(paths.length ? [adminText('admin.csv.auditFilter', { fields: paths.join('، ') })] : []),
    ].join('؛ '),
  });
  if (!audited) return json(adminText('admin.csv.auditFailed'), 500);

  // Tehran Jalali date and time, ASCII only: bookings-1405-07-24-1012.csv
  const now = new Date();
  const date = toLatinDigits(formatJalali(now, 'yyyy/MM/dd')).replaceAll('/', '-');
  const time = toLatinDigits(formatTimeFa(now)).replace(':', '');
  const rows = result.docs as unknown as Array<Record<string, unknown>>;
  return new Response(bookingsCsv(rows, collection.flattenedFields), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookings-${date}-${time}.csv"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
