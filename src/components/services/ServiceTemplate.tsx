import type { ReactNode } from 'react';

import { JsonLd } from '@/components/seo/JsonLd';
import { Alert } from '@/components/ui/Alert';
import { ArticleMeta, SourceList, Toc } from '@/components/ui/Article';
import { ButtonLink } from '@/components/ui/Button';
import { CardRail, DentistCard, ServiceCard } from '@/components/ui/Cards';
import { CompareSlider } from '@/components/ui/CompareSlider';
import { FactsRow, Steps } from '@/components/ui/Content';
import { Icon } from '@/components/ui/Icon';
import { heroTitleSize, PageHero, Section } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { TextLink } from '@/components/ui/TextLink';
import { EMERGENCY_PATH, t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getCases, getDoctors, getTestimonials } from '@/lib/data/content';
import { getClinic, getSeoDefaults } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';
import { breadcrumbNode, faqPageNode, jsonLdGraph, serviceNode } from '@/lib/seo/jsonld';
import type { Doctor, Service } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';
import { HomeBookingPrefill } from '@/components/home/HomeBookingPrefill';

import { RestorationTiers, TIERS_ANCHOR } from './RestorationTiers';
import { RichBody } from './RichBody';
import {
  Alternating,
  BookingBlock,
  FaqBlock,
  FILL_GRID,
  mediaOf,
  ServiceSection,
  type Tone,
} from './sections';
import { headingAnchors, relatedServices, serviceFacts, splitBody, whatsappHref } from './view';

const idOf = (value: number | { id: number } | null | undefined): number | null =>
  typeof value === 'object' && value !== null ? value.id : (value ?? null);

/**
 * T-service (docs/ia.md, every section in order; an empty section is not rendered): hero (A),
 * facts (B), tiers (D, restoration), what it is (K), steps (G), cases (E), dentists (F), one
 * testimonial (H), FAQ (I), related services (C), booking (J).
 */
