import { JsonLd } from '@/components/seo/JsonLd';
import { ServiceCard } from '@/components/ui/Cards';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getClinic } from '@/lib/data/globals';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, faqPageNode, itemListNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { ServiceCategory } from '@/payload-types';

import { firstVisitGuidePath } from './data';
import { ltr } from '@/components/ui/ltr';
import {
  Alternating,
  BookingBlock,
  FaqBlock,
  FILL_GRID,
  mediaOf,
  ServiceSection,
} from './sections';
import { paragraphs, whatsappHref } from './view';

/**
 * T-category (docs/ia.md): hero (A, no CTA), its services (C), the short guide text from the
 * category intro (K, with the pricing page and the first-visit guide), FAQ (I), booking (J).
 */
export async function CategoryTemplate({ category }: { category: ServiceCategory }) {
  const [tree, clinic, guide] = await Promise.all([
    getServiceTree(),
    getClinic(),
    firstVisitGuidePath(),
  ]);
  const path = buildPath('service-categories', category) as string;
  const services = tree.find((c) => c.id === category.id)?.services ?? [];
  const intro = paragraphs(category.intro);
  const faqs = (category.faqs ?? []).map(({ question, answer }) => ({ question, answer }));
  const hero = mediaOf(category.heroMedia);
  const title = category.h1 || category.title;
  const whatsapp =
    clinic.phones.whatsappVerified && clinic.phones.whatsapp
      ? whatsappHref(clinic.phones.whatsapp)
      : null;
  const crumbs = [
    { label: t('services.crumb.home'), href: '/' },
    { label: t('services.crumb.hub'), href: PAGE_PATHS['services-hub'] },
    { label: category.title, href: path },
  ];
  return (
    <div data-page-type="category">
      <PageHero
        titleSize={heroTitleSize(title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={ltr(title)}
        summary={category.summary ? ltr(category.summary) : undefined}
        media={
          <MediaFrame ratio="hero">
            {hero ? (
              <Picture
                media={hero}
                priority
                sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
              />
            ) : (
              <MediaPlaceholder caption={t('services.photo.category')} />
            )}
          </MediaFrame>
        }
      />
      <Alternating
        sections={[
          services.length
            ? (tone) => (
                <ServiceSection
                  id="services"
                  family="C"
                  title={t('services.category.list')}
                  tone={tone}
                >
                  <ul className={FILL_GRID}>
                    {services.map((service) => (
                      <li key={service.id}>
                        <ServiceCard
                          href={service.path}
                          title={service.navLabel}
                          line={service.summary ? ltr(service.summary) : undefined}
                          accent={category.accent}
                          icon={category.icon}
                        />
                      </li>
                    ))}
                  </ul>
                </ServiceSection>
              )
            : null,
          intro.length
            ? (tone) => (
                <ServiceSection
                  id="intro"
                  family="K"
                  title={t('services.category.intro')}
                  tone={tone}
                  split
                >
                  <div className="grid max-w-measure gap-4 text-body">
                    {intro.map((p, i) => (
                      <p key={i}>{ltr(p)}</p>
                    ))}
                    <ul className="-ms-2 flex flex-wrap gap-x-4">
                      <li>
                        <TextLink standalone href={PAGE_PATHS.pricing}>
                          {t('services.category.pricing')}
                        </TextLink>
                      </li>
                      {guide ? (
                        <li>
                          <TextLink standalone href={guide}>
                            {t('services.category.guide')}
                          </TextLink>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </ServiceSection>
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
      <BookingBlock clinic={clinic} />
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          itemListNode(services.map((s) => ({ name: s.navLabel, path: s.path }))),
          faqPageNode(faqs),
        )}
      />
    </div>
  );
}
