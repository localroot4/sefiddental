import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Guide } from '@/components/pages/Guide';
import { metaDescription } from '@/components/pages/view';
import { getGuideBySlug } from '@/lib/data/content';
import { buildPath } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /راهنمای-بیمار/<slug>: the proxy rewrites it to this ASCII folder. Guide slugs are editable
// (a change writes a 301), so a guide is never a static folder (code conventions T15).
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [guide, { seo }] = await Promise.all([
    getGuideBySlug((await params).slug),
    getSiteInputs(),
  ]);
  if (!guide) return {};
  return buildMetadata(
    {
      path: buildPath('pages', guide) as string,
      title: guide.title,
      description: metaDescription(guide.lead),
      seo: pageSeoFrom({ ...guide.seo, image: guide.seo?.image ?? guide.heroMedia }),
      kind: 'page',
      modifiedAt: guide.updatedAt,
    },
    seo,
  );
}

export default async function GuidePage({ params }: Props) {
  const guide = await getGuideBySlug((await params).slug);
  // Last resort only: the proxy answers an unknown slug with the branded 404 (freeze F10).
  if (!guide) notFound();
  return <Guide guide={guide} />;
}
