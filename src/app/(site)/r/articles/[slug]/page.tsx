import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Article } from '@/components/pages/Article';
import { articlePath } from '@/components/pages/articleParts';
import { getArticleBySlug } from '@/lib/data/content';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /مقالات/<slug>: the proxy rewrites it to this ASCII folder (Next 16.4 never matches a dynamic
// segment under a Persian folder in a production build; proxyRules routeRewrite).
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [article, { seo }] = await Promise.all([
    getArticleBySlug((await params).slug),
    getSiteInputs(),
  ]);
  if (!article) return {};
  return buildMetadata(
    {
      path: articlePath(article),
      title: article.title,
      description: article.excerpt,
      // The share image: the SEO image, else the cover (its `og` size, else the article card).
      seo: pageSeoFrom({ ...article.seo, image: article.seo?.image ?? article.cover }),
      kind: 'article',
      publishedAt: article.publishedAt,
      modifiedAt: article.contentUpdatedAt ?? article.publishedAt,
    },
    seo,
  );
}

export default async function ArticlePage({ params }: Props) {
  const article = await getArticleBySlug((await params).slug);
  // Last resort only: the proxy answers an unknown or draft slug with the branded 404 (F10), so
  // this runs just for a slug unpublished within the proxy's memo window.
  if (!article) notFound();
  return <Article article={article} />;
}
