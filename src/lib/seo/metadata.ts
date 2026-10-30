import type { Metadata } from 'next';

import { ogCardCopy, type OgCard, SEO_MESSAGES } from '@/i18n/fa-seo';
import { readEnv } from '@/lib/env';
import { PAGE_PATHS } from '@/lib/paths';
import { toPersianDigits } from '@/lib/persianText';
import { canonicalUrl, pageRobots, type SearchParamsInput } from '@/lib/seo/robots';
import { absoluteUrl } from '@/lib/seo/url';

/*
 * The "<Seo> helper" (spec 9.2): App Router metadata is the Metadata API, so the helpers return
 * `Metadata` objects for `generateMetadata`. Parent and child metadata merge shallowly, so every
 * page result carries complete openGraph and twitter objects.
 */

export interface OgImage {
  /** Site path ('/brand/og/default.png') or absolute URL. */
  url: string;
  width: number;
  height: number;
  alt?: string | null;
}

/** Typed view of the `seo-defaults` global (spec-data 3.2); the data lane maps the global to it. */
export interface SeoDefaults {
  siteName: string;
  titleSuffix: string;
  shortTitleSuffix: string;
  defaultDescription?: string | null;
  defaultOgImage?: OgImage | null;
  gscVerification?: string | null;
}

export type PageKind =
  | 'page'
  | 'article'
  | 'dentist'
  | 'home'
  | 'system'
  // Article lists (H3): the hub, a category and a tag, paginated.
  | 'articles'
  | 'articleCategory'
  | 'tag';

export interface PageSeoInput {
  /** Decoded site path, for example '/خدمات/لمینت-سرامیکی'. */
  path: string;
  searchParams?: SearchParamsInput;
  /** Topic title (H1 or nav label); the root template adds the suffix. */
  title: string;
  description?: string | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    image?: OgImage | null;
    noindex?: boolean | null;
  } | null;
  kind: PageKind;
  image?: OgImage | null;
  publishedAt?: string | null;
  modifiedAt?: string | null;
  /** Lists: published documents listed (a hub is noindex at 0, an article category below 5). */
  listCount?: number;
  /** Article lists: the page from parsePageParam; 2 and up add «صفحهٔ N» and `?page=N`. */
  page?: number | null;
  /** Share card when the page has no image; by default the card of the path (ogCardFor). */
  card?: OgCard;
}

export const HOME_TITLE = 'کلینیک دندانپزشکی سفید | دندانپزشکی دیجیتال جنوب تهران';

/** A page type's share card (H14), rendered by scripts/og-cards.mjs and copied to public/brand/og. */
export function ogCardImage(card: OgCard): OgImage {
  return { url: `/brand/og/${card}.png`, width: 1200, height: 630, alt: ogCardCopy(card).title };
}

export const FALLBACK_OG_IMAGE: OgImage = ogCardImage('default');

const PAGE_CARDS: Readonly<Record<string, OgCard>> = {
  [PAGE_PATHS['services-hub']]: 'services-hub',
  [PAGE_PATHS['dentists-hub']]: 'dentists-hub',
  [PAGE_PATHS.cases]: 'cases',
  [PAGE_PATHS.pricing]: 'pricing',
  [PAGE_PATHS['guide-hub']]: 'guide-hub',
  [PAGE_PATHS.emergency]: 'emergency',
  [PAGE_PATHS.about]: 'about',
  [PAGE_PATHS.address]: 'address',
  [PAGE_PATHS.articles]: 'articles',
};

// First match wins: the category and tag prefixes come before the post prefix.
const SECTION_CARDS: ReadonlyArray<readonly [string, OgCard]> = [
  [`${PAGE_PATHS.articles}/دسته/`, 'articles'],
  [`${PAGE_PATHS.articles}/برچسب/`, 'articles'],
  [`${PAGE_PATHS.articles}/`, 'article'],
  [`${PAGE_PATHS['services-hub']}/`, 'service'],
  [`${PAGE_PATHS['dentists-hub']}/`, 'dentist'],
  [`${PAGE_PATHS['guide-hub']}/`, 'guide'],
];

/** The share card of a site path: home, booking, privacy and system pages share `default`. */
export function ogCardFor(path: string): OgCard {
  return (
    PAGE_CARDS[path] ?? SECTION_CARDS.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'default'
  );
}

/** Favicon set from design/brand, copied to public/brand by the asset script (spec 5.2). */
export const SITE_ICONS: NonNullable<Metadata['icons']> = {
  icon: [
    { url: '/brand/favicon.svg', type: 'image/svg+xml' },
    { url: '/brand/favicon-32.png', type: 'image/png', sizes: '32x32' },
    { url: '/brand/favicon-192.png', type: 'image/png', sizes: '192x192' },
  ],
  apple: [{ url: '/brand/apple-touch-icon.png', sizes: '180x180' }],
};

