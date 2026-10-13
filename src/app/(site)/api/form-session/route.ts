import type { NextRequest } from 'next/server';

import { readEnv } from '@/lib/env';
import { clientIpFrom, rateLimitKey } from '@/lib/http/clientIp';
import { createRateLimiter } from '@/lib/http/rateLimit';

import { loadClinicHours } from './clinicHoursStub';
import { createFormSessionHandler, FORM_SESSION_RATE } from './handler';

// Reads a cookie and the query on every request; never cached (the response says no-store too).
export const dynamic = 'force-dynamic';

const handler = createFormSessionHandler({
  env: readEnv,
  loadHours: loadClinicHours,
  limiter: createRateLimiter(FORM_SESSION_RATE),
  clientKey: (headers) => rateLimitKey(clientIpFrom(headers, readEnv())),
  now: Date.now,
});

export async function GET(request: NextRequest): Promise<Response> {
  return handler(request);
}
