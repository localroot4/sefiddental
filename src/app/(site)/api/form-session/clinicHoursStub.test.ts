import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { clinicHoursSchema } from '@/lib/hoursState';

import { loadClinicHours } from './clinicHoursStub';

const LANE_D_MODULE = fileURLToPath(
  new URL('../../../../lib/data/clinicHours.ts', import.meta.url),
);

describe('clinic hours stub (deleted at the Lane D merge)', () => {
  it('FS-STUB1 the stub returns a valid schedule', async () => {
    const { hours } = await loadClinicHours();
    expect(clinicHoursSchema.parse(hours)).toEqual(hours);
  });

  it('FS-STUB2 tripwire: Lane D has not landed src/lib/data/clinicHours.ts yet', () => {
    expect(
      existsSync(LANE_D_MODULE),
      'Lane D landed: delete clinicHoursStub.ts and this test, and wire route.ts to getClinic, toClinicHours and hoursOptionsFrom (see the stub header)',
    ).toBe(false);
  });
});
