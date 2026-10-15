import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { GuideHub } from '@/components/pages/GuideHub';

// /راهنمای-بیمار: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a
// Persian folder in a production build; proxyRules routeRewrite). Renders per request (layout).
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('guide-hub');
}

export default async function GuideHubPage() {
  return <GuideHub page={await getPage('guide-hub')} />;
}
