import './globals.css';

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { NotFoundView } from '@/components/layout/NotFoundView';
import { SiteShell } from '@/components/layout/SiteShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { t } from '@/i18n/fa';
import { dentistNode, jsonLdGraph, websiteNode } from '@/lib/seo/jsonld';
import { SITE_ICONS } from '@/lib/seo/metadata';
import { getSiteInputs, SEO } from '@/lib/seo/siteInputs';
import { Analytics } from '@/components/analytics/Analytics';
import { TrackListener } from '@/lib/track/TrackListener';

// 404 for every URL no route matches (experimental.globalNotFound): a full document rendered per
// request (headers() for the CSP nonce), status 404, with the same shell and Dentist and WebSite
// JSON-LD as the (site) layout.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8F7' },
    { media: '(prefers-color-scheme: dark)', color: '#071A2B' },
  ],
};

// Static metadata: a generateMetadata that reads the globals runs during `next build` and opens
// the build's database. The suffix comes from the clinic.yaml fallback.
export const metadata: Metadata = {
  title: `${t('notFound.title')}${SEO.titleSuffix}`,
  description: t('notFound.lead'),
  robots: { index: false, follow: false },
  icons: SITE_ICONS,
};

export default async function GlobalNotFound() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { seo, clinic } = await getSiteInputs();
  return (
    <SiteShell
      nonce={nonce}
      extras={
        <>
          <JsonLd data={jsonLdGraph(dentistNode(clinic), websiteNode({ name: seo.siteName }))} />
          <TrackListener />
          <Analytics />
        </>
      }
    >
      <NotFoundView />
    </SiteShell>
  );
}
