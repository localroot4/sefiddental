import { JsonLd } from '@/components/seo/JsonLd';
import { RichBody } from '@/components/services/RichBody';
import { headingAnchors } from '@/components/services/view';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { t } from '@/i18n/fa';
import { getDoctors } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, itemListNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { DentistList } from './lists';
import { Alternating, Band, HeroMedia, PageBooking } from './parts';
import { contentBodies, dentistName } from './view';

/**
 * T-dentists-hub (docs/ia.md): hero (A), the dentists (F) or, before the client publishes one,
 * an empty state that names no one (freeze F9), how the team works when the page has that text
 * (K), booking (J).
 */
export async function DentistsHub({ page }: { page: Page }) {
  const [doctors, clinic] = await Promise.all([getDoctors(), getClinic()]);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: t('pages.dentists.crumb'), href: PAGE_PATHS['dentists-hub'] },
  ];
  const bodies = contentBodies(page.blocks);
  const { ids } = headingAnchors(bodies);
  return (
    <div data-page-type="dentists_hub">
      <PageHero
        titleSize={heroTitleSize(page.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={page.title}
        // The lead introduces the dentists; until one is published it would promise what the
        // empty state below takes back.
        summary={doctors.length ? (page.lead ?? undefined) : undefined}
        media={<HeroMedia media={page.heroMedia} caption={t('pages.photo.dentistsHub')} />}
      />
      <Alternating
        sections={[
          (tone) => (
            <Band id="dentists" family="F" title={t('pages.dentists.list')} tone={tone}>
              <DentistList doctors={doctors} />
            </Band>
          ),
          bodies.length
            ? (tone) => (
                <Band id="team" family="K" tone={tone}>
                  <div className="grid gap-8">
                    {bodies.map((body, i) => (
                      <RichBody key={i} data={body} ids={ids} />
                    ))}
                  </div>
                </Band>
              )
            : null,
        ]}
      />
      <PageBooking clinic={clinic} />
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          itemListNode(
            doctors.flatMap((doctor) => {
              const path = buildPath('doctors', doctor);
              return path ? [{ name: dentistName(doctor.name), path }] : [];
            }),
          ),
        )}
      />
    </div>
  );
}
