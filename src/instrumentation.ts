import type { Instrumentation } from 'next';

/**
 * Server start (spec 12.3): production boot fails here with the name of a missing variable
 * (assertEnv is a no-op during `next build`), then one `server_start` line. Node.js runtime only.
 * Next catches an error thrown here and keeps serving a bare 500 on every route, so the process
 * exits instead: the process manager sees the crash and restarts or alerts (SEC-S1).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // Next prints uncaught server errors with console.error before onRequestError (S3).
  (await import('@/lib/log/consoleScrub')).scrubConsole();
  const { assertEnv } = await import('@/lib/env');
  try {
    assertEnv();
  } catch (err) {
    // Names and fixes only (parseEnv never prints a value); the logger needs the env, so console.
    console.error(
      JSON.stringify({ level: 'fatal', msg: 'env_invalid', detail: (err as Error).message }),
    );
    process.exit(1);
  }
  const { log } = await import('@/lib/log/logger');
  log.info({ msg: 'server_start', node: process.version });
}

/** Every uncaught server error: one `request_error` line, one `error_alert` per signature per hour. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logRequestError } = await import('@/lib/log/requestError');
  logRequestError(error, request, context);
};
