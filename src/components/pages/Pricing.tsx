import { HomeBookingPrefill } from '@/components/home/HomeBookingPrefill';
import { JsonLd } from '@/components/seo/JsonLd';
import { RestorationTiers, TIERS_ANCHOR } from '@/components/services/RestorationTiers';
import { RichBody } from '@/components/services/RichBody';
import { FaqBlock } from '@/components/services/sections';
import { headingAnchors } from '@/components/services/view';
import { Alert } from '@/components/ui/Alert';
import { ButtonLink } from '@/components/ui/Button';
import { FactsRow } from '@/components/ui/Content';
import { cx } from '@/components/ui/cx';
import { PageHero } from '@/components/ui/Layout';
import { ltr } from '@/components/ui/ltr';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';
import { breadcrumbNode, faqPageNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Clinic, FinancingOption, Page } from '@/payload-types';

import { Alternating, Band, PageBooking } from './parts';
import {
  financingWhatsapp,
  fromPrices,
  moneyLinks,
  shownFinancing,
  tomanInWords,
} from './PricingView';
import { blocksOf, contentBodies, whatsappHref } from './view';

/**
 * T-pricing (docs/ia.md, pricing-tiers-measure 1.2): compact hero (A), how pricing works (K),
 * the restoration tiers with the visitor's choice (D, freeze G13), insurers by name (B, G1),
 * financing options only while enabled (C, G14), FAQ (I), booking (J). Every section without
 * content stays hidden; no price, no «از … تومان» line (brief decision 4).
 */
