import { GA4_BOOT } from '@/components/analytics/ga4Boot';

// The GA4 bootstrap (src/components/analytics/ga4Boot.ts); requested only while GA4 is on.
export function GET(): Response {
  return new Response(GA4_BOOT, {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
