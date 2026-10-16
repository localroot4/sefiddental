import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { BookingPageView } from '@/components/booking/BookingPage';
import { bookingPageInputs } from '@/components/booking/pageInputs';
import { getPage, pageMetadata } from '@/components/pages/data';
import { pageFormTokens } from '@/lib/booking/pageTokens';
import { readEnv } from '@/lib/env';
import { FORM_SID_HEADER } from '@/lib/formTokens';
import { readFlash } from '@/lib/http/flash';

// /رزرو-نوبت: the proxy rewrites it to this ASCII folder (freeze F29) and gives it the form
// cookie's sid (step 7a) and a no-JS post's flash (7b) in request headers. Rendered per request
// and never stored (it holds tokens; conversion.md 6); ?service= and ?tier= canonicalize away.
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('booking');
}

/** This request's form tokens for the no-JS post: issued now, outside the render's purity rule. */
function issueTokens(sid: string | null, renewTs: string | undefined) {
  const env = readEnv();
  return pageFormTokens({
    sid,
    secrets: env.formTokenSecrets,
    nowMs: Date.now(),
    ttlMs: env.formTokenTtlSeconds * 1000,
    renewTs,
  });
}

export default async function BookingPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [page, requestHeaders, query] = await Promise.all([
    getPage('booking'),
    headers(),
    props.searchParams,
  ]);
  const flash = readFlash(requestHeaders);
  // After a 419 the token is renewed pre-aged, so the next press is not «too fast» (D-K5).
  const renewTs =
    flash?.form === 'booking' && flash.outcome === 'expired' ? flash.renewTs : undefined;
  const tokens = issueTokens(requestHeaders.get(FORM_SID_HEADER), renewTs);
  return (
    <BookingPageView title={page.title} tokens={tokens} inputs={bookingPageInputs(query, flash)} />
  );
}
