import type { DataFromGlobalSlug } from 'payload';

import type { ClinicHours, HoursOptions, HoursOverride, Weekday } from '@/lib/hoursState';
import type { DateKey } from '@/lib/jalali';

type Clinic = DataFromGlobalSlug<'clinic'>;

/** The clinic global's hours in the shape `hoursState` reads (freeze 3.6). */
export function toClinicHours(clinic: Clinic): ClinicHours {
  const hours = clinic.hours;
  return {
    timezone: 'Asia/Tehran',
    weekly: (hours?.weekly ?? []).map((rule) => ({
      days: (rule.days ?? []) as Weekday[],
      open: rule.open,
      close: rule.close,
    })),
    // A row whose Jalali date did not convert has no `date` and is left out.
    holidays: (hours?.holidays ?? []).flatMap((row): HoursOverride[] => {
      if (!row.date) return [];
      const override: HoursOverride = { date: row.date as DateKey };
      if (row.labelFa) override.labelFa = row.labelFa;
      if (row.open && row.close) {
        override.open = row.open;
        override.close = row.close;
      }
      return [override];
    }),
    noteFa: hours?.note ?? '',
  };
}

export function hoursOptionsFrom(clinic: Clinic): HoursOptions {
  return { callbackMinutes: clinic.reception?.callbackMinutes ?? 10 };
}
