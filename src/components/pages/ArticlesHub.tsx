import { permanentRedirect, redirect } from 'next/navigation';

import { JsonLd } from '@/components/seo/JsonLd';
import { PageHero } from '@/components/ui/Layout';
import { ltr } from '@/components/ui/ltr';
import { Breadcrumbs, Pagination } from '@/components/ui/Navigation';
import { t } from '@/i18n/fa';
import { ARTICLES_MESSAGES as A } from '@/i18n/fa-articles';
import { type ArticleCard, getArticleCategories, getArticlesPage } from '@/lib/data/content';
import type { PublishedPage } from '@/lib/data/published';
import { PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, itemListNode, jsonLdGraph } from '@/lib/seo/jsonld';
import { parsePageParam } from '@/lib/seo/robots';

import { ArticleList, articlePath, CategoryChips, FeaturedArticle } from './articleParts';

type ListFilter = { category?: number; tag?: number };

/** `?page` of an article list for its metadata: the page number, 1 when absent or malformed. */
export function readListPage(
  filter: ListFilter,
  raw: string | string[] | undefined,
): Promise<PublishedPage<ArticleCard>> {
  return getArticlesPage({ page: parsePageParam(raw) ?? 1, ...filter });
}

/**
 * The page of an article list to render (H3), else a redirect to the list's base URL: `?page=1`
 * or a malformed value answers a 308; a page past the last a 307 (it can become valid). Called
 * from the page component, never from generateMetadata: Next streams metadata after the shell, so
 * a redirect there would not be an HTTP 3xx (risk 9).
 */
export async function listPageOrRedirect(
  base: string,
  filter: ListFilter,
  raw: string | string[] | undefined,
): Promise<PublishedPage<ArticleCard>> {
  const page = raw === undefined ? 1 : parsePageParam(raw);
  if (page === null) permanentRedirect(encodeURI(base));
  const list = await getArticlesPage({ page, ...filter });
  if (page > Math.max(1, list.totalPages)) redirect(encodeURI(base));
  return list;
}

/**
 * T-articles (docs/ia.md): the hub, a category and a tag share it. Compact hero (A), the category
 * chips, on page 1 of the hub the newest article as the featured card (A), the cards (C), the
 * pagination (Persian digits; page 1 is the base URL, H3). No booking block (conversion.md).
 * While no article is published the hub shows the empty state (C25 keeps it noindex).
 */
export async function ArticlesHub(props: {
  /** The list's base path: the hub, a category or a tag. */
  path: string;
  title: string;
  lead?: string | null;
  /** «دسته» or «برچسب» above the H1 of a category or a tag. */
  label?: string;
  /** The chip of this page: 'all' on the hub, the category id on a category. */
  current?: number | 'all';
  list: PublishedPage<ArticleCard>;
}) {
  const categories = await getArticleCategories();
  const hub = props.path === PAGE_PATHS.articles;
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: A['articles.crumb'], href: PAGE_PATHS.articles },
    ...(hub ? [] : [{ label: props.title, href: props.path }]),
  ];
  const { docs, page, totalPages } = props.list;
  const featured = hub && page === 1 ? docs[0] : undefined;
  const cards = featured ? docs.slice(1) : docs;
  return (
    <div data-page-type="articles">
      <PageHero
        compact
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        label={props.label}
        title={ltr(props.title)}
        summary={props.lead ? ltr(props.lead) : undefined}
      />
      <div
        data-section="list"
        data-family="C"
        className="mx-auto grid w-full max-w-content gap-8 px-gutter pb-section md:gap-12"
      >
        {categories.length > 0 ? (
          <CategoryChips categories={categories} current={props.current} />
        ) : null}
        {featured ? <FeaturedArticle article={featured} /> : null}
        {cards.length > 0 && hub ? (
          <section aria-labelledby="list-title" className="grid gap-6">
            <h2 id="list-title" className="font-display text-display-2 font-bold">
              {A['articles.list']}
            </h2>
            <ArticleList articles={cards} headingLevel="h3" />
          </section>
        ) : cards.length > 0 || !featured ? (
          <ArticleList articles={cards} headingLevel="h2" />
        ) : null}
        <Pagination
          current={page}
          total={totalPages}
          href={(n) => (n === 1 ? props.path : `${props.path}?page=${n}`)}
        />
      </div>
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          itemListNode(docs.map((doc) => ({ name: doc.title, path: articlePath(doc) }))),
        )}
      />
    </div>
  );
}
