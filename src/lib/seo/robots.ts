import type { MetadataRoute } from 'next';

import type { ServerEnv } from '@/lib/env';
import { absoluteUrl } from '@/lib/seo/url';

/*
 * Canonical and robots rules per route (spec 9.3, ia.md). Paths are decoded Unicode site paths
 * such as '/مقالات'; buildMetadata turns them into absolute URLs.
 */

export type SearchParamsInput =
  URLSearchParams | Record<string, string | readonly string[] | undefined> | undefined;

const ARTICLES = '/مقالات';
const ARTICLE_CATEGORY = /^\/مقالات\/دسته\/[^/]+$/;
const ARTICLE_TAG = /^\/مقالات\/برچسب\/[^/]+$/;
const BOOKING_SUCCESS = '/رزرو-نوبت/ثبت-شد';

/** A category stays noindex until it has this many published articles (ia.md 51). */
export const CATEGORY_INDEX_MIN_ARTICLES = 5;

function firstParam(params: SearchParamsInput, key: string): string | undefined {
  if (params === undefined) return undefined;
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return typeof value === 'string' ? value : value?.[0];
}

const isPaginated = (path: string) => path === ARTICLES || ARTICLE_CATEGORY.test(path);

/**
 * Absolute canonical URL. Only paginated article lists keep a query (`page` when it is an integer
 * of 2 or more); every other key (utm_*, gclid, filters such as ?service=) is dropped.
 */
export function canonicalUrl(path: string, searchParams?: SearchParamsInput): string {
  const url = new URL(absoluteUrl(path));
  if (isPaginated(path)) {
    const page = firstParam(searchParams, 'page');
    if (page !== undefined && /^\d+$/.test(page) && Number(page) >= 2) {
      url.searchParams.set('page', String(Number(page)));
    }
  }
  return url.href;
}

export interface PageRobots {
  index: boolean;
  follow: boolean;
}

/** Meta robots of a page. Staging (ALLOW_INDEXING=false) is noindex, nofollow everywhere. */
export function pageRobots(input: {
  path: string;
  allowIndexing: boolean;
  noindex?: boolean | null;
  categoryPublishedCount?: number;
}): PageRobots {
  if (!input.allowIndexing) return { index: false, follow: false };
  const { path } = input;
  if (input.noindex || path === BOOKING_SUCCESS || ARTICLE_TAG.test(path)) {
    return { index: false, follow: true };
  }
  if (
    ARTICLE_CATEGORY.test(path) &&
    (input.categoryPublishedCount ?? 0) < CATEGORY_INDEX_MIN_ARTICLES
  ) {
    return { index: false, follow: true };
  }
  return { index: true, follow: true };
}

/**
 * robots.txt content (spec 9.5): everything disallowed unless ALLOW_INDEXING; then the admin and
 * the API are blocked, Payload's media files stay crawlable unless media lives on another origin.
 */
export function robotsTxt(
  env: Pick<ServerEnv, 'allowIndexing' | 'mediaPublicOrigin'>,
): MetadataRoute.Robots {
  if (!env.allowIndexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: env.mediaPublicOrigin ? ['/'] : ['/', '/api/media/file/'],
      disallow: ['/admin', '/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
