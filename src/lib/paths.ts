import { normalizeLetters } from '@/lib/persianText';

/**
 * Public paths of documents (spec-data 2.8a, 6.4) and the one path normalizer shared by the
 * redirects collection, the proxy and the routes. Dependency-free apart from persianText, so the
 * proxy can import it.
 */

/**
 * decode (malformed %XX kept as is, never throws), NFC, normalizeLetters, drop query and
 * fragment, collapse '//', drop trailing '/' except '/', lowercase ASCII letters only.
 * Output is decoded Unicode.
 */
export function normalizePath(input: string): string {
  const cut = input.search(/[?#]/);
  const raw = cut === -1 ? input : input.slice(0, cut);
  // A run of escapes decodes as one unit (one UTF-8 sequence); an invalid run stays as is.
  const decoded = raw.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
  const letters = normalizeLetters(decoded.normalize('NFC')).normalize('NFC');
  const single = letters.replace(/\/{2,}/g, '/');
  const trimmed = single.length > 1 ? single.replace(/\/+$/, '') : single;
  const lower = trimmed.replace(/[A-Z]/g, (c) => c.toLowerCase());
  return lower === '' ? '/' : lower;
}

export type PathCollection =
  | 'service-categories'
  | 'services'
  | 'doctors'
  | 'articles'
  | 'article-categories'
  | 'tags'
  | 'pages';

export type PageKey =
  | 'home'
  | 'services-hub'
  | 'dentists-hub'
  | 'cases'
  | 'pricing'
  | 'guide-hub'
  | 'guide-first-visit'
  | 'guide-dental-fear'
  | 'guide-aftercare'
  | 'emergency'
  | 'about'
  | 'address'
  | 'booking'
  | 'booking-success'
  | 'articles'
  | 'privacy';

const GUIDES_HUB = '/راهنمای-بیمار';

export const PAGE_PATHS: Readonly<Record<PageKey, string>> = {
  home: '/',
  'services-hub': '/خدمات',
  'dentists-hub': '/پزشکان',
  cases: '/قبل-و-بعد',
  pricing: '/هزینه-و-پرداخت',
  'guide-hub': GUIDES_HUB,
  'guide-first-visit': `${GUIDES_HUB}/اولین-مراجعه`,
  'guide-dental-fear': `${GUIDES_HUB}/ترس-از-دندانپزشکی`,
  'guide-aftercare': `${GUIDES_HUB}/مراقبت-بعد-از-درمان`,
  emergency: '/اورژانس',
  about: '/درباره-ما',
  address: '/آدرس',
  booking: '/رزرو-نوبت',
  'booking-success': '/رزرو-نوبت/ثبت-شد',
  articles: '/مقالات',
  privacy: '/حریم-خصوصی',
};

export const PAGE_KEYS = Object.keys(PAGE_PATHS) as PageKey[];

/** Guide pages (not the guide hub) are the only pages whose slug an editor may change. */
export function isGuideKey(key: string | null | undefined): boolean {
  return (
    typeof key === 'string' && key.startsWith('guide-') && key !== 'guide-hub' && key in PAGE_PATHS
  );
}

export interface PathDoc {
  slug?: string | null;
  key?: string | null;
  standalone?: boolean | null;
  standaloneServiceSlug?: string | null;
}

const PREFIX: Record<Exclude<PathCollection, 'pages'>, string> = {
  'service-categories': '/خدمات',
  services: '/خدمات',
  doctors: '/پزشکان',
  articles: '/مقالات',
  'article-categories': '/مقالات/دسته',
  tags: '/مقالات/برچسب',
};

const under = (prefix: string, slug: string | null | undefined): string | null =>
  slug ? `${prefix}/${slug}` : null;

/** The public path of a document, or null when it has none (missing slug or unknown key). */
export function buildPath(collection: PathCollection, doc: PathDoc): string | null {
  if (collection === 'pages') {
    const key = doc.key;
    if (!key || !(key in PAGE_PATHS)) return null;
    if (isGuideKey(key) && doc.slug) return `${GUIDES_HUB}/${doc.slug}`;
    return PAGE_PATHS[key as PageKey];
  }
  if (collection === 'service-categories' && doc.standalone) {
    // A standalone category has no page of its own: it resolves to its service.
    return under(PREFIX.services, doc.standaloneServiceSlug);
  }
  return under(PREFIX[collection], doc.slug);
}

/** Where a removed document's URL goes (spec-data 6.4 "Hub" column). */
export function hubPath(collection: PathCollection, doc?: PathDoc): string {
  switch (collection) {
    case 'service-categories':
    case 'services':
      return PAGE_PATHS['services-hub'];
    case 'doctors':
      return PAGE_PATHS['dentists-hub'];
    case 'articles':
    case 'article-categories':
    case 'tags':
      return PAGE_PATHS.articles;
    case 'pages':
      return isGuideKey(doc?.key) ? GUIDES_HUB : PAGE_PATHS.home;
  }
}
