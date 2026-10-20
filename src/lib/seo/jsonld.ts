import type {
  Article,
  BreadcrumbList,
  Dentist,
  FAQPage,
  ItemList,
  MedicalWebPage,
  Physician,
  Service,
  VideoObject,
  WebPage,
  WebSite,
} from 'schema-dts';

import { readEnv } from '@/lib/env';
import { zonedDateKey } from '@/lib/jalali';
import { log } from '@/lib/log/logger';
import { absoluteUrl } from '@/lib/seo/url';

/*
 * JSON-LD builders (spec 9.7) fed by typed inputs; the data lane maps Payload documents to them.
 * One @graph per script; nodes link by @id. A node with a missing required value or a
 * [[NEEDS_CLIENT marker is omitted, never emitted half-empty: outside production the builder
 * throws so the gap is fixed, in production it logs `jsonld_invalid` and returns null. Every node
 * literal `satisfies` its schema-dts type (H15), so the typecheck refuses a property schema.org
 * does not define, offline; tests/e2e/structured-data.spec.ts checks the rendered graphs.
 */

export type JsonLdNode = { '@type': string; '@id'?: string } & Record<string, unknown>;
export interface JsonLdGraph {
  '@context': 'https://schema.org';
  '@graph': JsonLdNode[];
}

export type Weekday = 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri';

const SCHEMA_DAYS = {
  sat: 'https://schema.org/Saturday',
  sun: 'https://schema.org/Sunday',
  mon: 'https://schema.org/Monday',
  tue: 'https://schema.org/Tuesday',
  wed: 'https://schema.org/Wednesday',
  thu: 'https://schema.org/Thursday',
  fri: 'https://schema.org/Friday',
} as const satisfies Record<Weekday, string>;

const MARKER = '[[NEEDS_CLIENT';

class JsonLdInvalidError extends Error {
  constructor(type: string, reason: string) {
    super(`JSON-LD ${type} omitted: ${reason}`);
    this.name = 'JsonLdInvalidError';
  }
}

function invalid(type: string, reason: string): null {
  if (readEnv().nodeEnv !== 'production') throw new JsonLdInvalidError(type, reason);
  log.warn({ msg: 'jsonld_invalid', type, reason });
  return null;
}

/** Drops null, undefined, '' and empty arrays recursively (objects emptied that way go too). */
export function compact<T>(value: T): T {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) {
      const items = v.map(walk).filter((x) => x !== undefined);
      return items.length === 0 ? undefined : items;
    }
    if (v !== null && typeof v === 'object') {
      const entries = Object.entries(v)
        .map(([k, x]) => [k, walk(x)] as const)
        .filter(([, x]) => x !== undefined);
      return entries.length === 0 ? undefined : Object.fromEntries(entries);
    }
    return v === null || v === undefined || v === '' ? undefined : v;
  };
  return (walk(value) ?? {}) as T;
}

function hasMarker(value: unknown): boolean {
  if (typeof value === 'string') return value.includes(MARKER);
  if (Array.isArray(value)) return value.some(hasMarker);
  if (value !== null && typeof value === 'object') return Object.values(value).some(hasMarker);
  return false;
}

/** Validates required keys and markers, then compacts. */
function finish(node: JsonLdNode, required: readonly string[]): JsonLdNode | null {
  const missing = required.filter((key) => {
    const v = node[key];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length > 0) return invalid(node['@type'], `missing ${missing.join(', ')}`);
  if (hasMarker(node)) return invalid(node['@type'], 'contains a [[NEEDS_CLIENT]] marker');
  return compact(node);
}

export const dentistId = () => `${absoluteUrl('/')}#dentist`;
export const websiteId = () => `${absoluteUrl('/')}#website`;

/** Typed view of the `clinic` global for JSON-LD. */
export interface ClinicJsonLdInput {
  name: string;
  alternateNames?: readonly string[];
  /** E.164, for example '+982155101054'. */
  telephone: string;
  address: {
    street: string;
    locality: string;
    region: string;
    country: string;
    postalCode?: string | null;
  };
  geo?: { lat: number; lng: number } | null;
  weekly: ReadonlyArray<{ days: readonly Weekday[]; open: string; close: string }>;
  /** Profile URLs (Instagram, Telegram, Aparat) when the handles exist. */
  sameAs?: readonly string[];
  /** A maps URL (Google Maps, Neshan or Balad). */
  hasMap?: string | null;
}

/** Dentist node of every page (spec 9.7): LocalBusiness facts of the clinic. */
export function dentistNode(clinic: ClinicJsonLdInput): JsonLdNode | null {
  return finish(
    {
      '@type': 'Dentist',
      '@id': dentistId(),
      name: clinic.name,
      alternateName: clinic.alternateNames ? [...clinic.alternateNames] : undefined,
      url: absoluteUrl('/'),
      telephone: clinic.telephone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: clinic.address.street,
        addressLocality: clinic.address.locality,
        addressRegion: clinic.address.region,
        postalCode: clinic.address.postalCode ?? undefined,
        addressCountry: clinic.address.country,
      },
      geo: clinic.geo
        ? { '@type': 'GeoCoordinates', latitude: clinic.geo.lat, longitude: clinic.geo.lng }
        : undefined,
      openingHoursSpecification: clinic.weekly.map((rule) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: rule.days.map((d) => SCHEMA_DAYS[d]),
        opens: rule.open,
        closes: rule.close,
      })),
      sameAs: clinic.sameAs ? [...clinic.sameAs] : undefined,
      hasMap: clinic.hasMap ?? undefined,
      logo: absoluteUrl('/brand/favicon-512.png'),
      image: absoluteUrl('/brand/og/default.png'),
    } satisfies Dentist,
    ['name', 'telephone', 'address', 'openingHoursSpecification'],
  );
}

