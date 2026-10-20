'use client';

import { useFormFields } from '@payloadcms/ui';
import type { DefaultCellComponentProps } from 'payload';

import { adminText } from '@/i18n/fa-admin';
import { formatJalali, formatTimeFa } from '@/lib/jalali';

/** «۲۶ مهر ۱۴۰۵، ۱۰:۱۲», Tehran time; null for an empty or broken value. */
export function jalaliDateTime(value: unknown): string | null {
  const at = typeof value === 'string' || value instanceof Date ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) return null;
  return adminText('admin.cell.dayTime', {
    date: formatJalali(at, 'd MMMM yyyy'),
    time: formatTimeFa(at),
  });
}

/**
 * H35: a date column in Jalali for the editor's lists (the pickers stay Gregorian, G15). Same
 * shape as the bookings cells; the year is shown because these lists span years.
 */
export function JalaliDateCell({ cellData }: DefaultCellComponentProps) {
  const text = jalaliDateTime(cellData);
  return text ? <span>{text}</span> : null;
}

/** H35: under a Gregorian date picker, the chosen date in Jalali as the editor types. */
export function JalaliDateHint({ path }: { path: string }) {
  const value = useFormFields(([fields]) => fields[path]?.value);
  const text = jalaliDateTime(value);
  return text ? (
    <p className="field-description">{adminText('admin.date.hint', { date: text })}</p>
  ) : null;
}
