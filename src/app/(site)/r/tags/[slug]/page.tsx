import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ArticlesHub, listPageOrRedirect, readListPage } from '@/components/pages/ArticlesHub';
import { metaDescription } from '@/components/pages/view';
import { ARTICLES_MESSAGES as A } from '@/i18n/fa-articles';
import { getTaxonomyBySlug } from '@/lib/data/content';
import { buildPath } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { parsePageParam } from '@/lib/seo/robots';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /مقالات/برچسب/<slug>: the proxy rewrites it to this ASCII folder and answers the branded 404 for
// a tag without a published article (H4, slugs.ts). Always noindex, never in a sitemap.
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [tag, { seo }] = await Promise.all([
    getTaxonomyBySlug('tags', (await params).slug),
    getSiteInputs(),
  ]);
  if (!tag) return {};
  const raw = (await searchParams).page;
  const list = await readListPage({ tag: tag.id }, raw);
  return buildMetadata(
    {
      path: buildPath('tags', tag) as string,
      title: tag.title,
      description: metaDescription(tag.description),
      seo: pageSeoFrom(tag.seo),
      kind: 'tag',
      listCount: list.totalDocs,
      page: parsePageParam(raw),
    },
    seo,
  );
}

export default async function TagPage({ params, searchParams }: Props) {
  const tag = await getTaxonomyBySlug('tags', (await params).slug);
  // Last resort only: the proxy answers an unknown or empty tag with the branded 404 (F10).
  if (!tag) notFound();
  const path = buildPath('tags', tag) as string;
  const list = await listPageOrRedirect(path, { tag: tag.id }, (await searchParams).page);
  if (list.totalDocs === 0) notFound();
  return (
    <ArticlesHub
      path={path}
      title={tag.title}
      lead={tag.description}
      label={A['articles.tag']}
      list={list}
    />
  );
}
