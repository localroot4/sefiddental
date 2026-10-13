import type { ClinicHours, HoursOptions } from '@/lib/hoursState';

/**
 * Local stub of the clinic hours read (Lane D, freeze 3.6 and 3.10), so the endpoint runs before
 * Lane D merges. It returns the docs/content/clinic.yaml seed schedule; admin holidays are not
 * seen until the swap. At merge (clinicHoursStub.test.ts turns red when
 * src/lib/data/clinicHours.ts exists): delete this file and its test, and in route.ts use
 *
 *   loadHours: async () => {
 *     const clinic = await getClinic(); // '@/lib/data/globals'
 *     return { hours: toClinicHours(clinic), options: hoursOptionsFrom(clinic) }; // '@/lib/data/clinicHours'
 *   },
 */
export async function loadClinicHours(): Promise<{ hours: ClinicHours; options: HoursOptions }> {
  return {
    hours: {
      timezone: 'Asia/Tehran',
      weekly: [
        { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
      ],
      holidays: [],
      noteFa: 'همه\u200Cروزه به\u200Cجز روزهای تعطیل رسمی',
    },
    options: { callbackMinutes: 10 },
  };
}
