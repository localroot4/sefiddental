import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { BookingSuccessView } from '@/components/booking/BookingSuccessPage';
import { pageMetadata } from '@/components/pages/data';
import { t } from '@/i18n/fa';
import { readFlash } from '@/lib/http/flash';
import { PAGE_PATHS } from '@/lib/paths';

// /رزرو-نوبت/ثبت-شد (noindex: the seed row and robots.ts): shows only with the one-time flash of a
// real submission, which the proxy opens and deletes; opened directly or reloaded, it redirects
// to the booking page (conversion.md 5.4). Rendered per request, never stored.
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('booking-success');
}

export default async function BookingSuccessPage() {
  const flash = readFlash(await headers());
  if (flash?.form !== 'booking' || flash.outcome !== 'success') {
    // A Location header is ASCII: the Persian path goes percent-encoded.
    redirect(encodeURI(PAGE_PATHS.booking));
  }
  return (
    <BookingSuccessView
      callback={flash.callback ?? t('booking.callbackGeneric')}
      masked={flash.masked ?? null}
    />
  );
}
