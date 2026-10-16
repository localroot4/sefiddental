import { statfs } from 'node:fs/promises';
import path from 'node:path';

import type { Payload, Where } from 'payload';

import { FORM_SESSION_RATE } from '@/app/(site)/api/form-session/handler';
import { getContentGaps, type ContentGapsReport } from '@/content-gaps/registry';
import type { DbKind, ServerEnv } from '@/lib/env';
import { clientIpFrom } from '@/lib/http/clientIp';
import { withTimeout } from '@/lib/http/health';
import { log } from '@/lib/log/logger';
import { readyChannels } from '@/lib/notify/drivers';
import { readNotifierSettings } from '@/lib/notify/task';
import { processStartedAt, warnLines } from '@/lib/log/ringBuffer';
import { migrations as postgresMigrations } from '@/migrations/postgres';
import { migrations as sqliteMigrations } from '@/migrations/sqlite';

/*
 * Everything the System status view shows (spec 13.3), read server-side with the Local API.
 * Each database read is independent: a failed read becomes null («نامشخص» in the view), never 0.
 * No secret or personal value is read: settings are shown as on/off, log lines are redacted.
 */

export interface FailedJob {
  id: number | string;
  task: string;
  message: string;
  tries: number;
  at: string;
}

/** A Notifier channel: its switch, and whether it can actually send (switch, env, recipients). */
export interface ChannelState {
  on: boolean;
  ready: boolean;
}

export interface LogLine {
  time: string;
  level: string;
  msg: string;
}

export interface SystemStatusData {
  generatedAt: string;
  runtime: {
    node: string;
    nodeEnv: string;
    uptimeSeconds: number;
    startedAt: string;
    rssBytes: number;
  };
  version: { gitSha: string; buildTime: string | null };
  database: {
    adapter: DbKind;
    reachable: boolean;
    latencyMs: number | null;
    migrations: { applied: number; newest: string | null; pending: string[] } | null;
  };
  jobs: {
    queued: number | null;
    processing: number | null;
    stuck: number | null;
    failed: FailedJob[] | null;
    lastCron: {
      at: string | null;
      ranJobs: number | null;
      failed: number | null;
      durationMs: number | null;
      error: string | null;
    } | null;
  };
  media: {
    storage: 's3' | 'local';
    files: number | null;
    bytes: number | null;
    freeBytes: number | null;
  };
  config: {
    siteUrl: string;
    allowIndexing: boolean;
    maintenance: boolean;
    cspMode: ServerEnv['cspMode'];
    cspAdminMode: ServerEnv['cspAdminMode'];
    trustProxyHeaders: boolean;
    /** This request's client address was read from the proxy headers (S2, review 3). */
    clientIpKnown: boolean;
    smtp: boolean;
    /** Names of the test-only settings that change behaviour (deploy.md 2.3, S12). */
    testOnly: string[];
  };
  /** admin-notify.md 9.10: on or off and ready or not, never a value. */
  notifier: { mail: ChannelState; telegram: ChannelState; sms: ChannelState } | null;
  lastSeedAt: string | null;
  gaps: ContentGapsReport | null;
  logs: LogLine[];
}

const DB_TIMEOUT_MS = 2000;
const STUCK_AFTER_MS = 10 * 60_000;
const FAILED_WINDOW_MS = 7 * 24 * 60 * 60_000;
const MESSAGE_MAX = 200;
const LOG_LINES = 50;

/** One read; on failure a warn line and null, so one broken source never hides the others. */
async function known<T>(source: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await withTimeout(read(), DB_TIMEOUT_MS);
  } catch (err) {
    log.warn({ msg: 'system_status_read_failed', source, err });
    return null;
  }
}

function errorMessage(error: unknown): string {
  const text =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : JSON.stringify(error ?? '');
  return text.slice(0, MESSAGE_MAX);
}

/** Test-only settings in effect; a rate limit equal to its default 60 changes nothing. */
export function testOnlySettings(
  env: Pick<ServerEnv, 'qaRoutes' | 'formSessionRateLimit'>,
): string[] {
  return [
    ...(env.qaRoutes ? ['QA_ROUTES'] : []),
    ...(env.formSessionRateLimit !== FORM_SESSION_RATE.limit ? ['FORM_SESSION_RATE_LIMIT'] : []),
  ];
}

/** Warn and error lines of this process, newest first, without fields beyond time, level, msg. */
export function recentLogLines(lines: readonly string[], max = LOG_LINES): LogLine[] {
  return lines.slice(0, max).flatMap((line) => {
    try {
      const { time, level, msg } = JSON.parse(line) as Record<string, unknown>;
      return [{ time: String(time ?? ''), level: String(level ?? ''), msg: String(msg ?? '') }];
    } catch {
      return [];
    }
  });
}

async function jobCount(payload: Payload, where: Where): Promise<number> {
  const result = await payload.count({ collection: 'payload-jobs', where, overrideAccess: true });
  return result.totalDocs;
}

