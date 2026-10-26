import { ADMIN_ROUTE, normalizePath } from '@/lib/paths';

/** Route kind of a request; it selects the CSP, the security headers and the proxy steps. */
export type PathKind = 'internal' | 'api' | 'admin' | 'feed' | 'page';

const FEEDS = new Set(['/sitemap.xml', '/rss.xml', '/robots.txt']);

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Classifies the routed form of the path (normalizePath: decoded, single slashes, no trailing
 * slash, ASCII lowercase), so `/API//users/` and a percent-encoded admin path get the kind of the
 * route they can reach. Payload matches its own paths case-insensitively (freeze A1).
 */
export function classifyPath(pathname: string): PathKind {
  const path = normalizePath(pathname);
  if (isUnder(path, '/api/internal')) return 'internal';
  if (isUnder(path, '/api')) return 'api';
  if (isUnder(path, ADMIN_ROUTE)) return 'admin';
  if (FEEDS.has(path) || path.startsWith('/sitemaps/')) return 'feed';
  return 'page';
}
