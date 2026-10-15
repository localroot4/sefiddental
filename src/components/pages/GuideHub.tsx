import { JsonLd } from '@/components/seo/JsonLd';
import { heroTitleSize, PageHero } from '@/components/ui/Layout';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getGuides } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, itemListNode, jsonLdGraph } from '@/lib/seo/jsonld';
import type { Page } from '@/payload-types';

import { GuideList } from './lists';
import { Band, HeroMedia, PageBooking } from './parts';

/**
 * T-guide-hub (docs/ia.md): hero (A), the published guides (C) or, while every guide waits for
 * its reviewing dentist (gaps 2, 42), an empty state; one link to the services; booking (J).
 */
export async function GuideHub({ page }: { page: Page }) {
  const [guides, clinic] = await Promise.all([getGuides(), getClinic()]);
  const crumbs = [
    { label: t('pages.crumb.home'), href: '/' },
    { label: page.title, href: PAGE_PATHS['guide-hub'] },
  ];
  const items = guides.flatMap((guide) => {
    const path = buildPath('pages', guide);
    return path ? [{ ...guide, path }] : [];
  });
  return (
    <div data-page-type="guide_hub">
      <PageHero
        titleSize={heroTitleSize(page.title)}
        breadcrumbs={<Breadcrumbs items={crumbs} />}
        title={page.title}
        summary={page.lead ?? undefined}
        media={<HeroMedia media={page.heroMedia} caption={t('pages.photo.guideHub')} />}
      />
      <Band id="guides" family="C" title={t('pages.guides.list')} tone="sunken">
        <GuideList guides={items} />
        {/* After the list, not as the band's action: that slot reads as «all guides». */}
        <p className="mt-6">
          <TextLink standalone href={PAGE_PATHS['services-hub']} className="-ms-2">
            {t('pages.allServices')}
          </TextLink>
        </p>
      </Band>
      <PageBooking clinic={clinic} />
      <JsonLd
        data={jsonLdGraph(
          breadcrumbNode(crumbs.map((c) => ({ name: c.label, path: c.href }))),
          itemListNode(items.map((guide) => ({ name: guide.title, path: guide.path }))),
        )}
      />
    </div>
  );
}