export async function ServiceTemplate({ service }: { service: Service }) {
  const [tree, clinic, seoDefaults, tiers, doctors, cases, testimonials] = await Promise.all([
    getServiceTree(),
    getClinic(),
    getSeoDefaults(),
    getPublished('service-tiers', { where: { service: { equals: service.id } }, sort: 'order' }),
    getDoctors(),
    getCases({ service: service.id }),
    getTestimonials({ service: service.id }),
  ]);
  const path = buildPath('services', service) as string;
  const category = tree.find((c) => c.id === idOf(service.category)) ?? null;
  const booking = `${PAGE_PATHS.booking}?service=${encodeURIComponent(service.key)}`;
  const whatsapp =
    clinic.phones.whatsappVerified && clinic.phones.whatsapp
      ? whatsappHref(clinic.phones.whatsapp, service.navLabel)
      : null;
  const heroTrack = (event: 'booking_open' | 'call_click' | 'whatsapp_click') => ({
    event,
    location: 'hero' as const,
    serviceKey: service.key,
  });

  const crumbs = [
    { label: t('services.crumb.home'), href: '/' },
    { label: t('services.crumb.hub'), href: PAGE_PATHS['services-hub'] },
    ...(category && !category.standalone && category.path
      ? [{ label: category.title, href: category.path }]
      : []),
    { label: service.navLabel, href: path },
  ];
  const { reading, steps } = splitBody(service.body);
  const contents = reading.flatMap((b) => (b.blockType === 'content' ? [b.body] : []));
  const { ids, toc } = headingAnchors(contents, [TIERS_ANCHOR]);
  const faqs = (service.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const hero = mediaOf(service.heroMedia);
  const reviewer = publishedDoctor(service.reviewedBy);
  const sources = (service.sources ?? []).map((s) => ({ label: s.title, href: s.url }));
  const team = doctors.filter((d) => d.services.some((s) => s.id === service.id));
  const pairs = cases.flatMap((c) => {
    const before = mediaOf(c.before);
    const after = mediaOf(c.after);
    return before && after ? [{ ...c, before, after }] : [];
  });
  const featured = pairs[0];
  const voice = testimonials.find((v) => mediaOf(v.poster) || v.quote || v.transcriptSummary);
  const related = relatedServices(
    {
      id: service.id,
      categoryId: idOf(service.category),
      relatedIds: (service.relatedServices ?? []).flatMap((r) => idOf(r) ?? []),
    },
    tree,
  );

  // Sections 3 to 10 in docs/ia.md order; each renders only with its content.
  const sections: Array<((tone: Tone) => ReactNode) | null> = [
    tiers.length
      ? (tone) => (
          <ServiceSection
            id="tiers"
            anchor={TIERS_ANCHOR}
            family="D"
            title={t('services.tiers.heading')}
            tone={tone}
          >
            {/* One primary CTA for the section; it carries the tier the visitor picks (G13). */}
            <RestorationTiers service={service} tiers={tiers} />
          </ServiceSection>
        )
      : null,
    reading.length
      ? (tone) => (
          <div data-section="about" data-family="K">
            <Section tone={tone}>
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-16">
                <div className="grid min-w-0 content-start gap-8">
                  {reading.map((block, i) =>
                    block.blockType === 'content' ? (
                      <RichBody key={block.id ?? i} data={block.body} ids={ids} />
                    ) : (
                      <Alert
                        key={block.id ?? i}
                        tone={block.tone ?? 'info'}
                        title={ltr(block.text)}
                        className="max-w-measure"
                      />
                    ),
                  )}
                  {reviewer ? (
                    <ArticleMeta reviewer={`${t('services.dentists.title')} ${reviewer.name}`} />
                  ) : null}
                  <SourceList id="sources" items={sources} />
                </div>
                <Toc items={toc} className="self-start" />
              </div>
            </Section>
          </div>
        )
      : null,
    steps.length
      ? (tone) => (
          <ServiceSection
            id="steps"
            family="G"
            title={t('services.steps.heading')}
            tone={tone}
            split
          >
            <Steps
              items={steps.map((step) => ({ title: ltr(step.title), text: ltr(step.text) }))}
            />
          </ServiceSection>
        )
      : null,
    featured
      ? (tone) => (
          <ServiceSection
            id="cases"
            family="E"
            title={t('services.cases.heading')}
            tone={tone}
            action={
              <TextLink standalone href={PAGE_PATHS.cases} className="-ms-2">
                {t('services.cases.all')}
              </TextLink>
            }
          >
            <div className="grid gap-8 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:items-center lg:gap-16">
              <figure className="grid gap-3" data-service-key={service.key}>
                <CompareSlider
                  before={
                    <Picture
                      media={featured.before}
                      crop="square"
                      sizes="(min-width: 744px) 28rem, 100vw"
                    />
                  }
                  after={
                    <Picture
                      media={featured.after}
                      crop="square"
                      sizes="(min-width: 744px) 28rem, 100vw"
                    />
                  }
                  handle={
                    <span className="flex">
                      <Icon name="caret-back" size="sm" />
                      <Icon name="caret-forward" size="sm" />
                    </span>
                  }
                  labels={{
                    before: t('ui.compare.before'),
                    after: t('ui.compare.after'),
                    slider: t('ui.compare.label'),
                    percent: t('ui.compare.percent'),
                  }}
                />
                <figcaption className="text-small text-pretty text-ink-muted">
                  {t('ui.compare.consent')}
                </figcaption>
              </figure>
              <div className="grid content-start gap-3">
                <h3 className="text-heading font-semibold">{ltr(featured.title)}</h3>
                {featured.notes ? (
                  <p className="max-w-measure text-body text-ink-muted">{ltr(featured.notes)}</p>
                ) : null}
              </div>
            </div>
          </ServiceSection>
        )
      : null,
    team.length
      ? (tone) => (
          <ServiceSection
            id="dentists"
            family="F"
            title={t('services.dentists.heading')}
            tone={tone}
            action={
              <TextLink standalone href={PAGE_PATHS['dentists-hub']} className="-ms-2">
                {t('services.dentists.all')}
              </TextLink>
            }
          >
            <CardRail label={t('services.dentists.rail')}>
              {team.map((doctor) => {
                const photo = mediaOf(doctor.photo);
                return (
                  <DentistCard
                    key={doctor.id}
                    name={`${t('services.dentists.title')} ${doctor.name}`}
                    specialty={doctor.specialty}
                    councilLabel={t('ui.dentist.council')}
                    councilNumber={doctor.councilNumber}
                    href={buildPath('doctors', doctor) ?? undefined}
                    media={
                      photo ? (
                        <Picture
                          media={photo}
                          crop="portrait"
                          sizes="(min-width: 1024px) 26rem, 84vw"
                        />
                      ) : null
                    }
                  />
                );
              })}
            </CardRail>
          </ServiceSection>
        )
      : null,
    voice
      ? (tone) => {
          const poster = mediaOf(voice.poster);
          const summary = voice.transcriptSummary || voice.quote;
          return (
            <ServiceSection
              id="voice"
              family="H"
              title={t('services.voice.heading')}
              tone={tone}
              split
            >
              {/* No captions file exists yet, so the poster and the written summary stand in for
                  the video (WCAG 1.2.2; the same rule as the home voices). */}
              <div className="grid max-w-[24rem] content-start gap-3">
                <TestimonialCard
                  label={ltr(voice.patientLabel)}
                  consent={t('services.voice.consent')}
                  media={
                    poster ? (
                      <Picture
                        media={poster}
                        crop="portrait"
                        sizes="(min-width: 744px) 24rem, 100vw"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-surface-sunken" />
                    )
                  }
                />
                {summary ? <p className="text-small text-ink-muted">{ltr(summary)}</p> : null}
              </div>
            </ServiceSection>
          );
        }
      : null,
    faqs.length
      ? (tone) => (
          <FaqBlock
            faqs={faqs}
            clinic={clinic}
            whatsapp={whatsapp}
            booking={booking}
            serviceKey={service.key}
            tone={tone}
          />
        )
      : null,
    related.length
      ? (tone) => (
          <ServiceSection
            id="related"
            family="C"
            title={t('services.related.heading')}
            tone={tone}
            action={
              <TextLink standalone href={PAGE_PATHS['services-hub']} className="-ms-2">
                {t('services.allServices')}
              </TextLink>
            }
          >
            <ul className={FILL_GRID}>
              {related.map((item) => (
                <li key={item.id}>
                  <ServiceCard
                    href={item.path}
                    title={item.navLabel}
                    line={item.summary ? ltr(item.summary) : undefined}
                    accent={item.accent}
                    icon={item.icon}
                  />
                </li>
              ))}
            </ul>
            <TextLink standalone href={PAGE_PATHS.pricing} className="mt-6 -ms-2">
              {t('services.pricing').replaceAll('{name}', service.navLabel)}
            </TextLink>
          </ServiceSection>
        )
      : null,
  ];

  const facts = serviceFacts(service);
  return (
    <div data-page-type="service">
      <PageHero
        titleSize={heroTitleSize(service.h1)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={ltr(service.h1)}
        summary={service.summary ? ltr(service.summary) : undefined}
        actions={
          <>
            <ButtonLink
              size="lg"
              href={booking}
              track={heroTrack('booking_open')}
              data-booking-cta=""
            >
              {t('services.book')}
            </ButtonLink>
            {whatsapp ? (
              <ButtonLink
                size="lg"
                variant="secondary"
                href={whatsapp}
                track={heroTrack('whatsapp_click')}
              >
                {t('services.whatsapp')}
              </ButtonLink>
            ) : (
              // WhatsApp stays hidden until the number is verified (freeze F12): the call is
              // the secondary action meanwhile.
              <ButtonLink
                size="lg"
                variant="secondary"
                href={telHref(clinic.phones.landline)}
                track={heroTrack('call_click')}
                data-call-sheet=""
              >
                {t('call.label')}
              </ButtonLink>
            )}
          </>
        }
        note={
          service.emergencyLink ? (
            <TextLink standalone href={EMERGENCY_PATH} className="-ms-2">
              {t('urgent.label')}
            </TextLink>
          ) : undefined
        }
        media={
          <MediaFrame ratio="hero">
            {hero ? (
              <Picture
                media={hero}
                priority
                sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
              />
            ) : (
              <MediaPlaceholder caption={t('services.photo.service')} />
            )}
          </MediaFrame>
        }
      />
      {facts.length ? (
        <div
          data-section="facts"
          data-family="B"
          className="mx-auto w-full max-w-content px-gutter pb-12 md:pb-16"
        >
          <FactsRow
            facts={facts.map((f) => ({ ...f, value: ltr(f.value) }))}
            label={t('services.facts.label')}
            className="border-y border-line py-6"
          />
        </div>
      ) : null}
      <Alternating sections={sections} />
      <BookingBlock clinic={clinic} service={service.slug} />
      {tiers.length ? <HomeBookingPrefill /> : null}
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          serviceNode({
            name: service.h1,
            serviceType: service.navLabel,
            path,
            description: service.summary,
            areaServed: seoDefaults.areaServed ?? undefined,
          }),
          faqPageNode(faqs),
        )}
      />
    </div>
  );
}

/** The reviewer when it is a published dentist (a draft reviewer is not shown). */
function publishedDoctor(value: number | Doctor | null | undefined): Doctor | null {
  return typeof value === 'object' && value !== null && value._status === 'published'
    ? value
    : null;
}
