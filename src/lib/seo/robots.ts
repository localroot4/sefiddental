import type { MetadataRoute } from 'next';

import type { ServerEnv } from '@/lib/env';
import { toLatinDigits } from '@/lib/persianText';
import { absoluteUrl } from '@/lib/seo/url';

/*
 * Canonical and robots rules per route (spec 9.3, ia.md). Paths are decoded Unicode site paths
 * such as '/مقالات'; buildMetadata turns them into absolute URLs.
 */

export type SearchParamsInput =
  URLSearchParams | Record<string, string | readonly string[] | undefined> | undefined;

const ARTICLES = '/مقالات';
/** Hubs that list published documents: noindex while they list none (C25). */
const LIST_HUBS = new Set([ARTICLES, '/پزشکان', '/راهنمای-بیمار']);
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

/**
 * `?page` of a paginated list (H3): an integer of 2 or more in ASCII, Persian or Arabic-Indic
 * digits; the first value when repeated. Null otherwise (absent, 1, signs, decimals, spaces,
 * past the safe integers): the list answers it with a 308 to its base URL.
 */
export function parsePageParam(raw: string | readonly string[] | null | undefined): number | null {
  const value = typeof raw === 'string' ? raw : raw?.[0];
  if (!value || !/^[0-9\u06F0-\u06F9\u0660-\u0669]+$/.test(value)) return null;
  const page = Number(toLatinDigits(value));
  return Number.isSafeInteger(page) && page >= 2 ? page : null;
}

/** Article lists with pages 2 and up: the hub, categories and tags (H3). */
const isPaginated = (path: string) =>
  path === ARTICLES || ARTICLE_CATEGORY.test(path) || ARTICLE_TAG.test(path);

/**
 * Absolute canonical URL. Only paginated article lists keep a query (`page` when it is an integer
 * of 2 or more, parsePageParam); every other key (utm_*, gclid, filters such as ?service=) is
 * dropped.
 */
export function canonicalUrl(path: string, searchParams?: SearchParamsInput): string {
  const url = new URL(absoluteUrl(path));
  if (isPaginated(path)) {
    const page = parsePageParam(firstParam(searchParams, 'page'));
    if (page !== null) url.searchParams.set('page', String(page));
  }
  return url.href;
}

export interface PageRobots {
  index: boolean;
  follow: boolean;
}

/**
 * Meta robots of a page. Staging (ALLOW_INDEXING=false) is noindex, nofollow everywhere. Lists
 * count their published documents (`listCount`, unknown counts as 0): the articles, dentists and
 * guides hubs are noindex while empty (C25), an article category below 5 (H4); a tag always is.
 */
export function pageRobots(input: {
  path: string;
  allowIndexing: boolean;
  noindex?: boolean | null;
  listCount?: number;
}): PageRobots {
  if (!input.allowIndexing) return { index: false, follow: false };
  const { path } = input;
  const count = input.listCount ?? 0;
  if (
    input.noindex ||
    path === BOOKING_SUCCESS ||
    ARTICLE_TAG.test(path) ||
    (LIST_HUBS.has(path) && count < 1) ||
    (ARTICLE_CATEGORY.test(path) && count < CATEGORY_INDEX_MIN_ARTICLES)
  ) {
    return { index: false, follow: true };
  }
  return { index: true, follow: true };
}

/**
 * robots.txt content (spec 9.5): everything disallowed unless ALLOW_INDEXING; then the API is
 * blocked, Payload's media files stay crawlable unless media lives on another origin. The admin is
 * never named here (a public file would reveal its path): it answers X-Robots-Tag noindex instead.
 */
export function robotsTxt(
  env: Pick<ServerEnv, 'allowIndexing' | 'mediaPublicOrigin'>,
): MetadataRoute.Robots {
  if (!env.allowIndexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: env.mediaPublicOrigin ? ['/'] : ['/', '/api/media/file/'],
      disallow: ['/api/'],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
