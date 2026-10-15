import { ga4Id } from '@/components/analytics/Analytics';
import { JsonLd } from '@/components/seo/JsonLd';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { Alert } from '@/components/ui/Alert';
import { Toc } from '@/components/ui/Article';
import { PhoneNumber } from '@/components/ui/Contact';
import { PageHero } from '@/components/ui/Layout';
import { ltr } from '@/components/ui/ltr';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { t } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { contentBodies } from './view';

const ANALYTICS_ID = 'analytics';
const CONTACT_ID = 'contact';
const H2 = 'mb-3 text-heading font-semibold';

/**
 * T-legal (docs/ia.md): the privacy draft (freeze G17) in the reading column (K) with its
 * contents list from 1024 px, no booking block. The seeded text states what the forms store and
 * who sees it; the code adds what follows settings: the GA4 paragraph only while GA4 is on, right
 * after the seeded text, which ends with the cookies section (PRV2), and the clinic phone for a
 * question or a deletion request.
 */
export async function Privacy({ page }: { page: Page }) {
  const [clinic, features] = await Promise.all([getClinic(), getFeatures()]);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: page.title, href: PAGE_PATHS.privacy },
  ];
  const ga4 = ga4Id(features) !== null;
  const { ids, toc } = headingAnchors(contentBodies(page.blocks), [ANALYTICS_ID, CONTACT_ID]);
  return (
    <div data-page-type="legal">
      <PageHero
        compact
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={page.title}
        summary={page.lead ? ltr(page.lead) : undefined}
      />
      <div
        data-section="reading"
        data-family="K"
        className="mx-auto w-full max-w-content px-gutter pb-section"
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,var(--measure))_16rem] lg:justify-start lg:gap-16">
          <Toc
            items={[
              ...toc,
              ...(ga4 ? [{ id: ANALYTICS_ID, label: t('pages.privacy.ga4') }] : []),
              { id: CONTACT_ID, label: t('pages.privacy.contact') },
            ]}
            className="lg:col-start-2 lg:row-start-1 lg:self-start"
          />
          <article className="grid max-w-measure content-start gap-8 lg:col-start-1 lg:row-start-1">
            {(page.blocks ?? []).map((block, i) =>
              block.blockType === 'content' ? (
                <RichBody key={i} data={block.body} ids={ids} />
              ) : block.blockType === 'callout' ? (
                <Alert
                  key={i}
                  tone={block.tone === 'warning' ? 'warning' : 'info'}
                  title={ltr(block.text)}
                />
              ) : null,
            )}
            {ga4 ? (
              <section aria-labelledby={ANALYTICS_ID}>
                <h2 id={ANALYTICS_ID} className={H2}>
                  {t('pages.privacy.ga4')}
                </h2>
                <p className="text-body">{t('pages.privacy.ga4Text')}</p>
              </section>
            ) : null}
            <section aria-labelledby={CONTACT_ID}>
              <h2 id={CONTACT_ID} className={H2}>
                {t('pages.privacy.contact')}
              </h2>
              <p className="text-body">
                {t('pages.privacy.contactText')}{' '}
                {/* Opted into the closed-hours sheet like every other call link. */}
                <span data-call-sheet="">
                  <PhoneNumber
                    e164={clinic.phones.landline}
                    link
                    track={{ event: 'call_click', location: 'page' }}
                  />
                </span>
              </p>
            </section>
          </article>
        </div>
      </div>
      <JsonLd
        data={jsonLdGraph(breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))))}
      />
    </div>
  );
}
