import type { ServerEnv } from '@/lib/env';
import type { PathKind } from '@/lib/http/classify';
import { normalizePath } from '@/lib/paths';

/** Last value of a comma-separated forwarded header: the one our own proxy wrote. */
function lastHop(value: string | null): string | null {
  if (value === null) return null;
  const parts = value
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p !== '');
  return parts.at(-1) ?? null;
}

/**
 * Protocol of the request as the visitor used it, or null when unknown. Only a trusted proxy's
 * X-Forwarded-Proto counts: Next builds `request.url` from the client's X-Forwarded-Proto and
 * the server's bind address, so `url.protocol` and `url.host` say nothing reliable.
 */
export function requestProtocol(headers: Headers, trust: boolean): 'https' | 'http' | null {
  if (!trust) return null;
  const proto = lastHop(headers.get('x-forwarded-proto'))?.toLowerCase();
  return proto === 'https' || proto === 'http' ? proto : null;
}

/** Host the visitor asked for: trusted X-Forwarded-Host, else Host; lowercase, no trailing dot. */
function requestHost(headers: Headers, trust: boolean, url: URL): string {
  const forwarded = trust ? lastHop(headers.get('x-forwarded-host')) : null;
  return (forwarded ?? headers.get('host') ?? url.host).toLowerCase().replace(/\.$/, '');
}

/** Characters the URL parser leaves as they are in a path; everything else is percent-encoded. */
const PATH_SAFE = /[A-Za-z0-9\-._~!$&'()*+,;=:@/]/;

function encodePath(decoded: string): string {
  let out = '';
  for (const ch of decoded) out += PATH_SAFE.test(ch) ? ch : encodeURIComponent(ch);
  return out;
}

const upperHex = (path: string) => path.replace(/%[0-9a-f]{2}/gi, (e) => e.toUpperCase());

/**
 * Encoded delimiters (/ ? # \ %) are never decoded by a redirect: decoding would change the
 * segments the router sees. Such paths keep their spelling; only protocol and host change.
 */
const ENCODED_DELIMITER = /%(?:2f|3f|23|5c|25)/i;

function canonicalPath(pathname: string, kind: PathKind): string {
  if (kind === 'api' || kind === 'internal' || ENCODED_DELIMITER.test(pathname)) {
    return upperHex(pathname);
  }
  const normalized = normalizePath(pathname);
  // A % left after decoding is a malformed escape: keep the request's spelling.
  if (normalized.includes('%')) return upperHex(pathname);
  return encodePath(normalized);
}

/**
 * One-hop 301 target on SITE_URL's origin (spec 6.3, decision D-P5), or null. Production only,
 * and only for requests addressed to the site host or its `www.` form. Protocol changes only on
 * a trusted X-Forwarded-Proto (never a loop behind a proxy that hides the scheme). Paths of kinds
 * page, admin and feed take the normalizePath form (trailing slash, '//', Arabic letters, ASCII
 * case); API paths are untouched. The query is kept as is; percent-encoding case alone never
 * redirects. A path with '//' or '\' never reaches here: Next 16.4 answers it first with its own
 * 308 (base-server handleRequestImpl, e2e T-CN2b), so '//' plus capitals takes two hops.
 */
export function canonicalRedirect(input: {
  url: URL;
  headers: Headers;
  env: ServerEnv;
  kind: PathKind;
}): URL | null {
  const { url, headers, env, kind } = input;
  if (env.nodeEnv !== 'production') return null;
  const site = new URL(env.siteUrl);
  const host = requestHost(headers, env.trustProxyHeaders, url);
  if (host !== site.host && host !== `www.${site.host}`) return null;

  const proto = requestProtocol(headers, env.trustProxyHeaders) ?? site.protocol.slice(0, -1);
  const current = upperHex(url.pathname);
  const path = canonicalPath(url.pathname, kind);
  if (proto === site.protocol.slice(0, -1) && host === site.host && path === current) return null;

  const target = new URL(site.origin);
  target.pathname = path;
  target.search = url.search;
  return target;
}
