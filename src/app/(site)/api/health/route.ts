import { getPayloadClient } from '@/lib/data/payload';
import { readEnv } from '@/lib/env';
import { createDatabaseHealth } from '@/lib/http/health';

// Spec 11.1, critic W11: the database answers within 2000 ms or the site is down. The probe is
// memoized for 5 s, so this public endpoint cannot be used to load the database.
const checkDatabase = createDatabaseHealth({
  probe: async () =>
    (await getPayloadClient()).count({ collection: 'users', overrideAccess: true }),
});

async function health(): Promise<{ status: number; body: string }> {
  const database = await checkDatabase();
  const ok = database.status === 'ok';
  // Public body: no Node version, host names, env names or counts (those are admin-only).
  const body = {
    status: ok ? 'ok' : 'down',
    time: new Date().toISOString(),
    version: readEnv().gitSha,
    uptimeSeconds: Math.round(process.uptime()),
    maintenance: readEnv().maintenance,
    checks: { database: { status: database.status, latencyMs: database.latencyMs } },
  };
  return { status: ok ? 200 : 503, body: JSON.stringify(body) };
}

const headers = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export async function GET(): Promise<Response> {
  const { status, body } = await health();
  return new Response(body, { status, headers });
}

export async function HEAD(): Promise<Response> {
  const { status } = await health();
  return new Response(null, { status, headers });
}
