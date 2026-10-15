import { getPublished } from '@/lib/data/published';
import { buildPath, normalizePath, PAGE_PATHS } from '@/lib/paths';
import type { Page } from '@/payload-types';

/*
 * Reads of the services templates on top of the wave 1 readers (src/lib/data): the document
 * behind /خدمات/<slug> and the hub page. Every read is a tagged, cached Local API read.
 */

/**
 * The published document behind /خدمات/<slug>: a service first, else a category with its own page
 * (a standalone category's URL is its service's). Same slug decoding as the proxy and the
 * redirects table. Depth 1 populates the category, hero media, related services and reviewer;
 * join fields are skipped (they are not filtered by status).
 */
export async function resolveServicePath(param: string) {
  const slug = normalizePath(`/${param}`).slice(1);
  const [service] = await getPublished('services', {
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    joins: false,
  });
  if (service) return { kind: 'service', service } as const;
  const [category] = await getPublished('service-categories', {
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 1,
    joins: false,
  });
  return category && !category.standalone ? ({ kind: 'category', category } as const) : null;
}

/** The services hub page document (seeded and published; a missing one is a seed fault). */
export async function getHubPage(): Promise<Page> {
  const [page] = await getPublished('pages', {
    where: { key: { equals: 'services-hub' } },
    limit: 1,
    depth: 1,
  });
  if (!page) {
    throw new Error(
      `services hub: no published page with key services-hub for ${PAGE_PATHS['services-hub']}; run the seeder (npm run seed).`,
    );
  }
  return page;
}

/** Published path of the first-visit guide, or null while it is a draft (templates C18). */
export async function firstVisitGuidePath(): Promise<string | null> {
  const [guide] = await getPublished('pages', {
    where: { key: { equals: 'guide-first-visit' } },
    limit: 1,
  });
  return guide ? buildPath('pages', guide) : null;
}
