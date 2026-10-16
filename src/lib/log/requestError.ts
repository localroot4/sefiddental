import { requestErrors } from '@/lib/log/errorDedupe';
import { log } from '@/lib/log/logger';
import { cutParams } from '@/lib/log/redact';
import type { NotifyEvent } from '@/lib/notify/types';

type ErrorAlert = Extract<NotifyEvent, { type: 'error' }>;
type ErrorAlertSink = (alert: ErrorAlert) => Promise<void>;

// One sink and one window per process, shared by every server layer that holds this module.
const store = globalThis as typeof globalThis & {
  __sefidErrorAlertSink?: ErrorAlertSink;
  __sefidErrorAlertWindowMs?: number;
};

/**
 * Where error alerts go beyond the log line (architecture.md 9, R-13): the server hands in the
 * Notifier once Payload is up. This module imports nothing more, so src/instrumentation.ts,
 * which loads it, keeps the Payload graph out of its bundle (and stays edge-safe).
 */
export function setErrorAlertSink(sink: ErrorAlertSink | undefined): void {
  store.__sefidErrorAlertSink = sink;
}

/**
 * The alert window follows `notifier.errorDedupMinutes` (R5): the Notifier sets it on every read
 * of the global and the global's afterChange on a save. Nothing read yet (or no value) means 60
 * minutes; the first alert after boot always goes out and its Notifier call reads the global.
 */
export function setErrorAlertWindow(minutes: number | null | undefined): void {
  store.__sefidErrorAlertWindowMs = Math.max(1, minutes ?? 60) * 60_000;
}

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
 * the digest the 500 page shows, then one `error_alert` line per error signature per window, and
 * the same alert to the Notifier when a sink is set (ids and counts only, never the message).
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
  // A failed query's bound values differ per request: cut, they would split the signature.
  const { notify, signature, count } = requestErrors.record(
    { routePath: context.routePath, errName: err.name, message: cutParams(err.message) },
    nowMs,
    store.__sefidErrorAlertWindowMs,
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
    const sink = store.__sefidErrorAlertSink;
    if (sink) {
      // A failed alert (database down) leaves the error_alert line above as the record.
      sink({
        type: 'error',
        signature,
        routePath: context.routePath,
        errName: err.name,
        count,
        requestId: reqId,
      }).catch((sinkError: unknown) =>
        log.warn({
          msg: 'error_alert_not_sent',
          reqId,
          signature,
          err: sinkError instanceof Error ? sinkError.name : 'Error',
        }),
      );
    }
  }
}
