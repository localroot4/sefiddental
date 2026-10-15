import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/JsonLd';
import { ltr } from '@/components/ui/ltr';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { Alert } from '@/components/ui/Alert';
import { ArticleMeta, SourceList, Toc } from '@/components/ui/Article';
import { FactsRow, FaqList, Steps } from '@/components/ui/Content';
import { PageHero } from '@/components/ui/Layout';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getGuideBySlug } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { formatJalali } from '@/lib/jalali';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, faqPageNode, guidePageNode, jsonLdGraph } from '@/lib/seo/jsonld';

import { PageBooking } from './parts';
import { blocksOf, contentBodies, dentistName, sourceItems } from './view';

type GuideDoc = NonNullable<Awaited<ReturnType<typeof getGuideBySlug>>>;

const FAQ_ID = 'faq';
const SOURCES_ID = 'sources';

/**
 * T-guide (docs/ia.md): a reading column (K, 62ch) with a sticky table of contents from its H2s
 * on desktop (none on phones), the reviewing dentist and the review date under the title, the
 * sources at the end, then booking (J). The blocks render in their stored order; the FAQs gather
 * at the first FAQ block, as one list with its FAQPage JSON-LD.
 */
export async function Guide({ guide }: { guide: GuideDoc }) {
  const clinic = await getClinic();
  const path = buildPath('pages', guide) as string;
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: t('pages.guides.crumb'), href: PAGE_PATHS['guide-hub'] },
    { label: guide.title, href: path },
  ];
  const faqs = blocksOf(guide.blocks, 'faq').flatMap((block) => block.items ?? []);
  const { ids, toc } = headingAnchors(contentBodies(guide.blocks), [FAQ_ID, SOURCES_ID]);
  const reviewer = guide.reviewer;
  const reviewerPath = reviewer ? buildPath('doctors', reviewer) : null;
  const reviewedAt = guide.reviewedAt ? new Date(guide.reviewedAt) : null;
  const sources = sourceItems(guide.sources);
  const firstFaq = (guide.blocks ?? []).findIndex((block) => block.blockType === 'faq');
  const body: ReactNode[] = (guide.blocks ?? []).map((block, i) => {
    switch (block.blockType) {
      case 'content':
        return <RichBody key={i} data={block.body} ids={ids} />;
      case 'callout':
        return (
          <Alert
            key={i}
            tone={block.tone === 'warning' ? 'warning' : 'info'}
            title={ltr(block.text)}
          />
        );
      case 'facts':
        return (
          <FactsRow
            key={i}
            facts={(block.items ?? []).map((row) => ({ value: row.value, caption: row.label }))}
          />
        );
      case 'steps':
        return (
          <Steps
            key={i}
            items={(block.items ?? []).map((s) => ({ title: ltr(s.title), text: ltr(s.text) }))}
          />
        );
      case 'faq':
        if (i !== firstFaq || faqs.length === 0) return null;
        return (
          <section key={i} aria-labelledby={FAQ_ID} className="grid gap-4">
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
        );
    }
  });
  return (
    <div data-page-type="guide">
      <PageHero
        compact
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={ltr(guide.title)}
        summary={guide.lead ? ltr(guide.lead) : undefined}
        note={
          <ArticleMeta
            updatedAt={guide.updatedAt}
            reviewer={
              reviewer ? (
                <>
                  {reviewerPath ? (
                    <TextLink href={reviewerPath}>{dentistName(reviewer.name)}</TextLink>
                  ) : (
                    dentistName(reviewer.name)
                  )}
                  {reviewedAt ? (
                    <span className="font-normal text-ink-muted">
                      {' '}
                      {t('pages.guide.reviewedOn')}{' '}
                      <time dateTime={reviewedAt.toISOString()}>
                        {formatJalali(reviewedAt, 'd MMMM yyyy')}
                      </time>
                    </span>
                  ) : null}
                </>
              ) : undefined
            }
          />
        }
      />
      <div
        data-section="reading"
        data-family="K"
        className="mx-auto w-full max-w-content px-gutter pb-section"
      >
        {/* The contents list sits beside the reading column, not across the leftover width. */}
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
            {body}
            <SourceList id={SOURCES_ID} items={sources} />
            {/* The CTA map's one service link (templates 5.11), whatever the body links to. */}
            <TextLink
              standalone
              href={PAGE_PATHS['services-hub']}
              className="-ms-2 justify-self-start"
            >
              {t('pages.allServices')}
            </TextLink>
          </article>
        </div>
      </div>
      <PageBooking clinic={clinic} />
      <JsonLd
        data={jsonLdGraph(
          guidePageNode({
            path,
            name: guide.title,
            description: guide.lead,
            reviewer: reviewer ? { name: dentistName(reviewer.name), path: reviewerPath } : null,
            lastReviewed: guide.reviewedAt,
            dateModified: guide.updatedAt,
          }),
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          faqPageNode(faqs.map(({ question, answer }) => ({ question, answer }))),
        )}
      />
    </div>
  );
}
