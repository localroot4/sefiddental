import type { Payload } from 'payload';

import { log } from '@/lib/log/logger';

/** The tick's answer (freeze section 6). */
export interface CronSummary {
  ranJobs: number;
  failed: number;
  remaining: number;
  scheduled: number;
  durationMs: number;
}

export const CRON_JOB_LIMIT = 20;
const ERROR_MAX = 200;

/**
 * One scheduler tick (freeze decision 6): queue due schedules, run up to 20 jobs of every queue,
 * then record the run in the `system-state` global for the status view. Runs inside a route
 * handler, so revalidateTag in the jobs' hooks works. A failure is recorded, then rethrown for the
 * caller to log.
 */
export async function runCronTick(
  payload: Payload,
  now: () => number = Date.now,
): Promise<CronSummary> {
  const started = now();
  let summary: Omit<CronSummary, 'durationMs'> = {
    ranJobs: 0,
    failed: 0,
    remaining: 0,
    scheduled: 0,
  };
  let failure: unknown = null;
  try {
    const schedules = await payload.jobs.handleSchedules({ allQueues: true });
    const run = await payload.jobs.run({ allQueues: true, limit: CRON_JOB_LIMIT });
    const results = Object.values(run.jobStatus ?? {});
    summary = {
      ranJobs: results.length,
      failed: results.filter((result) => result.status !== 'success').length,
      remaining: run.remainingJobsFromQueried,
      scheduled: schedules.queued.length,
    };
    if (schedules.errored.length > 0) {
      log.warn({ msg: 'cron_schedule_errored', count: schedules.errored.length });
    }
  } catch (error) {
    failure = error;
  }
  const durationMs = now() - started;
  const message = failure instanceof Error ? failure.message : failure ? String(failure) : null;

  await payload.updateGlobal({
    slug: 'system-state',
    data: {
      lastCronRunAt: new Date(started).toISOString(),
      lastCronRanJobs: summary.ranJobs,
      lastCronFailed: summary.failed,
      lastCronDurationMs: durationMs,
      lastCronError: message === null ? null : message.slice(0, ERROR_MAX),
    },
    context: { skipRevalidate: true, skipAudit: true },
  });

  if (failure !== null) throw failure;
  log.info({ msg: 'cron_tick', ...summary, durationMs });
  return { ...summary, durationMs };
}
