import { JsonLd } from '@/components/seo/JsonLd';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { ArticleMeta, PersonBox, SourceList, Toc } from '@/components/ui/Article';
import { Tag } from '@/components/ui/Badge';
import { FaqList } from '@/components/ui/Content';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { ltr } from '@/components/ui/ltr';
import { MediaFrame } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { ARTICLES_MESSAGES as A } from '@/i18n/fa-articles';
import { getDoctors, getRelatedArticles, type PublishedArticle } from '@/lib/data/content';
import { mediaPath } from '@/lib/data/mediaPath';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { articleNodes, breadcrumbNode, faqPageNode, jsonLdGraph } from '@/lib/seo/jsonld';
import { ogImageOf } from '@/lib/seo/siteInputs';
import { absoluteUrl } from '@/lib/seo/url';

import { ArticleCta, ArticleList, articlePath, ShareLinks } from './articleParts';
import { Band } from './parts';
import { dentistName, mediaOf, sourceItems } from './view';

const FAQ_ID = 'faq';
const SOURCES_ID = 'sources';
// Ids the page sets itself, so no heading anchor takes them.
const RESERVED = [FAQ_ID, SOURCES_ID, 'tags-title', 'share-title', 'cta-title', 'related-title'];

/**
 * T-article (docs/ia.md): the hero with the cover (the LCP: eager, fetchpriority high, C22), the
 * updated date and the reading time; the reading column (K) with the table of contents from its
 * H2s plus the FAQ and the sources (C3), the tags, the author and reviewer boxes (H23) and the
 * share links (H22); the one CTA, the primary service box (H21); two related articles (H24).
 * No booking form or dialog on a post, so no island (H21). The dates are the ones the JSON-LD
 * gives: dateModified is contentUpdatedAt, else publishedAt (H16, C17).
 */
export async function Article({ article }: { article: PublishedArticle }) {
  const [doctors, related] = await Promise.all([getDoctors(), getRelatedArticles(article)]);
  const path = articlePath(article);
  const category = article.category;
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: A['articles.crumb'], href: PAGE_PATHS.articles },
    ...(category
      ? [{ label: category.title, href: buildPath('article-categories', category) as string }]
      : []),
    { label: article.title, href: path },
  ];
  const cover = mediaOf(article.cover);
  const modified = article.contentUpdatedAt ?? article.publishedAt;
  const author = article.authorDoctor;
  const authorPath = author ? buildPath('doctors', author) : null;
  // The cached published dentists carry the populated photo (as on the service page).
  const authorPhoto = author ? mediaOf(doctors.find((d) => d.id === author.id)?.photo) : null;
  const reviewer = article.reviewer;
  const reviewerPath = reviewer ? buildPath('doctors', reviewer) : null;
  const faqs = (article.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const sources = sourceItems(article.sources);
  const { ids, toc } = headingAnchors([article.body], RESERVED);
  const authorRef = author
    ? { name: dentistName(author.name), path: authorPath }
    : article.staffAuthorName
      ? { name: article.staffAuthorName }
      : null;
  const graph = jsonLdGraph(
    authorRef && article.publishedAt
      ? articleNodes({
          path,
          headline: article.title,
          description: article.seo?.description || article.excerpt,
          image: ogImageOf(cover)?.url ?? mediaPath(cover?.url),
          isMedical: article.isMedical !== false,
          datePublished: article.publishedAt,
          dateModified: modified,
          author: authorRef,
          reviewer: reviewer ? { name: dentistName(reviewer.name), path: reviewerPath } : null,
          lastReviewed: article.reviewedAt,
        })
      : null,
    breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
    faqPageNode(faqs),
  );
  return (
    <div data-page-type="article">
      <PageHero
        titleSize={heroTitleSize(article.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={ltr(article.title)}
        summary={ltr(article.excerpt)}
        note={
          <ArticleMeta
            updatedAt={modified}
            readingMinutes={article.readingTime}
            reviewer={
              reviewer ? (
                reviewerPath ? (
                  <TextLink href={reviewerPath}>{dentistName(reviewer.name)}</TextLink>
                ) : (
                  dentistName(reviewer.name)
                )
              ) : undefined
            }
          />
        }
        media={
          cover ? (
            <MediaFrame ratio="16:9">
              <Picture
                media={cover}
                priority
                sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
              />
            </MediaFrame>
          ) : undefined
        }
      />
      <div
        data-section="reading"
        data-family="K"
        className="mx-auto w-full max-w-content px-gutter pb-section"
      >
        {/* The contents list sits beside the reading column, as on the guides. */}
        <div className="grid gap-12 lg:grid-cols-[minmax(0,var(--measure))_16rem] lg:justify-start lg:gap-16">
          <Toc
            items={[
              ...toc,
              ...(faqs.length ? [{ id: FAQ_ID, label: t('pages.guide.faq') }] : []),
              ...(sources.length ? [{ id: SOURCES_ID, label: t('ui.article.sources') }] : []),
            ]}
            className="lg:col-start-2 lg:row-start-1 lg:self-start"
          />
          <article className="grid max-w-measure content-start gap-8 lg:col-start-1 lg:row-start-1">
            <RichBody data={article.body} ids={ids} />
            {faqs.length ? (
              <section aria-labelledby={FAQ_ID} className="grid gap-4">
                <h2 id={FAQ_ID} className="text-heading font-semibold">
                  {t('pages.guide.faq')}
                </h2>
                <FaqList
                  items={faqs.map((faq) => ({
                    question: <span>{ltr(faq.question)}</span>,
                    answer: ltr(faq.answer),
                  }))}
                />
              </section>
            ) : null}
            <SourceList id={SOURCES_ID} items={sources} />
            {article.tags.length ? (
              <div className="flex flex-wrap items-center gap-2">
                <p id="tags-title" className="text-small font-semibold">
                  {A['articles.tags']}
                </p>
                <ul aria-labelledby="tags-title" className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <li key={tag.id}>
                      <Tag href={buildPath('tags', tag) ?? undefined}>{tag.title}</Tag>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="grid gap-3 md:grid-cols-2">
              {authorRef ? (
                <PersonBox
                  role={A['articles.author']}
                  name={authorRef.name}
                  href={authorPath}
                  photo={
                    authorPhoto ? (
                      <Picture media={authorPhoto} crop="square" sizes="56px" alt="" />
                    ) : undefined
                  }
                />
              ) : null}
              {reviewer ? (
                <PersonBox
                  role={A['articles.reviewer']}
                  name={dentistName(reviewer.name)}
                  href={reviewerPath}
                  date={
                    article.reviewedAt
                      ? { label: A['articles.reviewedOn'], value: article.reviewedAt }
                      : undefined
                  }
                />
              ) : null}
            </div>
            <ShareLinks url={absoluteUrl(path)} title={article.title} />
          </article>
        </div>
      </div>
      <section
        data-section="cta"
        aria-labelledby="cta-title"
        className="mx-auto w-full max-w-content px-gutter pb-section"
      >
        <ArticleCta service={article.primaryService} />
      </section>
      {related.length ? (
        <Band id="related" family="C" title={A['articles.related']} tone="sunken">
          <ArticleList articles={related} headingLevel="h3" />
        </Band>
      ) : null}
      <JsonLd data={graph} />
    </div>
  );
}
