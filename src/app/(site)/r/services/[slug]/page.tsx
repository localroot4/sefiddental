import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getPublished } from '@/lib/data/published';
import { normalizePath } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs } from '@/lib/seo/siteInputs';

// Route probe (freeze decision 48) for the public path /خدمات/<slug>: the proxy rewrites it to this
// ASCII folder, because Next 16.4 never matches a dynamic segment under a Persian folder in a
// production build (proxyRules routeRewrite). Proves the rewrite, NFC decoding of the slug and tag
// revalidation (col:services). Phase 4 replaces the body with the service template.
type Props = { params: Promise<{ slug: string }> };

async function serviceFor(params: Props['params']) {
  // Same decoding and letter normalization as the redirects table and the canonical redirect.
  const slug = normalizePath(`/${(await params).slug}`).slice(1);
  const [service] = await getPublished('services', { where: { slug: { equals: slug } }, limit: 1 });
  return service ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = await serviceFor(params);
  if (!service) return {};
  const { seo } = await getSiteInputs();
  return buildMetadata(
    {
      path: `/خدمات/${service.slug}`,
      title: service.h1,
      seo: {
        title: service.seo?.title,
        description: service.seo?.description,
        noindex: service.seo?.noindex,
      },
      kind: 'page',
    },
    seo,
  );
}

export default async function ServiceProbe({ params }: Props) {
  const service = await serviceFor(params);
  if (!service) notFound();
  return (
    <section className="mx-auto w-full max-w-content px-gutter py-section">
      <h1 className="font-display text-display-2 text-ink">{service.h1}</h1>
    </section>
  );
}
