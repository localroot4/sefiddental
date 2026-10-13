import type { ServerEnv } from '@/lib/env';
import type { PathKind } from '@/lib/http/classify';
import { API_CSP, CSP_REPORT_GROUP, CSP_REPORT_PATH, type buildCsp } from '@/lib/http/csp';
import { normalizePath } from '@/lib/http/pathsStub';

/** X-Robots-Tag per kind (spec 7.1): staging and every non-page response stay out of indexes. */
function robotsTag(kind: PathKind, pathname: string, allowIndexing: boolean): string | null {
  switch (kind) {
    case 'admin':
      return 'noindex, nofollow';
    case 'api':
    case 'internal':
      return 'noindex';
    case 'feed': {
      const path = normalizePath(pathname);
      const sitemap = path === '/sitemap.xml' || path.startsWith('/sitemaps/');
      return sitemap || !allowIndexing ? 'noindex' : null;
    }
    case 'page':
      return allowIndexing ? null : 'noindex';
  }
}

/**
 * Route-dependent response headers the proxy adds (spec 7.1). The static set (nosniff,
 * Referrer-Policy, Permissions-Policy, HSTS) comes from next.config `headers()` on every path,
 * assets included. HSTS is static because browsers ignore it on plain HTTP responses (Chromium
 * net/url_request/url_request_http_job.cc ProcessStrictTransportSecurityHeader, Gecko
 * nsHttpChannel::ProcessSecurityHeaders, MDN Strict-Transport-Security), so `https` is unused
 * today; it stays in the signature for a host that needs HSTS here instead.
 *
 * `csp` is the buildCsp() result for kinds page and admin (null: no CSP header, for example a
 * response that sets its own); other kinds always get the API policy.
 */
export function securityHeaders(input: {
  kind: PathKind;
  csp: ReturnType<typeof buildCsp> | null;
  env: ServerEnv;
  https: boolean;
  reqId: string;
  pathname: string;
  draft: boolean;
}): Array<[string, string]> {
  const { kind, csp, env, reqId, pathname, draft } = input;
  const html = kind === 'page' || kind === 'admin';
  const headers: Array<[string, string]> = [['X-Request-Id', reqId]];

  if (html) {
    if (csp) headers.push([csp.header, csp.value]);
    headers.push([
      'Reporting-Endpoints',
      `${CSP_REPORT_GROUP}="${new URL(CSP_REPORT_PATH, env.siteUrl).href}"`,
    ]);
    headers.push(['Cross-Origin-Opener-Policy', 'same-origin']);
  } else {
    headers.push(['Content-Security-Policy', API_CSP]);
  }
  headers.push(['X-Frame-Options', kind === 'page' && draft ? 'SAMEORIGIN' : 'DENY']);

  const robots = robotsTag(kind, pathname, env.allowIndexing);
  if (robots) headers.push(['X-Robots-Tag', robots]);
  return headers;
}
