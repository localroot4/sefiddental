import { normalizePath } from '@/lib/paths';

/** Route kind of a request; it selects the CSP, the security headers and the proxy steps. */
export type PathKind = 'internal' | 'api' | 'admin' | 'feed' | 'page';

const FEEDS = new Set(['/sitemap.xml', '/rss.xml', '/robots.txt']);

const isUnder = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/**
 * Classifies the routed form of the path (normalizePath: decoded, single slashes, no trailing
 * slash, ASCII lowercase), so `/API//users/` and `/%61dmin` get the kind of the route they can
 * reach. Payload matches its own paths case-insensitively (freeze A1).
 */
export function classifyPath(pathname: string): PathKind {
  const path = normalizePath(pathname);
  if (isUnder(path, '/api/internal')) return 'internal';
  if (isUnder(path, '/api')) return 'api';
  if (isUnder(path, '/admin')) return 'admin';
  if (FEEDS.has(path) || path.startsWith('/sitemaps/')) return 'feed';
  return 'page';
}
