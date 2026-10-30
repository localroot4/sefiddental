import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { DentistsHub } from '@/components/pages/DentistsHub';
import { getDoctors } from '@/lib/data/content';

// /پزشکان: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a Persian
// folder in a production build; proxyRules routeRewrite). Renders per request (layout).
// Noindex while no dentist is published (the same cached read as the hub).
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata('dentists-hub', (await getDoctors()).length);
}

export default async function DentistsHubPage() {
  return <DentistsHub page={await getPage('dentists-hub')} />;
}