/** WebSite node of every page. */
export function websiteNode(input: { name: string }): JsonLdNode | null {
  return finish(
    {
      '@type': 'WebSite',
      '@id': websiteId(),
      url: absoluteUrl('/'),
      name: input.name,
      inLanguage: 'fa-IR',
      publisher: { '@id': dentistId() },
    } satisfies WebSite,
    ['name'],
  );
}

/** Physician node of a dentist page: memberOf the clinic, never worksFor (spec C4). */
export function physicianNode(doctor: {
  name: string;
  path: string;
  image?: string | null;
  councilNumber?: string | null;
}): JsonLdNode | null {
  const url = absoluteUrl(doctor.path);
  return finish(
    {
      '@type': 'Physician',
      '@id': `${url}#physician`,
      name: doctor.name,
      url,
      image: doctor.image ? absoluteUrlOf(doctor.image) : undefined,
      medicalSpecialty: 'https://schema.org/Dentistry',
      memberOf: { '@id': dentistId() },
      identifier: doctor.councilNumber
        ? { '@type': 'PropertyValue', propertyID: 'نظام پزشکی', value: doctor.councilNumber }
        : undefined,
    } satisfies Physician,
    ['name'],
  );
}

/** Service node of a service page; no offers in phase 3. */
export function serviceNode(service: {
  name: string;
  serviceType: string;
  path: string;
  description?: string | null;
  areaServed?: readonly string[];
}): JsonLdNode | null {
  const url = absoluteUrl(service.path);
  return finish(
    {
      '@type': 'Service',
      '@id': `${url}#service`,
      name: service.name,
      serviceType: service.serviceType,
      url,
      provider: { '@id': dentistId() },
      areaServed: service.areaServed ? [...service.areaServed] : undefined,
      description: service.description ?? undefined,
    } satisfies Service,
    ['name', 'serviceType'],
  );
}

/** FAQPage of the FAQs a page renders; answers as plain text. Null for an empty list. */
export function faqPageNode(
  faqs: ReadonlyArray<{ question: string; answer: string }>,
): JsonLdNode | null {
  if (faqs.length === 0) return null;
  if (faqs.some((f) => !f.question.trim() || !f.answer.trim())) {
    return invalid('FAQPage', 'a question or an answer is empty');
  }
  return finish(
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.answer },
      })),
    } satisfies FAQPage,
    ['mainEntity'],
  );
}

/** BreadcrumbList of an inner page; positions start at 1. */
export function breadcrumbNode(
  items: ReadonlyArray<{ name: string; path: string }>,
): JsonLdNode | null {
  if (items.length === 0) return null;
  return finish(
    {
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    } satisfies BreadcrumbList,
    ['itemListElement'],
  );
}

export interface PersonRef {
  name: string;
  path?: string | null;
}

/**
 * Article page: a MedicalWebPage, or a plain WebPage for a non-medical article (C1); either
 * carries reviewedBy and lastReviewed (WebPage properties, spec C5) and has the Article as its
 * mainEntity. The author is a dentist with a url or a staff name without one.
 */
