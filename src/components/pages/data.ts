import type { Metadata } from 'next';

import { getPublished } from '@/lib/data/published';
import { PAGE_PATHS, type PageKey } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';
import type { Page } from '@/payload-types';

import { metaDescription } from './view';

/**
 * A published hub or single page by key, hero media and reviewer populated (tagged, cached read).
 * The seeder publishes every one of them, so a missing page is a seed fault and answers the 500
 * page; notFound() from a static page would send Next's error shell (code conventions T2).
 */
export async function getPage(key: PageKey): Promise<Page> {
  const [page] = await getPublished('pages', {
    where: { key: { equals: key } },
    limit: 1,
    depth: 1,
  });
  if (!page) {
    throw new Error(
      `pages: no published page with key ${key} for ${PAGE_PATHS[key]}; run the seeder (npm run seed).`,
    );
  }
  return page;
}

/**
 * Metadata of a hub or single page: the title topic and seo group from Payload, the hero photo as
 * the share image when the page has no seo image, the lead as the description only when it fits
 * the 120 to 160 characters of a meta description (templates 1.4).
 */
export async function pageMetadata(key: PageKey): Promise<Metadata> {
  const [page, { seo }] = await Promise.all([getPage(key), getSiteInputs()]);
  return buildMetadata(
    {
      path: PAGE_PATHS[key],
      title: page.title,
      description: metaDescription(page.lead),
      seo: pageSeoFrom({ ...page.seo, image: page.seo?.image ?? page.heroMedia }),
      kind: 'page',
    },
    seo,
  );
}
