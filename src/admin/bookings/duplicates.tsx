import type { ArrayFieldServerProps } from 'payload';

import { adminText } from '@/i18n/fa-admin';

import styles from './bookings.module.css';

/**
 * afterInput of «درخواست‌های تکراری»: a read-only array without rows renders its heading and
 * nothing else, so say it is empty.
 */
export function DuplicatesEmpty({ data }: ArrayFieldServerProps) {
  const rows = (data as { duplicateSubmissions?: unknown } | undefined)?.duplicateSubmissions;
  if (Array.isArray(rows) && rows.length > 0) return null;
  return <p className={styles.empty}>{adminText('admin.duplicates.empty')}</p>;
}
