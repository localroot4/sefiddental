import type { Metadata } from 'next';

import { BookingDialog } from '@/components/booking/BookingDialog';
import { getPage, pageMetadata } from '@/components/pages/data';
import { Privacy } from '@/components/pages/Privacy';

// /حریم-خصوصی: the proxy rewrites it to this ASCII folder (freeze F29, proxyRules
// routeRewrite). Renders per request (layout), so the GA4 paragraph follows the setting.
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('privacy');
}

export default async function PrivacyPage() {
  // No inline form on this page: «رزرو نوبت» opens the booking dialog (freeze G7).
  return (
    <>
      <Privacy page={await getPage('privacy')} />
      <BookingDialog />
    </>
  );
}
