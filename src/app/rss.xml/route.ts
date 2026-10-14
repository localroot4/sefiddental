import { rssResponse } from '@/lib/seo/rss';

export function GET(): Promise<Response> {
  return rssResponse();
}
