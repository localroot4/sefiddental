import type { Where } from 'payload';

import { doctorArticles, pickRelated } from '@/components/pages/related';
import type {
  Article,
  ArticleCategory,
  Case,
  Doctor,
  Page,
  Service,
  Tag,
  Testimonial,
} from '@/payload-types';

import { isGuideKey, normalizePath, PAGE_KEYS } from '@/lib/paths';

import { getPublished, getPublishedPage, type PublishedDoc } from './published';

/*
 * Published readers of the people and proof templates (dentists, guides, cases, testimonials).
 * Payload populates a relationship to a draft as well, so these readers drop populated drafts
 * (a dentist's unpublished service, a guide's unpublished reviewer, a case's unpublished dentist)
 * and skip join fields (published.ts).
 */

const GUIDE_KEYS = PAGE_KEYS.filter(isGuideKey);

/** A populated document when it is published, else null (an id, a draft, a missing document). */
function published<T extends { _status?: 'draft' | 'published' | null }>(
  value: number | T | null | undefined,
): T | null {
  return typeof value === 'object' && value !== null && value._status === 'published'
    ? value
    : null;
}

/** The slug of a `[slug]` route param in the stored form (same decoding as the proxy). */
const slugOf = (param: string): string => normalizePath(`/${param}`).slice(1);

type PublishedDoctor = Omit<Doctor, 'services'> & { services: Service[] };

const withPublishedServices = (doctor: Doctor): PublishedDoctor => ({
  ...doctor,
  services: (doctor.services ?? []).flatMap((service) => published(service) ?? []),
});

/** Published dentists by `order`, photo and services populated. */
export async function getDoctors(): Promise<PublishedDoctor[]> {
  const doctors = await getPublished('doctors', { sort: 'order', depth: 1, joins: false });
  return doctors.map(withPublishedServices);
}

/** One published dentist by the `[slug]` route param, or null. */
export async function getDoctorBySlug(param: string): Promise<PublishedDoctor | null> {
  const [doctor] = await getPublished('doctors', {
    where: { slug: { equals: slugOf(param) } },
    limit: 1,
    depth: 1,
    joins: false,
  });
  return doctor ? withPublishedServices(doctor) : null;
}

type Guide = Omit<Page, 'reviewer'> & { reviewer: Doctor | null };

const withPublishedReviewer = (page: Page): Guide => ({
  ...page,
  reviewer: published(page.reviewer),
});

/** Published patient guides (pages with a guide key) in key order, reviewer populated. */
export async function getGuides(): Promise<Guide[]> {
  const pages = await getPublished('pages', {
    where: { key: { in: GUIDE_KEYS } },
    depth: 1,
  });
  return pages
    .sort((a, b) => GUIDE_KEYS.indexOf(a.key) - GUIDE_KEYS.indexOf(b.key))
    .map(withPublishedReviewer);
}

/** True once one article is published: the chrome links the articles hub only then (JURY 4). */
export async function hasPublishedArticles(): Promise<boolean> {
  const docs = await getPublished('articles', { limit: 1, select: { slug: true } });
  return docs.length > 0;
}

/** One published guide by the `[slug]` route param, or null (hub slugs never match). */
export async function getGuideBySlug(param: string): Promise<Guide | null> {
  const [page] = await getPublished('pages', {
    where: { and: [{ slug: { equals: slugOf(param) } }, { key: { in: GUIDE_KEYS } }] },
    limit: 1,
    depth: 1,
  });
  return page ? withPublishedReviewer(page) : null;
}

interface ListFilter {
  /** Only this service's documents. */
  service?: number;
  /** Only the documents marked for the home page. */
  home?: boolean;
  limit?: number;
}

type PublishedCase = Omit<Case, 'service' | 'doctor'> & {
  service: Service | null;
  doctor: Doctor | null;
};

/** Published before/after cases by `order`: images, service and dentist populated. */
export async function getCases(
  filter: ListFilter & { doctor?: number } = {},
): Promise<PublishedCase[]> {
  const where: Where[] = [];
  if (filter.service !== undefined) where.push({ service: { equals: filter.service } });
  if (filter.doctor !== undefined) where.push({ doctor: { equals: filter.doctor } });
  if (filter.home) where.push({ featuredOnHome: { equals: true } });
  const cases = await getPublished('cases', {
    where: where.length > 0 ? { and: where } : undefined,
    sort: 'order',
    limit: filter.limit,
    depth: 1,
  });
  return cases.map((doc) => ({
    ...doc,
    service: published(doc.service),
    doctor: published(doc.doctor),
  }));
}

type PublishedTestimonial = Omit<Testimonial, 'service'> & { service: Service | null };

/** Published testimonials by `order`: video, poster and service populated. */
export async function getTestimonials(filter: ListFilter = {}): Promise<PublishedTestimonial[]> {
  const where: Where[] = [];
  if (filter.service !== undefined) where.push({ service: { equals: filter.service } });
  if (filter.home) where.push({ showOnHome: { equals: true } });
  const testimonials = await getPublished('testimonials', {
    where: where.length > 0 ? { and: where } : undefined,
    sort: 'order',
    limit: filter.limit,
    depth: 1,
  });
  return testimonials.map((doc) => ({ ...doc, service: published(doc.service) }));
}

