import { getPayloadClient } from '@/lib/data/payload';
import { readEnv } from '@/lib/env';
import { isCronCaller } from '@/lib/http/auth';
import { runCronTick, type CronSummary } from '@/lib/http/cron';
import { logFor } from '@/lib/log/logger';

// Called every minute by the platform cron with `Authorization: Bearer CRON_SECRET` (spec 11.3).
// Overlapping calls in this process share the running tick instead of starting a second one.
// shortcut: two processes (old and new release during a switch) can still tick together; jobs
// are claimed by Payload's `processing` flag and schedulePublish is idempotent. Add a database
// lease if a non-idempotent task is added.
let running: Promise<CronSummary> | null = null;

const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  if (!isCronCaller(request.headers, readEnv().cronSecret)) {
    return new Response(null, {
      status: 401,
      headers: { ...headers, 'WWW-Authenticate': 'Bearer' },
    });
  }
  running ??= getPayloadClient()
    .then((payload) => runCronTick(payload))
    .finally(() => {
      running = null;
    });
  try {
    return Response.json(await running, { headers });
  } catch (err) {
    const reqId = request.headers.get('x-request-id') ?? undefined;
    logFor(reqId, '/api/cron/tick').error({ msg: 'cron_tick_failed', err });
    return Response.json(
      { error: 'cron tick failed; see the server log' },
      { status: 500, headers },
    );
  }
}
