import type { Metadata } from 'next';

import { readEnv } from '@/lib/env';
import { canonicalUrl, pageRobots, type SearchParamsInput } from '@/lib/seo/robots';
import { absoluteUrl } from '@/lib/seo/url';

/*
 * The "<Seo> helper" (spec 9.2): App Router metadata is the Metadata API, so the helpers return
 * `Metadata` objects for `generateMetadata`. Parent and child metadata merge shallowly, so every
 * page result carries complete openGraph and twitter objects.
 */

export interface OgImage {
  /** Site path ('/brand/og-preview.png') or absolute URL. */
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

export type PageKind = 'page' | 'article' | 'dentist' | 'home' | 'system';

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
  /** Article categories: published article count (noindex below 5). */
  categoryPublishedCount?: number;
}

export const HOME_TITLE = 'کلینیک دندانپزشکی سفید | دندانپزشکی دیجیتال جنوب تهران';

export const FALLBACK_OG_IMAGE: OgImage = {
  url: '/brand/og-preview.png',
  width: 1200,
  height: 630,
};

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
  const topic = input.seo?.title || input.title;
  let title: Metadata['title'];
  let fullTitle: string;
  if (input.kind === 'home') {
    // Brand first on home (keyword map); `seo.title` is a topic, as V-TITLE checks it (C7).
    fullTitle = input.seo?.title ? `${seo.siteName} | ${input.seo.title}` : HOME_TITLE;
    title = { absolute: fullTitle };
  } else if (input.kind === 'dentist') {
    fullTitle = `${topic}${seo.shortTitleSuffix}`;
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
        categoryPublishedCount: input.categoryPublishedCount,
      });
  const canonical = system ? undefined : canonicalUrl(input.path, input.searchParams);
  const image = ogImage(
    input.seo?.image ?? input.image ?? seo.defaultOgImage ?? FALLBACK_OG_IMAGE,
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