/** The cards of the article lists (H3): 12 a page on the hub, a category and a tag. */
export const ARTICLES_PER_PAGE = 12;

// A card's fields: the lists never carry a body (small cache entries); depth 1 fills the cover.
const CARD = {
  title: true,
  slug: true,
  excerpt: true,
  cover: true,
  publishedAt: true,
  contentUpdatedAt: true,
  readingTime: true,
} as const;

export type ArticleCard = PublishedDoc<'articles', typeof CARD>;

const NEWEST = ['-publishedAt', '-createdAt'];

const idOf = (value: number | { id: number }): number =>
  typeof value === 'object' ? value.id : value;

const cards = (where: Where, limit: number) =>
  getPublished('articles', { where, sort: NEWEST, limit, depth: 1, select: CARD });

/** One page of published article cards, newest first: all, one category or one tag (H3). */
export function getArticlesPage(query: {
  page: number;
  category?: number;
  tag?: number;
  perPage?: number;
}) {
  const where: Where[] = [];
  if (query.category !== undefined) where.push({ category: { equals: query.category } });
  if (query.tag !== undefined) where.push({ tags: { in: [query.tag] } });
  return getPublishedPage('articles', {
    where: where.length > 0 ? { and: where } : undefined,
    sort: NEWEST,
    depth: 1,
    select: CARD,
    limit: query.perPage ?? ARTICLES_PER_PAGE,
    page: query.page,
  });
}

/** The category chips of the article lists: categories with a published article, by title (H4). */
export async function getArticleCategories(): Promise<ArticleCategory[]> {
  const docs = await getPublished('articles', { select: { category: true } });
  // A deleted category leaves its articles with none (ON DELETE SET NULL).
  const ids = [
    ...new Set(docs.flatMap((doc) => (doc.category == null ? [] : [idOf(doc.category)]))),
  ];
  if (ids.length === 0) return [];
  return getPublished('article-categories', { where: { id: { in: ids } }, sort: 'title' });
}

/** A category or a tag by the `[slug]` route param, or null. */
export async function getTaxonomyBySlug<C extends 'article-categories' | 'tags'>(
  collection: C,
  param: string,
) {
  const [doc] = await getPublished(collection, {
    where: { slug: { equals: slugOf(param) } },
    limit: 1,
  });
  return doc ?? null;
}

export type PublishedArticle = Omit<
  Article,
  'category' | 'tags' | 'primaryService' | 'authorDoctor' | 'reviewer'
> & {
  category: ArticleCategory | null;
  tags: Tag[];
  primaryService: Service | null;
  authorDoctor: Doctor | null;
  reviewer: Doctor | null;
};

const populated = <T>(value: number | T | null | undefined): T | null =>
  typeof value === 'object' && value !== null ? value : null;

/** One published article by the `[slug]` route param, relations populated (drafts as null). */
export async function getArticleBySlug(param: string): Promise<PublishedArticle | null> {
  const [doc] = await getPublished('articles', {
    where: { slug: { equals: slugOf(param) } },
    limit: 1,
    depth: 1,
  });
  if (!doc) return null;
  return {
    ...doc,
    category: populated(doc.category),
    tags: (doc.tags ?? []).flatMap((tag) => populated(tag) ?? []),
    primaryService: published(doc.primaryService),
    authorDoctor: published(doc.authorDoctor),
    reviewer: published(doc.reviewer),
  };
}

/**
 * A post's two related articles (H24): the editor's published picks, then the same primary
 * service, the same category, shared tags, each newest first, never the post itself.
 */
export async function getRelatedArticles(article: PublishedArticle): Promise<ArticleCard[]> {
  const notSelf: Where = { id: { not_equals: article.id } };
  const manual = (article.relatedArticles ?? []).map(idOf);
  const tags = article.tags.map((tag) => tag.id);
  // Enough per rule to find two new ones past the picks and the earlier rules' repeats.
  const rule = (where: Where | null) =>
    where ? cards({ and: [where, notSelf] }, 4) : Promise.resolve([]);
  const lists = await Promise.all([
    rule(manual.length ? { id: { in: manual } } : null),
    rule(article.primaryService ? { primaryService: { equals: article.primaryService.id } } : null),
    rule(article.category ? { category: { equals: article.category.id } } : null),
    rule(tags.length ? { tags: { in: tags } } : null),
  ]);
  return pickRelated(article.id, manual, lists);
}

/** A service page's articles (H24): the two newest whose primary service it is. */
export function getArticlesForService(serviceId: number, limit = 2): Promise<ArticleCard[]> {
  return cards({ primaryService: { equals: serviceId } }, limit);
}

/** A dentist page's articles (H24): authored or reviewed, each once with its role, newest first. */
export async function getArticlesForDoctor(doctorId: number, limit = 6) {
  const [authored, reviewed] = await Promise.all([
    cards({ authorDoctor: { equals: doctorId } }, limit),
    cards({ reviewer: { equals: doctorId } }, limit),
  ]);
  return doctorArticles(authored, reviewed, limit);
}