export function articleNodes(article: {
  path: string;
  headline: string;
  description?: string | null;
  image?: string | null;
  isMedical: boolean;
  datePublished: string;
  /** contentUpdatedAt ?? publishedAt: the date the sitemap gives as lastmod (H16). */
  dateModified?: string | null;
  author: PersonRef;
  reviewer?: PersonRef | null;
  /** The stored review instant; written as the Tehran calendar day. */
  lastReviewed?: string | null;
}): [JsonLdNode, JsonLdNode] | null {
  const url = absoluteUrl(article.path);
  const person = (p: PersonRef) =>
    ({
      '@type': 'Person',
      name: p.name,
      url: p.path ? absoluteUrl(p.path) : undefined,
    }) as const;
  const page = finish(
    {
      '@type': article.isMedical ? 'MedicalWebPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: article.headline,
      inLanguage: 'fa-IR',
      isPartOf: { '@id': websiteId() },
      reviewedBy: article.reviewer ? person(article.reviewer) : undefined,
      lastReviewed: tehranDay(article.lastReviewed),
      mainEntity: { '@id': `${url}#article` },
    } satisfies MedicalWebPage | WebPage,
    ['name'],
  );
  const node = finish(
    {
      '@type': 'Article',
      '@id': `${url}#article`,
      headline: article.headline,
      description: article.description ?? undefined,
      image: article.image ? absoluteUrlOf(article.image) : undefined,
      datePublished: article.datePublished,
      dateModified: article.dateModified ?? article.datePublished,
      author: person(article.author),
      publisher: { '@id': dentistId() },
      mainEntityOfPage: { '@id': `${url}#webpage` },
      inLanguage: 'fa-IR',
    } satisfies Article,
    ['headline', 'datePublished', 'author'],
  );
  return page && node ? [page, node] : null;
}

/** A schema.org Date: the Tehran calendar day of a stored instant (the reviewer picked a day). */
const tehranDay = (instant: string | null | undefined) =>
  instant ? zonedDateKey(new Date(instant)) : undefined;

/**
 * A patient guide (templates C25, docs/seo/plan.md 4 has no guide row): a MedicalWebPage with the
 * reviewing dentist and the review date, the WebPage properties the guide has. Not an Article:
 * guides carry no author or publish date. Omitted, never half-empty, without a name or with a
 * [[NEEDS_CLIENT marker (the jsonld.ts rule).
 */
export function guidePageNode(guide: {
  path: string;
  name: string;
  description?: string | null;
  reviewer?: { name: string; path?: string | null } | null;
  lastReviewed?: string | null;
  dateModified?: string | null;
}): JsonLdNode | null {
  if (!guide.name.trim() || JSON.stringify(guide).includes('[[NEEDS_CLIENT')) return null;
  const url = absoluteUrl(guide.path);
  return compact({
    '@type': 'MedicalWebPage',
    '@id': `${url}#webpage`,
    url,
    name: guide.name,
    description: guide.description ?? undefined,
    inLanguage: 'fa-IR',
    isPartOf: { '@id': websiteId() },
    publisher: { '@id': dentistId() },
    reviewedBy: guide.reviewer
      ? {
          '@type': 'Person',
          name: guide.reviewer.name,
          url: guide.reviewer.path ? absoluteUrl(guide.reviewer.path) : undefined,
        }
      : undefined,
    lastReviewed: tehranDay(guide.lastReviewed),
    dateModified: guide.dateModified ?? undefined,
  } satisfies MedicalWebPage);
}

/** VideoObject of a testimonial; all five core fields or nothing (Google's set is unverified). */
export function videoNode(video: {
  name?: string | null;
  description?: string | null;
  thumbnailUrl?: string | null;
  uploadDate?: string | null;
  contentUrl?: string | null;
  transcript?: string | null;
}): JsonLdNode | null {
  if (
    !video.name ||
    !video.description ||
    !video.thumbnailUrl ||
    !video.uploadDate ||
    !video.contentUrl
  ) {
    return null;
  }
  return finish(
    {
      '@type': 'VideoObject',
      name: video.name,
      description: video.description,
      thumbnailUrl: absoluteUrlOf(video.thumbnailUrl),
      uploadDate: video.uploadDate,
      contentUrl: absoluteUrlOf(video.contentUrl),
      transcript: video.transcript ?? undefined,
      inLanguage: 'fa-IR',
    } satisfies VideoObject,
    ['name', 'description', 'thumbnailUrl', 'uploadDate', 'contentUrl'],
  );
}

/** ItemList of a hub or gallery. Null for an empty list. */
export function itemListNode(
  items: ReadonlyArray<{ name: string; path: string }>,
): JsonLdNode | null {
  if (items.length === 0) return null;
  return finish(
    {
      '@type': 'ItemList',
      itemListElement: items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: absoluteUrl(item.path),
        name: item.name,
      })),
    } satisfies ItemList,
    ['itemListElement'],
  );
}

/** A site path or an absolute media URL (object storage) as an absolute URL. */
function absoluteUrlOf(urlOrPath: string): string {
  return urlOrPath.startsWith('/') && !urlOrPath.startsWith('//')
    ? absoluteUrl(urlOrPath)
    : urlOrPath;
}

/** One @graph for one script; null entries (omitted nodes) are skipped, node pairs flattened. */
export function jsonLdGraph(
  ...nodes: Array<JsonLdNode | readonly JsonLdNode[] | null | undefined>
): JsonLdGraph {
  const graph = nodes.flatMap((n) =>
    n === null || n === undefined ? [] : Array.isArray(n) ? n : [n],
  );
  return { '@context': 'https://schema.org', '@graph': graph as JsonLdNode[] };
}

/** Script text: JSON with '<' escaped, so a value containing </script> cannot close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
