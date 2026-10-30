import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { GuideHub } from '@/components/pages/GuideHub';
import { getGuides } from '@/lib/data/content';

// /راهنمای-بیمار: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a
// Persian folder in a production build; proxyRules routeRewrite). Renders per request (layout).
// Noindex while no guide is published (the same cached read as the hub).
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('guide-hub', (await getGuides()).length);
}

export default async function GuideHubPage() {
  return <GuideHub page={await getPage('guide-hub')} />;
}
