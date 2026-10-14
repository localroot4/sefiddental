import { z } from 'zod';

import { getPayloadClient } from '@/lib/data/payload';
import { readEnv } from '@/lib/env';
import { normalizeEvent, type EventRow } from '@/lib/events/allowlist';
import { getServiceKeys, incrementEventDaily } from '@/lib/events/increment';
import { checkFetchOrigin } from '@/lib/formTokens';
import { parseJson, readTextCapped } from '@/lib/http/body';
import { clientIpFrom, rateLimitKey } from '@/lib/http/clientIp';
import { createRateLimiter } from '@/lib/http/rateLimit';
import { zonedDateKey } from '@/lib/jalali';
import { logFor } from '@/lib/log/logger';

// Spec 11.2: first-party measurement beacons. No cookie is read or set, no IP is stored or
// logged: the client key only names an in-memory rate-limit bucket.
const MAX_BYTES = 2048;
const perClient = createRateLimiter({ limit: 60, windowMs: 60_000 });
// Process-wide cap that protects the database whatever the client keys are.
const perProcess = createRateLimiter({ limit: 3000, windowMs: 60_000, maxKeys: 1 });

// Unknown names and values are mapped by normalizeEvent; extra keys are dropped (GA4 only).
const eventSchema = z.object({
  event: z.string().max(64),
  location: z.string().max(64).nullish(),
  pageType: z.string().max(64).nullish(),
  serviceKey: z.string().max(128).nullish(),
});
const bodySchema = z.union([eventSchema, z.array(eventSchema).min(1).max(10)]);

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function POST(request: Request): Promise<Response> {
  const env = readEnv();
  const origin = checkFetchOrigin({
    secFetchSite: request.headers.get('sec-fetch-site'),
    origin: request.headers.get('origin'),
    baseOrigin: new URL(env.siteUrl).origin,
  });
  if (origin === 'reject') return empty(403);

  // Any content type: sendBeacon sends text/plain, fetch may send application/json.
  const text = await readTextCapped(request, MAX_BYTES);
  if (text === null) return empty(413);
  const parsed = bodySchema.safeParse(parseJson(text));
  if (!parsed.success) return empty(400);
  const events = Array.isArray(parsed.data) ? parsed.data : [parsed.data];

  // The limit counts events, not requests: a batch of 10 uses 10.
  const now = Date.now();
  const key = rateLimitKey(clientIpFrom(request.headers, env));
  for (let i = 0; i < events.length; i += 1) {
    const verdict = perClient.hit(key, now);
    const global = verdict.ok ? perProcess.hit('all', now) : verdict;
    if (!global.ok) return empty(429, { 'Retry-After': String(global.retryAfterSec) });
  }

  const date = zonedDateKey(new Date());
  const serviceKeys = await getServiceKeys();
  const rows = events
    .map((raw) => normalizeEvent(raw, date, serviceKeys))
    .filter((row): row is EventRow => row !== null);
  if (rows.length < events.length) {
    logFor(request.headers.get('x-request-id') ?? undefined, '/api/events').debug({
      msg: 'event_dropped',
      count: events.length - rows.length,
    });
  }
  if (rows.length > 0) {
    const payload = await getPayloadClient();
    // One atomic upsert per event; sequential keeps one connection per beacon.
    for (const row of rows) await incrementEventDaily(payload, row);
  }
  return empty(204);
}
