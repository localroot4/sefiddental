import { readEnv } from '@/lib/env';

/** Public origin (SITE_URL), no trailing slash. */
export function siteUrl(): string {
  return readEnv().siteUrl;
}

/**
 * The one absolute form of a site path (spec 9.1): percent-encoded Persian, fragment kept. Used
 * by canonical links, og:url, sitemaps, RSS and JSON-LD, so all of them are equal strings.
 */
export function absoluteUrl(path: string): string {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError(`absoluteUrl expects a site path starting with one '/', got "${path}"`);
  }
  return new URL(path, siteUrl()).href;
}
