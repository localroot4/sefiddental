import { readEnv } from '@/lib/env';
import { readTextCapped } from '@/lib/http/body';
import { clientIpFrom, rateLimitKey } from '@/lib/http/clientIp';
import { CSP_REPORT_MAX_BYTES, parseCspReports } from '@/lib/http/cspReport';
import { createRateLimiter } from '@/lib/http/rateLimit';
import { createErrorDedupe } from '@/lib/log/errorDedupe';
import { logFor } from '@/lib/log/logger';

// Spec 7.6: report-uri and report-to bodies, at most 16 KB, 30 reports per minute per client
// key, one `csp_violation` warn line per directive, blocked origin and path per hour.
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });
const seen = createErrorDedupe({ windowMs: 60 * 60 * 1000 });

const empty = (status: number, headers: Record<string, string> = {}) =>
  new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export async function POST(request: Request): Promise<Response> {
  const env = readEnv();
  const now = Date.now();
  const verdict = limiter.hit(rateLimitKey(clientIpFrom(request.headers, env)), now);
  if (!verdict.ok) return empty(429, { 'Retry-After': String(verdict.retryAfterSec) });

  const text = await readTextCapped(request, CSP_REPORT_MAX_BYTES);
  if (text === null) return empty(413);
  const reports = parseCspReports(request.headers.get('content-type') ?? '', text);
  if (reports === null) return empty(400);

  const logger = logFor(request.headers.get('x-request-id') ?? undefined, '/api/csp-report');
  for (const report of reports) {
    const sample = { routePath: report.path, errName: report.directive, message: report.blocked };
    if (seen.record(sample, now).notify) logger.warn({ msg: 'csp_violation', ...report });
  }
  return empty(204);
}
