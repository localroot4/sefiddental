import { cachedRead } from '@/lib/data/cache';
import { hoursOptionsFrom, toClinicHours } from '@/lib/data/clinicHours';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPayloadClient } from '@/lib/data/payload';
import { colTag } from '@/lib/data/tags';
import { readEnv } from '@/lib/env';
import { incrementEventDaily } from '@/lib/events/increment';
import { log } from '@/lib/log/logger';
import { notifier } from '@/lib/notify';

import type { BookingHandlerDeps, EmergencyHandlerDeps, FormHandlerDeps } from './handler';
import type { Catalog } from './request';
import { payloadBookingStore } from './store';

/** The real dependencies of the two form routes (server only). */

type Id = number | string;
const published = { _status: { equals: 'published' } } as const;

/** Published service keys, tier keys per service and doctor slugs; rows, so the cache can store them. */
const catalogRows = () =>
  cachedRead(
    'bookingCatalog',
    null,
    [colTag('services'), colTag('service-tiers'), colTag('doctors')],
    async () => {
      const payload = await getPayloadClient();
      const find = <S extends 'services' | 'service-tiers' | 'doctors'>(collection: S) =>
        payload.find({ collection, where: published, depth: 0, pagination: false });
      const [services, tiers, doctors] = await Promise.all([
        find('services'),
        find('service-tiers'),
        find('doctors'),
      ]);
      const keyOf = new Map<Id, string>(services.docs.map((s) => [s.id, s.key]));
      return {
        services: services.docs.map((s): [string, Id] => [s.key, s.id]),
        tiers: tiers.docs.flatMap((tier): Array<[string, string]> => {
          const service = keyOf.get(
            typeof tier.service === 'object' ? tier.service.id : tier.service,
          );
          return service ? [[service, tier.key]] : [];
        }),
        doctors: doctors.docs.map((d): [string, Id] => [d.slug, d.id]),
      };
    },
  );

async function loadCatalog(): Promise<Catalog> {
  const rows = await catalogRows();
  const tiers = new Map<string, Set<string>>();
  for (const [service, tier] of rows.tiers)
    tiers.set(service, (tiers.get(service) ?? new Set()).add(tier));
  return { services: new Map(rows.services), tiers, doctors: new Map(rows.doctors) };
}

const common: FormHandlerDeps = {
  env: readEnv,
  store: payloadBookingStore(getPayloadClient),
  loadHours: async () => {
    const clinic = await getClinic();
    return { hours: toClinicHours(clinic), options: hoursOptionsFrom(clinic) };
  },
  notify: (event) => notifier.notify(event),
  countEvent: async (row) => incrementEventDaily(await getPayloadClient(), row),
  logger: log,
  now: Date.now,
};

export const bookingDeps: BookingHandlerDeps = { ...common, catalog: loadCatalog };

export const emergencyDeps: EmergencyHandlerDeps = {
  ...common,
  emergencyEnabled: async () => (await getFeatures()).emergencyEnabled !== false,
};
