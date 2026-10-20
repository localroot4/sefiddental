import { JsonLd } from '@/components/seo/JsonLd';
import { ltr } from '@/components/ui/ltr';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { ServiceCard } from '@/components/ui/Cards';
import { CompareSlider } from '@/components/ui/CompareSlider';
import { FactsRow } from '@/components/ui/Content';
import { Icon } from '@/components/ui/Icon';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getArticlesForDoctor, getCases, getDoctorBySlug } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { toPersianDigits } from '@/lib/persianText';
import { telHref } from '@/lib/phone';
import { breadcrumbNode, jsonLdGraph, physicianNode } from '@/lib/seo/jsonld';

import { articlePath } from './articleParts';
import { Alternating, Band, PageBooking } from './parts';
import { dentistFacts, dentistName, mediaOf, paragraphs, portraitImage, withName } from './view';

type Doctor = NonNullable<Awaited<ReturnType<typeof getDoctorBySlug>>>;

/**
 * T-dentist (docs/ia.md): the portrait split (A) with the council number as an LTR island, the
 * credentials (B), the bio (K), the services the dentist performs (C), their published cases (E),
 * the articles they wrote or reviewed with the role (K list, H24), booking (J). Empty sections
 * stay hidden.
 */
export async function DentistProfile({ doctor }: { doctor: Doctor }) {
  const [clinic, tree, cases, articles] = await Promise.all([
    getClinic(),
    getServiceTree(),
    getCases({ doctor: doctor.id, limit: 3 }),
    getArticlesForDoctor(doctor.id),
  ]);
  const name = dentistName(doctor.name);
  const path = buildPath('doctors', doctor) as string;
  const photo = mediaOf(doctor.photo);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: t('pages.dentists.crumb'), href: PAGE_PATHS['dentists-hub'] },
    { label: name, href: path },
  ];
  const facts = dentistFacts(doctor);
  const bio = paragraphs(doctor.bio);
  // The catalogue gives each service its path and category accent; drafts are already dropped.
  const catalog = new Map(
    tree.flatMap((category) =>
      category.services.map((service) => [service.id, { ...service, category }] as const),
    ),
  );
  const services = doctor.services.flatMap((service) => catalog.get(service.id) ?? []);
  const pairs = cases.flatMap((c) => {
    const before = mediaOf(c.before);
    const after = mediaOf(c.after);
    return before && after ? [{ ...c, before, after }] : [];
  });
  return (
    <div data-page-type="dentist">
      <PageHero
        titleSize={heroTitleSize(name)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={name}
        summary={doctor.specialty}
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
            <ButtonLink
              variant="secondary"
              size="lg"
              href={telHref(clinic.phones.landline)}
              track={{ event: 'call_click', location: 'hero' }}
              data-call-sheet=""
            >
              {t('call.label')}
            </ButtonLink>
          </>
        }
        note={
          <p className="text-small text-ink-muted">
            {t('ui.dentist.council')} <bdi dir="ltr">{toPersianDigits(doctor.councilNumber)}</bdi>
          </p>
        }
        media={
          <MediaFrame ratio="4:5">
            {photo ? (
              <Picture
                media={photo}
                crop="portrait"
                priority
                alt={name}
                sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
              />
            ) : (
              <MediaPlaceholder caption={t('pages.photo.dentist')} />
            )}
          </MediaFrame>
        }
      />
      <Alternating
        sections={[
          facts.length
            ? (tone) => (
                <Band id="facts" family="B" title={t('pages.dentist.credentials')} tone={tone}>
                  <FactsRow facts={facts} />
                </Band>
              )
            : null,
          bio.length
            ? (tone) => (
                <Band id="bio" family="K" title={withName('pages.dentist.about', name)} tone={tone}>
                  <div className="grid max-w-measure gap-4 text-body-lg">
                    {bio.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </Band>
              )
            : null,
          services.length
            ? (tone) => (
                <Band
                  id="services"
                  family="C"
                  title={withName('pages.dentist.services', name)}
                  tone={tone}
                >
                  <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {services.map((service) => (
                      <li key={service.id} className="grid">
                        <ServiceCard
                          href={service.path}
                          title={service.navLabel}
                          line={service.summary ? ltr(service.summary) : undefined}
                          accent={service.category.accent}
                          icon={service.category.icon}
                        />
                      </li>
                    ))}
                  </ul>
                </Band>
              )
            : null,
          pairs.length
            ? (tone) => (
                <Band
                  id="cases"
                  family="E"
                  title={t('pages.dentist.cases')}
                  action={
                    <TextLink standalone href={PAGE_PATHS.cases} className="-ms-2">
                      {t('pages.cases.all')}
                    </TextLink>
                  }
                  tone={tone}
                >
                  <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {pairs.map((pair) => (
                      <li key={pair.id}>
                        <figure
                          className="grid gap-3"
                          data-service-key={
                            pair.service == null
                              ? undefined
                              : catalog.get(
                                  typeof pair.service === 'object' ? pair.service.id : pair.service,
                                )?.key
                          }
                        >
                          <CompareSlider
                            before={
                              <Picture
                                media={pair.before}
                                crop="square"
                                sizes="(min-width: 744px) 28rem, 100vw"
                              />
                            }
                            after={
                              <Picture
                                media={pair.after}
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
                              slider: `${t('ui.compare.label')}: ${pair.title}`,
                              percent: t('ui.compare.percent'),
                            }}
                          />
                          <figcaption className="grid gap-1">
                            <span className="text-body leading-[1.5] font-semibold">
                              {pair.title}
                            </span>
                            <span className="text-caption text-pretty text-ink-muted">
                              {t('ui.compare.consent')}
                            </span>
                          </figcaption>
                        </figure>
                      </li>
                    ))}
                  </ul>
                </Band>
              )
            : null,
          articles.length
            ? (tone) => (
                <Band id="articles" family="K" title={t('pages.dentist.articles')} tone={tone}>
                  <ul className="grid max-w-measure divide-y divide-line border-y border-line">
                    {articles.map((article) => (
                      <li
                        key={article.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 py-2"
                      >
                        <TextLink standalone href={articlePath(article)} className="-ms-2">
                          {ltr(article.title)}
                        </TextLink>
                        <Badge>{t(`pages.dentist.role.${article.role}`)}</Badge>
                      </li>
                    ))}
                  </ul>
                </Band>
              )
            : null,
        ]}
      />
      <PageBooking clinic={clinic} dentist={doctor.slug} />
      <JsonLd
        data={jsonLdGraph(
          physicianNode({
            name,
            path,
            image: portraitImage(photo)?.url,
            councilNumber: doctor.councilNumber,
          }),
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
        )}
      />
    </div>
  );
}
