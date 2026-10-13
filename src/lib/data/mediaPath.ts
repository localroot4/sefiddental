import { readEnv } from '@/lib/env';

/**
 * Payload returns absolute media URLs once `serverURL` is set; pages render a site-relative path
 * instead (PAY 7.2), unless the file lives on the configured media origin (object storage, CDN).
 */
export function mediaPath(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const mediaOrigin = readEnv().mediaPublicOrigin;
  if (mediaOrigin && parsed.origin === new URL(mediaOrigin).origin) return url;
  return `${parsed.pathname}${parsed.search}`;
}
