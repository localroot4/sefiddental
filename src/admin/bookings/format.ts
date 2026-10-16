import { adminText } from '@/i18n/fa-admin';
import { formatJalali, formatTimeFa } from '@/lib/jalali';
import { formatNumberFa } from '@/lib/persianText';

/** «۲۳ مهر، ۱۰:۱۲», Tehran time; the date pickers stay Gregorian (C-6). */
export function dayTime(value: unknown): string | null {
  const at = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  return adminText('admin.cell.dayTime', {
    date: formatJalali(at, 'd MMMM'),
    time: formatTimeFa(at),
  });
}

/** Still waiting for the first call after its due time (the list's red «گذشته»). */
export function isOverdue(status: unknown, due: unknown, now = new Date()): boolean {
  const at = typeof due === 'string' ? Date.parse(due) : NaN;
  return status === 'new' && at <= now.getTime();
}

/** «۲ درخواست هرزنامه شد. ۱ درخواست با وضعیت فعلی‌اش هرزنامه نمی‌شود.» */
export function bulkSpamMessage(done: number, refused: number): string {
  const parts = [];
  if (done > 0 || refused === 0) {
    parts.push(adminText('admin.bulk.done', { n: formatNumberFa(done) }));
  }
  if (refused > 0) parts.push(adminText('admin.bulk.refused', { m: formatNumberFa(refused) }));
  return parts.join(' ');
}

type RestErrorBody = {
  message?: string;
  errors?: Array<{ message?: string; data?: { errors?: Array<{ message?: string }> } }>;
} | null;

/** A failed REST call's own message (a field's Persian error first), else the network line. */
export function errorMessage(body: unknown): string {
  const first = (body as RestErrorBody)?.errors?.[0];
  return (
    first?.data?.errors?.[0]?.message ??
    first?.message ??
    (body as RestErrorBody)?.message ??
    adminText('admin.network')
  );
}
