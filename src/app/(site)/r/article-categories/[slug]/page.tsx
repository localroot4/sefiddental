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

// /مقالات/دسته/<slug>: the proxy rewrites it to this ASCII folder and answers the branded 404 for
// a category without a published article (H4, slugs.ts). Noindex below 5 articles (robots.ts).
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
};

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [category, { seo }] = await Promise.all([
    getTaxonomyBySlug('article-categories', (await params).slug),
    getSiteInputs(),
  ]);
  if (!category) return {};
  const raw = (await searchParams).page;
  const list = await readListPage({ category: category.id }, raw);
  return buildMetadata(
    {
      path: buildPath('article-categories', category) as string,
      title: category.title,
      description: metaDescription(category.description),
      seo: pageSeoFrom(category.seo),
      kind: 'articleCategory',
      listCount: list.totalDocs,
      page: parsePageParam(raw),
    },
    seo,
  );
}

export default async function ArticleCategoryPage({ params, searchParams }: Props) {
  const category = await getTaxonomyBySlug('article-categories', (await params).slug);
  // Last resort only: the proxy answers an unknown or empty category with the branded 404 (F10).
  if (!category) notFound();
  const path = buildPath('article-categories', category) as string;
  const list = await listPageOrRedirect(path, { category: category.id }, (await searchParams).page);
  if (list.totalDocs === 0) notFound();
  return (
    <ArticlesHub
      path={path}
      title={category.title}
      lead={category.description}
      label={A['articles.category']}
      current={category.id}
      list={list}
    />
  );
}