async function migrationState(payload: Payload, adapter: DbKind) {
  const rows = await payload.find({
    collection: 'payload-migrations',
    sort: '-createdAt',
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  // Batch -1 is Drizzle push on a development database, not a migration.
  const applied = rows.docs.filter((row) => row.batch !== -1);
  const names = new Set(applied.map((row) => row.name));
  const bundled = adapter === 'postgres' ? postgresMigrations : sqliteMigrations;
  return {
    applied: applied.length,
    newest: applied[0]?.name ?? null,
    pending: bundled.map((m) => m.name).filter((name) => !names.has(name)),
  };
}

async function mediaUsage(payload: Payload): Promise<{ files: number; bytes: number }> {
  // shortcut: sums every media row in memory; switch to a SQL aggregate past a few thousand files.
  const result = await payload.find({
    collection: 'media',
    select: { filesize: true, sizes: true },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  });
  let bytes = 0;
  for (const doc of result.docs) {
    bytes += doc.filesize ?? 0;
    for (const size of Object.values(doc.sizes ?? {})) {
      bytes += (size as { filesize?: number | null } | null)?.filesize ?? 0;
    }
  }
  return { files: result.docs.length, bytes };
}

/** Free space of the disk that holds `dir`; before the first upload the folder may not exist. */
async function freeDiskBytes(dir: string): Promise<number> {
  try {
    const stats = await statfs(dir);
    return stats.bavail * stats.bsize;
  } catch (err) {
    const parent = path.dirname(dir);
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT' || parent === dir) throw err;
    return freeDiskBytes(parent);
  }
}

export async function collectSystemStatus(
  payload: Payload,
  env: ServerEnv,
  headers: Headers,
  now: Date = new Date(),
): Promise<SystemStatusData> {
  const nowMs = now.getTime();
  const notDone: Where[] = [{ completedAt: { exists: false } }, { hasError: { not_equals: true } }];

  const [
    latencyMs,
    migrations,
    queued,
    processing,
    stuck,
    failedRows,
    state,
    media,
    freeBytes,
    seed,
    gaps,
    notifier,
  ] = await Promise.all([
    known('database', async () => {
      const t0 = Date.now();
      await payload.count({ collection: 'users', overrideAccess: true });
      return Date.now() - t0;
    }),
    known('migrations', () => migrationState(payload, env.dbKind)),
    known('jobs.queued', () =>
      jobCount(payload, { and: [...notDone, { processing: { equals: false } }] }),
    ),
    known('jobs.processing', () => jobCount(payload, { processing: { equals: true } })),
    known('jobs.stuck', () =>
      jobCount(payload, {
        and: [
          { processing: { equals: true } },
          { updatedAt: { less_than: new Date(nowMs - STUCK_AFTER_MS).toISOString() } },
        ],
      }),
    ),
    known('jobs.failed', () =>
      payload.find({
        collection: 'payload-jobs',
        where: {
          and: [
            { hasError: { equals: true } },
            { updatedAt: { greater_than: new Date(nowMs - FAILED_WINDOW_MS).toISOString() } },
          ],
        },
        sort: '-updatedAt',
        limit: 20,
        depth: 0,
        overrideAccess: true,
      }),
    ),
    known('system-state', () =>
      payload.findGlobal({ slug: 'system-state', depth: 0, overrideAccess: true }),
    ),
    known('media', () => mediaUsage(payload)),
    env.s3 ? Promise.resolve(null) : known('media.disk', () => freeDiskBytes(env.mediaDir)),
    known('seed', () =>
      payload.find({
        collection: 'audit-log',
        where: { action: { equals: 'seed' } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      }),
    ),
    known('content-gaps', () => getContentGaps(payload)),
    known('notifier', () => readNotifierSettings(payload)),
  ]);
  // A booking reaches every channel the clinic receives on.
  const ready = notifier ? readyChannels(notifier, env, { type: 'booking', bookingId: 0 }) : [];
  // Failed jobs name their task by its label («ارسال اعلان» for the Notifier).
  const taskLabel = (slug: string | null | undefined) =>
    payload.config.jobs?.tasks?.find((task) => task.slug === slug)?.label ?? slug ?? 'نامشخص';

  return {
    generatedAt: now.toISOString(),
    runtime: {
      node: process.version,
      nodeEnv: env.nodeEnv,
      uptimeSeconds: Math.round(process.uptime()),
      startedAt: processStartedAt,
      rssBytes: process.memoryUsage().rss,
    },
    version: { gitSha: env.gitSha, buildTime: env.buildTime },
    database: {
      adapter: env.dbKind,
      reachable: latencyMs !== null,
      latencyMs,
      migrations,
    },
    jobs: {
      queued,
      processing,
      stuck,
      failed:
        failedRows?.docs.map((job) => ({
          id: job.id,
          task: taskLabel(job.taskSlug),
          message: errorMessage(job.error),
          tries: job.totalTried ?? 0,
          at: job.updatedAt,
        })) ?? null,
      lastCron: state
        ? {
            at: state.lastCronRunAt ?? null,
            ranJobs: state.lastCronRanJobs ?? null,
            failed: state.lastCronFailed ?? null,
            durationMs: state.lastCronDurationMs ?? null,
            error: state.lastCronError ?? null,
          }
        : null,
    },
    media: {
      storage: env.s3 ? 's3' : 'local',
      files: media?.files ?? null,
      bytes: media?.bytes ?? null,
      freeBytes,
    },
    config: {
      siteUrl: env.siteUrl,
      allowIndexing: env.allowIndexing,
      maintenance: env.maintenance,
      cspMode: env.cspMode,
      cspAdminMode: env.cspAdminMode,
      trustProxyHeaders: env.trustProxyHeaders,
      // The admin's request takes the visitors' proxy chain: unreadable here, unreadable there.
      clientIpKnown: clientIpFrom(headers, env) !== null,
      smtp: env.smtp !== null,
      testOnly: testOnlySettings(env),
    },
    notifier: notifier
      ? {
          mail: { on: Boolean(notifier.mail?.enabled), ready: ready.includes('mail') },
          telegram: { on: Boolean(notifier.telegram?.enabled), ready: ready.includes('telegram') },
          sms: {
            on: Boolean(notifier.sms?.enabled),
            ready: ready.includes('sms_admin') || ready.includes('sms_patient'),
          },
        }
      : null,
    lastSeedAt: seed?.docs[0]?.createdAt ?? null,
    gaps,
    logs: recentLogLines(warnLines.entries()),
  };
}
