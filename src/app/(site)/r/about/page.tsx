import type { Metadata } from 'next';

import { About } from '@/components/pages/About';
import { getPage, pageMetadata } from '@/components/pages/data';

// /درباره-ما: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a
// Persian folder in a production build; proxyRules routeRewrite). Renders per request (layout).
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('about');
}

export default async function AboutPage() {
  return <About page={await getPage('about')} />;
}
