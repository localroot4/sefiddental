import type { Metadata } from 'next';

import { Address } from '@/components/pages/Address';
import { getPage, pageMetadata } from '@/components/pages/data';

// /آدرس: the proxy rewrites it to this ASCII folder (Next 16.4 matches no route under a Persian
// folder in a production build; proxyRules routeRewrite). Renders per request (layout). Today's
// hours state is not in this HTML: the page fetches it after `load` (CC-6).
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('address');
}

export default async function AddressPage() {
  return <Address page={await getPage('address')} />;
}