const abs = (url: string) => (url.startsWith('/') ? absoluteUrl(url) : url);

function ogImage(image: OgImage, siteName: string) {
  return {
    url: abs(image.url),
    width: image.width,
    height: image.height,
    alt: image.alt ?? siteName,
  };
}

/** Root layout metadata: metadataBase, title template, icons, robots default, verification. */
export function buildSiteMetadata(seo: SeoDefaults): Metadata {
  const env = readEnv();
  const image = ogImage(seo.defaultOgImage ?? FALLBACK_OG_IMAGE, seo.siteName);
  const description = seo.defaultDescription ?? undefined;
  return {
    metadataBase: new URL(env.siteUrl),
    applicationName: seo.siteName,
    title: { template: `%s${seo.titleSuffix}`, default: seo.siteName },
    description,
    robots: env.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    icons: SITE_ICONS,
    // Phone numbers are explicit tel: links; no automatic detection on iOS.
    formatDetection: { telephone: false, email: false, address: false },
    ...(seo.gscVerification ? { verification: { google: seo.gscVerification } } : {}),
    openGraph: {
      type: 'website',
      locale: 'fa_IR',
      siteName: seo.siteName,
      url: absoluteUrl('/'),
      title: seo.siteName,
      description,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title: seo.siteName, description, images: [image.url] },
  };
}

/** Page metadata (spec 9.2): title rules per kind, canonical, robots, complete OG and Twitter. */
export function buildMetadata(input: PageSeoInput, seo: SeoDefaults): Metadata {
  const env = readEnv();
  const page = input.page && input.page >= 2 ? input.page : null;
  const pageSuffix = page
    ? `، ${SEO_MESSAGES['seo.page'].replace('{n}', toPersianDigits(String(page)))}`
    : '';
  const topic = `${input.seo?.title || input.title}${pageSuffix}`;
  let title: Metadata['title'];
  let fullTitle: string;
  if (input.kind === 'home') {
    // Brand first on home (keyword map); `seo.title` is a topic, as V-TITLE checks it (C7).
    fullTitle = input.seo?.title ? `${seo.siteName} | ${input.seo.title}` : HOME_TITLE;
    title = { absolute: fullTitle };
  } else if (input.kind === 'dentist') {
    fullTitle = `${topic}${seo.shortTitleSuffix}`;
    title = { absolute: fullTitle };
  } else if (input.kind === 'articleCategory' || input.kind === 'tag') {
    fullTitle = `${topic} | ${SEO_MESSAGES['seo.articlesOf'].replace('{site}', seo.siteName)}`;
    title = { absolute: fullTitle };
  } else {
    fullTitle = `${topic}${seo.titleSuffix}`;
    title = topic;
  }

  const description =
    input.seo?.description || input.description || seo.defaultDescription || undefined;
  const system = input.kind === 'system';
  const robots = system
    ? { index: false, follow: true }
    : pageRobots({
        path: input.path,
        allowIndexing: env.allowIndexing,
        noindex: input.seo?.noindex,
        listCount: input.listCount,
      });
  // The page the title names is the page the canonical keeps.
  const params = page ? { page: String(page) } : input.searchParams;
  const canonical = system ? undefined : canonicalUrl(input.path, params);
  const card = input.card ?? ogCardFor(input.path);
  // Document image, else the page type's card; the global default image replaces only `default`.
  const image = ogImage(
    input.seo?.image ??
      input.image ??
      (card === 'default' ? seo.defaultOgImage : null) ??
      ogCardImage(card),
    seo.siteName,
  );
  const rss =
    input.kind === 'article' || input.path === '/مقالات'
      ? { types: { 'application/rss+xml': absoluteUrl('/rss.xml') } }
      : {};
  const article = input.kind === 'article';

  return {
    title,
    description,
    robots: env.allowIndexing ? robots : { index: false, follow: false },
    alternates: { ...(canonical ? { canonical } : {}), ...rss },
    openGraph: {
      type: article ? 'article' : 'website',
      locale: 'fa_IR',
      siteName: seo.siteName,
      ...(canonical ? { url: canonical } : {}),
      title: fullTitle,
      description,
      images: [image],
      ...(article && input.publishedAt ? { publishedTime: input.publishedAt } : {}),
      ...(article && input.modifiedAt ? { modifiedTime: input.modifiedAt } : {}),
    },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images: [image.url] },
  };
}
