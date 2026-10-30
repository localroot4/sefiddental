import type { Metadata } from 'next';

import { ArticlesHub, listPageOrRedirect, readListPage } from '@/components/pages/ArticlesHub';
import { getPage } from '@/components/pages/data';
import { metaDescription } from '@/components/pages/view';
import { PAGE_PATHS } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { parsePageParam } from '@/lib/seo/robots';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /مقالات: the proxy rewrites it to this ASCII folder (proxyRules routeRewrite). `?page=N` pages
// are self-canonical (H3); the hub is noindex while no article is published (C25).
type Props = { searchParams: Promise<{ page?: string | string[] }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const raw = (await searchParams).page;
  const [page, list, { seo }] = await Promise.all([
    getPage('articles'),
    readListPage({}, raw),
    getSiteInputs(),
  ]);
  return buildMetadata(
    {
      path: PAGE_PATHS.articles,
      title: page.title,
      description: metaDescription(page.lead),
      seo: pageSeoFrom({ ...page.seo, image: page.seo?.image ?? page.heroMedia }),
      kind: 'articles',
      listCount: list.totalDocs,
      page: parsePageParam(raw),
    },
    seo,
  );
}

export default async function ArticlesPage({ searchParams }: Props) {
  const [page, list] = await Promise.all([
    getPage('articles'),
    listPageOrRedirect(PAGE_PATHS.articles, {}, (await searchParams).page),
  ]);
  return (
    <ArticlesHub
      path={PAGE_PATHS.articles}
      title={page.title}
      lead={page.lead}
      current="all"
      list={list}
    />
  );
}
