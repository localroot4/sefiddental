import type { PayloadRequest } from 'payload';

import { isWellFormedRequestId } from '@/lib/http/requestId';

/** Flags on `req.context` (freeze section 5). Seeders: seeding, skipRevalidate, skipRedirects. */
export interface SefidHookContext {
  /** Seeders: one 'seed' audit row per run instead of one per document. */
  seeding?: true;
  /** Seeders, scripts, migrations, system-state writes: no revalidateTag calls. */
  skipRevalidate?: true;
  /** system-state writes and similar bookkeeping. */
  skipAudit?: true;
  /** Seeders: no slug-change or removal redirects. */
  skipRedirects?: true;
  /** Set by a job wrapper when Payload passes the request to the job. */
  jobTask?: string;
}

/**
 * The flags of the current request (read only in hooks). Payload's Local API replaces
 * `req.context` with a copy on every nested call that passes `req` (createLocalReq), so hooks
 * never use it to hand values to later hooks.
 */
export function ctx(req: PayloadRequest): SefidHookContext {
  req.context ??= {};
  return req.context as SefidHookContext;
}

/**
 * The request id the proxy forwards (x-request-id), for log lines and audit rows. Media writes
 * skip the proxy, so the header may be the client's own: only the proxy's shape is kept (UP-12).
 */
export function requestIdOf(req: PayloadRequest): string | undefined {
  const id = req.headers?.get?.('x-request-id');
  return isWellFormedRequestId(id) ? id : undefined;
}
