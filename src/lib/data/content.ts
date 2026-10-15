import type { Where } from 'payload';

import type { Case, Doctor, Page, Service, Testimonial } from '@/payload-types';

import { isGuideKey, normalizePath, PAGE_KEYS } from '@/lib/paths';

import { getPublished } from './published';

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