export async function Pricing({ page }: { page: Page }) {
  const [clinic, features, tree, priced, insurers, financing] = await Promise.all([
    getClinic(),
    getFeatures(),
    getServiceTree(),
    getPublished('services', { where: { priceFrom: { greater_than: 0 } } }),
    getPublished('insurances', { where: { featured: { equals: true } }, sort: 'order' }),
    getPublished('financing-options', { where: { enabled: { equals: true } }, sort: 'order' }),
  ]);
  const restoration = tree.flatMap((c) => c.services).find((s) => s.key === 'restoration');
  const tiers = restoration
    ? await getPublished('service-tiers', {
        where: { service: { equals: restoration.id } },
        sort: 'order',
        depth: 1,
      })
    : [];
  const tierService = typeof tiers[0]?.service === 'object' ? tiers[0].service : null;

  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: page.title, href: PAGE_PATHS.pricing },
  ];
  const story = (page.blocks ?? []).filter(
    (block) => block.blockType === 'content' || block.blockType === 'callout',
  );
  const { ids } = headingAnchors(contentBodies(page.blocks));
  const prices = fromPrices(priced);
  const links = moneyLinks(tree);
  const options = shownFinancing(financing);
  const faqs = blocksOf(page.blocks, 'faq').flatMap((block) =>
    (block.items ?? []).map(({ question, answer }) => ({ question, answer })),
  );
  const whatsapp = whatsappHref(clinic.phones);
  const lead = page.lead ? ltr(page.lead) : null;
  const free = features.freeConsultation ? (
    <span className="font-semibold text-ink">{t('content.freeConsultation')}</span>
  ) : null;

  return (
    <div data-page-type="pricing">
      <PageHero
        compact
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={page.title}
        summary={
          lead || free ? (
            <>
              {lead}
              {lead && free ? ' ' : null}
              {free}
            </>
          ) : undefined
        }
        actions={
          <>
            <ButtonLink
              size="lg"
              href={PAGE_PATHS.booking}
              track={{ event: 'booking_open', location: 'hero' }}
              data-booking-cta=""
            >
              {t('pages.book')}
            </ButtonLink>
            {whatsapp ? (
              <ButtonLink
                size="lg"
                variant="secondary"
                href={whatsapp}
                track={{ event: 'whatsapp_click', location: 'hero' }}
              >
                {t('pages.whatsapp')}
              </ButtonLink>
            ) : (
              // WhatsApp stays hidden until the number is verified (F12): the call meanwhile.
              <ButtonLink
                size="lg"
                variant="secondary"
                href={telHref(clinic.phones.landline)}
                track={{ event: 'call_click', location: 'hero' }}
                data-call-sheet=""
              >
                {t('call.label')}
              </ButtonLink>
            )}
          </>
        }
      />
      <Alternating
        sections={[
          story.length || prices.length || links.length
            ? (tone) => (
                <Band id="how" family="K" title={t('pages.pricing.how')} tone={tone}>
                  <div className="grid max-w-measure gap-8">
                    {story.map((block, i) =>
                      block.blockType === 'content' ? (
                        <RichBody key={i} data={block.body} ids={ids} />
                      ) : (
                        <Alert
                          key={i}
                          tone={block.tone === 'warning' ? 'warning' : 'info'}
                          title={ltr(block.text)}
                        />
                      ),
                    )}
                    {prices.length ? (
                      <section aria-labelledby="prices-title" className="grid gap-3">
                        <h3 id="prices-title" className="text-heading font-semibold">
                          {t('pages.pricing.fromPrices')}
                        </h3>
                        <ul className="grid gap-1">
                          {prices.map((row) => (
                            <li key={row.href}>
                              <TextLink standalone href={row.href} className="-ms-2">
                                {row.label}: {row.price}
                              </TextLink>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                    {links.length ? (
                      <nav aria-labelledby="money-title" className="grid gap-2">
                        <p id="money-title" className="text-small font-semibold">
                          {t('pages.pricing.services')}
                        </p>
                        <ul className="-ms-2 flex flex-wrap gap-x-2">
                          {links.map((service) => (
                            <li key={service.key}>
                              <TextLink standalone href={service.path}>
                                {service.navLabel}
                              </TextLink>
                            </li>
                          ))}
                        </ul>
                      </nav>
                    ) : null}
                  </div>
                </Band>
              )
            : null,
          tiers.length && restoration
            ? (tone) => (
                <Band
                  id="tiers"
                  family="D"
                  title={t('pages.pricing.tiers')}
                  tone={tone}
                  action={
                    <TextLink
                      standalone
                      href={`${restoration.path}#${TIERS_ANCHOR}`}
                      className="-ms-2"
                    >
                      {t('home.restoration.compare')}
                    </TextLink>
                  }
                >
                  <RestorationTiers
                    service={{ key: restoration.key, bookingGroup: tierService?.bookingGroup }}
                    tiers={tiers}
                    summary
                  />
                </Band>
              )
            : null,
          insurers.length
            ? (tone) => (
                <Band id="insurers" family="B" title={t('home.trust.insurance')} tone={tone}>
                  {/* Names only until the logos arrive (gap 39). shortcut: no logo even when
                      uploaded; the media sizes crop, so a logo needs its own size first. */}
                  <FactsRow facts={insurers.map((insurer) => ({ value: insurer.name }))} />
                  <p className="mt-8 max-w-measure text-body text-ink-muted">
                    {t('pages.pricing.insuranceShare')}
                  </p>
                </Band>
              )
            : null,
          options.length
            ? (tone) => (
                <Band id="financing" family="C" title={t('pages.pricing.financing')} tone={tone}>
                  <FinancingList options={options} phones={clinic.phones} />
                </Band>
              )
            : null,
          faqs.length
            ? (tone) => (
                <FaqBlock
                  faqs={faqs}
                  clinic={clinic}
                  whatsapp={whatsapp}
                  booking={PAGE_PATHS.booking}
                  tone={tone}
                />
              )
            : null,
        ]}
      />
      <PageBooking clinic={clinic} />
      {tiers.length ? <HomeBookingPrefill /> : null}
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          faqPageNode(faqs),
        )}
      />
    </div>
  );
}

/**
 * The enabled financing options (family C): one card per option, as many cells as options. The
 * surcharge comes right under the title, before any amount, in ink and never folded away, so it
 * is on screen whenever the title is (acceptance; freeze G14). Then the cap in words, the
 * partner, who applies, the terms and the fixed legal line (copy-guidelines "Legal lines").
 */
export function FinancingList(props: { options: FinancingOption[]; phones: Clinic['phones'] }) {
  // A lone card takes the row and fills it with its terms in two columns, never half a row.
  const lone = props.options.length === 1;
  return (
    <ul className={cx('grid gap-4', !lone && 'lg:grid-cols-2')}>
      {props.options.map((option) => {
        const amount = tomanInWords(option.maxAmountToman);
        const whatsapp = financingWhatsapp(props.phones, option.title);
        const rows = [
          [t('pages.pricing.maxAmount'), amount ? `${t('pages.pricing.upTo')} ${amount}` : null],
          [t('pages.pricing.provider'), option.provider],
          [t('pages.pricing.whoApplies'), option.whoApplies],
          [t('pages.pricing.terms'), option.terms],
        ] as const;
        return (
          <li
            key={option.id}
            data-financing={option.key}
            className="grid content-start gap-4 rounded-card border-[1.5px] border-line bg-surface-raised p-6"
          >
            <h3 className="text-heading font-semibold">{ltr(option.title)}</h3>
            <p className="text-body font-semibold text-ink">
              {t('pages.pricing.surcharge')} {ltr(option.surchargeNote ?? '')}
            </p>
            <dl className={cx('grid items-start gap-3', lone && 'md:grid-cols-2 md:gap-x-8')}>
              {rows.map(([term, value]) =>
                value ? (
                  <div key={term} className="grid gap-[2px]">
                    <dt className="text-caption font-medium text-ink-muted">{term}</dt>
                    <dd className="text-small whitespace-pre-line">{ltr(value)}</dd>
                  </div>
                ) : null,
              )}
            </dl>
            <p className="text-small text-ink-muted">{t('pages.pricing.finalDetails')}</p>
            {whatsapp ? (
              <ButtonLink
                variant="secondary"
                href={whatsapp}
                track={{ event: 'whatsapp_click', location: 'section' }}
                className="justify-self-start"
              >
                {t('pages.whatsapp')}
              </ButtonLink>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
