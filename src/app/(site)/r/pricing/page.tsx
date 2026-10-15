import type { Metadata } from 'next';

import { getPage, pageMetadata } from '@/components/pages/data';
import { Pricing } from '@/components/pages/Pricing';

// /هزینه-و-پرداخت: the proxy rewrites it to this ASCII folder (freeze F29, proxyRules
// routeRewrite). Renders per request (layout).
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('pricing');
}

export default async function PricingPage() {
  return <Pricing page={await getPage('pricing')} />;
}
