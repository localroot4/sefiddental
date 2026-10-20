import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CategoryTemplate } from '@/components/services/CategoryTemplate';
import { resolveServicePath } from '@/components/services/data';
import { ServiceTemplate } from '@/components/services/ServiceTemplate';
import { buildPath } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /خدمات/<slug>: the proxy rewrites it to this ASCII folder (Next 16.4 never matches a dynamic
// segment under a Persian folder in a production build; proxyRules routeRewrite). Services and
// categories share the slug namespace: a service first, else a category with its own page.
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [doc, { seo }] = await Promise.all([
    resolveServicePath((await params).slug),
    getSiteInputs(),
  ]);
  if (!doc) return {};
  if (doc.kind === 'service') {
    return buildMetadata(
      {
        path: buildPath('services', doc.service) as string,
        title: doc.service.h1,
        // templates 1.4: the SEO image, else the hero photo, else the default.
        seo: pageSeoFrom({
          ...doc.service.seo,
          image: doc.service.seo?.image ?? doc.service.heroMedia,
        }),
        kind: 'page',
      },
      seo,
    );
  }
  return buildMetadata(
    {
      path: buildPath('service-categories', doc.category) as string,
      title: doc.category.h1 || doc.category.title,
      seo: pageSeoFrom({
        ...doc.category.seo,
        image: doc.category.seo?.image ?? doc.category.heroMedia,
      }),
      kind: 'page',
      card: 'service-category',
    },
    seo,
  );
}

export default async function ServiceOrCategoryPage({ params }: Props) {
  const doc = await resolveServicePath((await params).slug);
  // Last resort only: the proxy answers an unknown slug with the branded 404 (freeze F10), so this
  // runs just for a slug unpublished within the proxy's memo window.
  if (!doc) notFound();
  return doc.kind === 'service' ? (
    <ServiceTemplate service={doc.service} />
  ) : (
    <CategoryTemplate category={doc.category} />
  );
}
