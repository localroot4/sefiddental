import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { Privacy } from '@/components/pages/Privacy';

// /حریم-خصوصی: the proxy rewrites it to this ASCII folder (freeze F29, proxyRules
// routeRewrite). Renders per request (layout), so the GA4 paragraph follows the setting.
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('privacy');
}

export default async function PrivacyPage() {
  return <Privacy page={await getPage('privacy')} />;
}
