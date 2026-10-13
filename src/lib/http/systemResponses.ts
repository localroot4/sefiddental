import type { ServerEnv } from '@/lib/env';
import type { PathKind } from '@/lib/http/classify';
import { API_CSP } from '@/lib/http/csp';
import { renderStaticSystemPage, STATIC_PAGE_CSP } from '@/lib/system-pages/staticPage';

/**
 * Responses the proxy answers itself, as plain data: the proxy wraps them in
 * `new NextResponse(body, { status, headers })`. next.config adds the static security headers.
 */
export interface PlainResponse {
  status: number;
  headers: Array<[string, string]>;
  body: string;
}

const HTML = 'text/html; charset=utf-8';
const JSON_TYPE = 'application/json; charset=utf-8';

function documentHeaders(reqId: string): Array<[string, string]> {
  return [
    ['Content-Type', HTML],
    ['Cache-Control', 'no-store'],
    ['Content-Security-Policy', STATIC_PAGE_CSP],
    ['X-Robots-Tag', 'noindex'],
    ['X-Frame-Options', 'DENY'],
    ['X-Request-Id', reqId],
  ];
}

function jsonHeaders(reqId: string): Array<[string, string]> {
  return [
    ['Content-Type', JSON_TYPE],
    ['Cache-Control', 'no-store'],
    ['Content-Security-Policy', API_CSP],
    ['X-Robots-Tag', 'noindex'],
    ['X-Request-Id', reqId],
  ];
}

/** 503 in maintenance mode: the static document for pages and feeds, JSON for API calls (14.3). */
export function maintenanceResponse(input: {
  kind: PathKind;
  env: Pick<ServerEnv, 'maintenanceRetryAfter'>;
  reqId: string;
}): PlainResponse {
  const retryAfter: [string, string] = ['Retry-After', String(input.env.maintenanceRetryAfter)];
  if (input.kind === 'api' || input.kind === 'internal') {
    return {
      status: 503,
      headers: [...jsonHeaders(input.reqId), retryAfter],
      body: JSON.stringify({ status: 'maintenance' }),
    };
  }
  return {
    status: 503,
    headers: [...documentHeaders(input.reqId), retryAfter],
    body: renderStaticSystemPage('maintenance'),
  };
}

/** 410 for a `redirects` row with status 410 (14.4). */
export function goneResponse(input: { reqId: string }): PlainResponse {
  return {
    status: 410,
    headers: documentHeaders(input.reqId),
    body: renderStaticSystemPage('gone'),
  };
}

/** Message the admin sign-in form shows (Payload reads `errors[0].message`). */
export const TOO_MANY_ATTEMPTS_FA =
  'تلاش‌ها بیش از حد مجاز بود. چند دقیقهٔ دیگر دوباره امتحان کنید.';

/** 429 of the auth limiter, in Payload's REST error shape. */
export function tooManyRequestsResponse(input: {
  retryAfterSec: number;
  reqId: string;
}): PlainResponse {
  return {
    status: 429,
    headers: [...jsonHeaders(input.reqId), ['Retry-After', String(input.retryAfterSec)]],
    body: JSON.stringify({ errors: [{ message: TOO_MANY_ATTEMPTS_FA }] }),
  };
}
