import { getServiceTree } from '@/lib/data/catalog';
import { toClinicHours } from '@/lib/data/clinicHours';
import { getCases, getDoctors, getGuides, getTestimonials } from '@/lib/data/content';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import type { Page } from '@/payload-types';

/** The home page document at depth 1 (hero photos populated), or null while unpublished. */
export async function getHomePage(): Promise<Page | null> {
  const [page] = await getPublished('pages', {
    where: { key: { equals: 'home' } },
    limit: 1,
    depth: 1,
  });
  return page ?? null;
}

/** Everything the ten home sections render, read in parallel through the tagged readers. */
export async function getHomeData() {
  const [page, features, clinic, tree, cases, doctors, testimonials, insurers, guides] =
    await Promise.all([
      getHomePage(),
      getFeatures(),
      getClinic(),
      getServiceTree(),
      getCases({ home: true, limit: 3 }),
      getDoctors(),
      getTestimonials({ home: true, limit: 3 }),
      getPublished('insurances', { where: { featured: { equals: true } }, sort: 'order' }),
      getGuides(),
    ]);
  const restoration = tree.flatMap((c) => c.services).find((s) => s.key === 'restoration') ?? null;
  const tiers = restoration
    ? await getPublished('service-tiers', {
        where: { service: { equals: restoration.id } },
        sort: 'order',
        depth: 1,
      })
    : [];
  return {
    page,
    features,
    clinic,
    tree,
    restoration,
    tiers,
    cases,
    // Family F is a three-up grid (DESIGN.md 6); the hub lists the rest.
    doctors: doctors.slice(0, 3),
    testimonials,
    insurers: insurers.map((i) => i.name),
    firstVisitGuide: guides.find((g) => g.key === 'guide-first-visit')?.path ?? null,
    hours: toClinicHours(clinic),
  };
}
