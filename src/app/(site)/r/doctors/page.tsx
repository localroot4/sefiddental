import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { DentistsHub } from '@/components/pages/DentistsHub';

// /پزشکان: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a Persian
// folder in a production build; proxyRules routeRewrite). Renders per request (layout).
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('dentists-hub');
}

export default async function DentistsHubPage() {
  return <DentistsHub page={await getPage('dentists-hub')} />;
}
