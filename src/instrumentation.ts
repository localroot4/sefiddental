import type { Instrumentation } from 'next';

/**
 * Server start (spec 12.3): production boot fails here with the name of a missing variable
 * (assertEnv is a no-op during `next build`), then one `server_start` line. Node.js runtime only.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { assertEnv } = await import('@/lib/env');
  assertEnv();
  const { log } = await import('@/lib/log/logger');
  log.info({ msg: 'server_start', node: process.version });
}

/** Every uncaught server error: one `request_error` line, one `error_alert` per signature per hour. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { logRequestError } = await import('@/lib/log/requestError');
  logRequestError(error, request, context);
};
