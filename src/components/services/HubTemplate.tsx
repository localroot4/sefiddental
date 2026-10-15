import { JsonLd } from '@/components/seo/JsonLd';
import { CategoryIcon, CategoryTile, TileGrid } from '@/components/ui/Cards';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { Picture } from '@/components/ui/Picture';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getServiceTree } from '@/lib/data/catalog';
import { getClinic } from '@/lib/data/globals';
import { PAGE_PATHS } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';
import { breadcrumbNode, faqPageNode, itemListNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';
import { Alternating, BookingBlock, FaqBlock, mediaOf, ServiceSection } from './sections';
import { whatsappHref } from './view';

/**
 * T-services-hub (docs/ia.md): hero (A, no CTA), the five groups as a bento (C), every service by
 * group (K), FAQ when the page has one (I), booking without a service (J).
 */
export async function HubTemplate({ page }: { page: Page }) {
  const [tree, clinic] = await Promise.all([getServiceTree(), getClinic()]);
  const groups = tree.filter((category) => category.path);
  const hero = mediaOf(page.heroMedia);
  const faqs = (page.blocks ?? []).flatMap((block) =>
    block.blockType === 'faq'
      ? (block.items ?? []).map(({ question, answer }) => ({ question, answer }))
      : [],
  );
  const whatsapp =
    clinic.phones.whatsappVerified && clinic.phones.whatsapp
      ? whatsappHref(clinic.phones.whatsapp)
      : null;
  const crumbs = [
    { label: t('services.crumb.home'), href: '/' },
    { label: t('services.crumb.hub'), href: PAGE_PATHS['services-hub'] },
  ];
  const services = groups.flatMap((group) => group.services);
  return (
    <div data-page-type="services_hub">
      <PageHero
        titleSize={heroTitleSize(page.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={ltr(page.title)}
        summary={page.lead ? ltr(page.lead) : undefined}
        media={
          <MediaFrame ratio="hero">
            {hero ? (
              <Picture
                media={hero}
                priority
                sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
              />
            ) : (
              <MediaPlaceholder caption={t('services.photo.hub')} />
            )}
          </MediaFrame>
        }
      />
      <Alternating
        sections={[
          groups.length
            ? (tone) => (
                <ServiceSection id="groups" family="C" title={t('services.hub.groups')} tone={tone}>
                  <TileGrid>
                    {groups.map((group, i) => (
                      <CategoryTile
                        key={group.key}
                        href={group.path as string}
                        title={group.title}
                        accent={group.accent}
                        icon={group.icon}
                        headingLevel="h3"
                        list={
                          group.standalone
                            ? (group.summary ?? group.services[0]?.summary ?? undefined)
                            : group.services.map((s) => s.navLabel).join('، ')
                        }
                        count={
                          group.standalone
                            ? undefined
                            : `${formatNumberFa(group.services.length)} ${t('services.hub.unit')}`
                        }
                        featured={i === 0}
                        media={
                          i === 0 ? (
                            <MediaPlaceholder caption={t('services.photo.tile')} />
                          ) : undefined
                        }
                      />
                    ))}
                  </TileGrid>
                </ServiceSection>
              )
            : null,
          services.length
            ? (tone) => (
                <ServiceSection id="list" family="K" title={t('services.hub.list')} tone={tone}>
                  <div className="grid gap-x-16 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                    {groups.map((group) =>
                      group.services.length ? (
                        <section
                          key={group.key}
                          aria-labelledby={`hub-group-${group.key}`}
                          className="grid content-start gap-3"
                        >
                          <h3
                            id={`hub-group-${group.key}`}
                            className="flex items-center gap-2 text-heading font-semibold"
                          >
                            <CategoryIcon accent={group.accent} icon={group.icon} />
                            {group.title}
                          </h3>
                          <ul className="grid gap-1">
                            {group.services.map((service) => (
                              <li key={service.id} className="grid">
                                <TextLink standalone href={service.path} className="-ms-2">
                                  {service.navLabel}
                                </TextLink>
                                {service.summary ? (
                                  <p className="max-w-measure text-small text-ink-muted">
                                    {ltr(service.summary)}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </section>
                      ) : null,
                    )}
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
