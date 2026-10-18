import '../globals.css';

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { SiteShell } from '@/components/layout/SiteShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { dentistNode, jsonLdGraph, websiteNode } from '@/lib/seo/jsonld';
import { buildSiteMetadata } from '@/lib/seo/metadata';
import { getSiteInputs } from '@/lib/seo/siteInputs';
import { Analytics } from '@/components/analytics/Analytics';
import { TrackListener } from '@/lib/track/TrackListener';

// Every public page renders per request (freeze decision 1). Explicit, so `next build` never
// starts a page render that reads Payload: such a render opens the database and, in
// production mode, runs the pending migrations against whatever DATABASE_URL the build sees.
export const dynamic = 'force-dynamic';

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

export async function generateMetadata(): Promise<Metadata> {
  return buildSiteMetadata((await getSiteInputs()).seo);
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  const { seo, clinic } = await getSiteInputs();
  return (
    <SiteShell
      nonce={nonce}
      extras={
        <>
          <JsonLd data={jsonLdGraph(dentistNode(clinic), websiteNode({ name: seo.siteName }))} />
          <TrackListener />
          <Analytics nonce={nonce} />
        </>
      }
    >
      {children}
    </SiteShell>
  );
}
