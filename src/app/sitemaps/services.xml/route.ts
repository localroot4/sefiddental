import { sitemapResponse } from '@/lib/seo/sitemaps';

export function GET(): Promise<Response> {
  return sitemapResponse('services');
}
