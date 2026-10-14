import { sitemapIndexResponse } from '@/lib/seo/sitemaps';

// Next treats an app/sitemap.xml route as a metadata route and prerenders it at build, with the
// build's SITE_URL and ALLOW_INDEXING (same as robots.ts, critic W1): render per request.
export const dynamic = 'force-dynamic';

export function GET(): Promise<Response> {
  return sitemapIndexResponse();
}
