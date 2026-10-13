import { requestErrors } from '@/lib/log/errorDedupe';
import { log } from '@/lib/log/logger';

interface ErrorRequest {
  path: string;
  method: string;
  headers: NodeJS.Dict<string | string[]>;
}

interface ErrorContext {
  routePath: string;
  routeType: string;
}

function header(headers: ErrorRequest['headers'], name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * onRequestError body (src/instrumentation.ts): one `request_error` line with the request id and
 * the digest the 500 page shows, then one `error_alert` line per error signature per hour (the
 * phase 3 notifier driver is the log; phase 5 adds mail and Telegram behind the same dedupe).
 */
export function logRequestError(
  error: unknown,
  request: ErrorRequest,
  context: ErrorContext,
  nowMs = Date.now(),
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  const digest = (error as { digest?: unknown } | null)?.digest;
  const path = request.path.split('?')[0] ?? request.path;
  const reqId = header(request.headers, 'x-request-id');
  log.error({
    msg: 'request_error',
    reqId,
    method: request.method,
    path,
    routePath: context.routePath,
    routeType: context.routeType,
    digest: typeof digest === 'string' ? digest : undefined,
    err,
  });
  const { notify, signature, count } = requestErrors.record(
    { routePath: context.routePath, errName: err.name, message: err.message },
    nowMs,
  );
  if (notify) {
    log.error({
      msg: 'error_alert',
      reqId,
      routePath: context.routePath,
      errName: err.name,
      signature,
      count,
    });
  }
}
