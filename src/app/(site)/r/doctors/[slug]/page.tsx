import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { DentistProfile } from '@/components/pages/DentistProfile';
import { dentistName, metaDescription } from '@/components/pages/view';
import { getDoctorBySlug } from '@/lib/data/content';
import { buildPath } from '@/lib/paths';
import { buildMetadata } from '@/lib/seo/metadata';
import { getSiteInputs, pageSeoFrom } from '@/lib/seo/siteInputs';

// /پزشکان/<slug>: the proxy rewrites it to this ASCII folder (Next 16.4 never matches a dynamic
// segment under a Persian folder in a production build; proxyRules routeRewrite).
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [doctor, { seo }] = await Promise.all([
    getDoctorBySlug((await params).slug),
    getSiteInputs(),
  ]);
  if (!doctor) return {};
  return buildMetadata(
    {
      path: buildPath('doctors', doctor) as string,
      // keyword map: «دکتر {نام}، {تخصص} | کلینیک سفید» (short suffix, kind dentist).
      title: `${dentistName(doctor.name)}، ${doctor.specialty}`,
      // The bio when it fits 120 to 160 characters; else the site default (the crawl flags it).
      description: metaDescription(doctor.bio),
      // H14: the photo's og size, not the portrait, unless the page names its own image.
      seo: pageSeoFrom({ ...doctor.seo, image: doctor.seo?.image ?? doctor.photo }),
      kind: 'dentist',
    },
    seo,
  );
}

export default async function DentistPage({ params }: Props) {
  const doctor = await getDoctorBySlug((await params).slug);
  // Last resort only: the proxy answers an unknown slug with the branded 404 (freeze F10), so this
  // runs just for a slug unpublished within the proxy's memo window.
  if (!doctor) notFound();
  return <DentistProfile doctor={doctor} />;
}
