import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

import { readEnv } from '@/lib/env';
import { canonicalRedirect, requestProtocol } from '@/lib/http/canonical';
import { classifyPath } from '@/lib/http/classify';
import { clientIpFrom, rateLimitKey } from '@/lib/http/clientIp';
import {
  FORM_COOKIE,
  FORM_COOKIE_OPTIONS,
  FORM_SID_HEADER,
  isWellFormedSid,
  newSid,
} from '@/lib/formTokens';
import { buildCsp, newNonce } from '@/lib/http/csp';
import { normalizePath } from '@/lib/paths';
import { destination, getProxyConfig, recordRedirectHit } from '@/lib/http/proxyConfig';
import {
  isAuthLimitedPath,
  isClosedPayloadPath,
  isFirstUserPath,
  maintenanceBypass,
  needsFormSession,
  routeRewrite,
} from '@/lib/http/proxyRules';
import { createRateLimiter } from '@/lib/http/rateLimit';
import { requestIdFrom, sanitizeRequestHeaders } from '@/lib/http/requestId';
import { securityHeaders } from '@/lib/http/securityHeaders';
import {
  goneResponse,
  maintenanceResponse,
  tooManyRequestsResponse,
  type PlainResponse,
} from '@/lib/http/systemResponses';
import { accessLine } from '@/lib/log/accessLine';

/**
 * Request pipeline (freeze 3.13). Imports stay dependency-free: no Payload, node:fs or
 * next/headers. Every rule that blocks, limits or looks up a path compares normalizePath()
 * output (freeze A1).
 */

// Decision 41: 10 requests per 15 minutes per client key on the credential endpoints.
const authLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });

const send = (r: PlainResponse) =>
  new NextResponse(r.body, { status: r.status, headers: r.headers });

function redirectTo(target: URL, status: number, reqId: string): NextResponse {
  const res = NextResponse.redirect(target, status);
  res.headers.set('X-Request-Id', reqId);
  return res;
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // 0, 1: environment, routed path, kind. request.url carries the bind host, never the public one.
  const env = readEnv();
  const url = new URL(request.url);
  const { pathname } = url;
  const path = normalizePath(pathname);
  const kind = classifyPath(pathname);
  const trust = env.trustProxyHeaders;
  const method = request.method.toUpperCase();

  // 2, 2a: request id, proxy-owned request headers; payload-totp reads the admin path.
  const reqId = requestIdFrom(request.headers, trust);
  const headers = sanitizeRequestHeaders(request.headers, kind, trust, reqId);
  if (kind === 'admin') headers.set('x-pathname', pathname);

  // 3: internal routes check their own token; nothing else applies.
  if (kind === 'internal') {
    const res = NextResponse.next({ request: { headers } });
    res.headers.set('X-Request-Id', reqId);
    return res;
  }

  // 4: maintenance (static 503 page, JSON for API calls).
  if (env.maintenance && !maintenanceBypass(kind, path, request.cookies.has('payload-token'))) {
    accessLine({ level: 'debug', msg: 'maintenance', reqId, route: pathname });
    return send(maintenanceResponse({ kind, env, reqId }));
  }

  // 4a: first-user screen and endpoint, and Payload endpoints the site does not use; every method.
  if ((!env.allowFirstUser && isFirstUserPath(path)) || isClosedPayloadPath(path)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'X-Request-Id': reqId },
    });
  }

  // 4b: credential endpoints, per client key (the trusted hop of X-Forwarded-For, else shared).
  if (isAuthLimitedPath(method, path)) {
    const verdict = authLimiter.hit(rateLimitKey(clientIpFrom(request.headers, env)), Date.now());
    if (!verdict.ok) {
      accessLine({ level: 'info', msg: 'rate_limited', reqId, route: pathname });
      return send(tooManyRequestsResponse({ retryAfterSec: verdict.retryAfterSec, reqId }));
    }
  }

  // 5: redirects table (pages, GET and HEAD), before the canonical check: one hop.
  let ga4MeasurementId: string | null = null;
  if (kind === 'page' && (method === 'GET' || method === 'HEAD')) {
    const config = await getProxyConfig(env);
    ga4MeasurementId = config.ga4MeasurementId;
    const hit = config.redirects.get(path);
    if (hit) {
      event.waitUntil(recordRedirectHit(env, hit.from));
      if (hit.status === 410) {
        accessLine({ level: 'info', msg: 'gone', reqId, route: pathname });
        return send(goneResponse({ reqId }));
      }
      accessLine({ level: 'info', msg: 'redirect', reqId, route: pathname, status: hit.status });
      return redirectTo(destination(hit, url, env), hit.status, reqId);
    }
  }

  // 6: protocol, host, trailing slash, Arabic letters, ASCII case: one 301.
  const canonical = canonicalRedirect({ url, headers: request.headers, env, kind });
  if (canonical) {
    accessLine({ level: 'info', msg: 'canonical_redirect', reqId, route: pathname });
    const res = redirectTo(canonical, 301, reqId);
    // The answer depends on request headers: a shared cache must never store it (CSP-2).
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  // 7: nonce and CSP for HTML kinds; Next reads the nonce from the request CSP header.
  const draft = request.cookies.has('__prerender_bypass');
  const nonce = kind === 'page' || kind === 'admin' ? newNonce() : null;
  const csp = nonce === null ? null : buildCsp({ kind, nonce, env, draft, ga4MeasurementId });
  if (nonce !== null && csp !== null) {
    headers.set('x-nonce', nonce);
    headers.set('content-security-policy', csp.value);
  }
  // 7a: booking and emergency pages render form tokens without JavaScript, so they need the form
  // cookie; the sid reaches the render in a request header (client copies were dropped in 2).
  let newFormSid: string | null = null;
  if (kind === 'page' && needsFormSession(method, path)) {
    const cookieSid = request.cookies.get(FORM_COOKIE)?.value;
    const sid = isWellFormedSid(cookieSid) ? cookieSid : (newFormSid = newSid());
    headers.set(FORM_SID_HEADER, sid);
  }

  // 8: pass through with the route-dependent headers; Persian dynamic routes render from their
  // ASCII folder (proxyRules routeRewrite).
  const rewrite = kind === 'page' ? routeRewrite(path, env.qaRoutes) : null;
  const res = rewrite
    ? NextResponse.rewrite(new URL(rewrite + url.search, request.url), { request: { headers } })
    : NextResponse.next({ request: { headers } });
  if (newFormSid) res.cookies.set(FORM_COOKIE, newFormSid, FORM_COOKIE_OPTIONS);
  const https = requestProtocol(request.headers, trust) === 'https' || url.protocol === 'https:';
  for (const [name, value] of securityHeaders({ kind, csp, env, https, reqId, pathname, draft })) {
    res.headers.set(name, value);
  }
  if (kind === 'admin') res.headers.set('x-pathname', pathname);
  return res;
}

// Every path except build assets, public static files and media files: uploads stream to
// Payload without the proxy's 10 MB request-body buffer.
export const config = {
  matcher: ['/((?!_next/static|_next/image|api/media|brand/|fonts/|detect-gpu/|favicon\\.ico).*)'],
};
