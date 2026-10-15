import type { NextRequest } from 'next/server';

import { hoursOptionsFrom, toClinicHours } from '@/lib/data/clinicHours';
import { getClinic } from '@/lib/data/globals';
import { readEnv } from '@/lib/env';
import { clientIpFrom, rateLimitKey } from '@/lib/http/clientIp';
import { createRateLimiter } from '@/lib/http/rateLimit';

import { createFormSessionHandler, FORM_SESSION_RATE, type FormSessionLimiter } from './handler';

// Reads a cookie and the query on every request; never cached (the response says no-store too).
export const dynamic = 'force-dynamic';

// Built on the first request: the limit comes from the environment, which the build lacks.
let limiter: FormSessionLimiter | undefined;

const handler = createFormSessionHandler({
  env: readEnv,
  loadHours: async () => {
    const clinic = await getClinic();
    return { hours: toClinicHours(clinic), options: hoursOptionsFrom(clinic) };
  },
  limiter: {
    hit: (key, nowMs) =>
      (limiter ??= createRateLimiter({
        ...FORM_SESSION_RATE,
        limit: readEnv().formSessionRateLimit,
      })).hit(key, nowMs),
  },
  clientKey: (headers) => rateLimitKey(clientIpFrom(headers, readEnv())),
  now: Date.now,
});

export async function GET(request: NextRequest): Promise<Response> {
  return handler(request);
}
