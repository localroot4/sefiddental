import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { Emergency } from '@/components/emergency/Emergency';
import { getPage, pageMetadata } from '@/components/pages/data';
import { pageFormTokens } from '@/lib/booking/pageTokens';
import { readEnv } from '@/lib/env';
import { FORM_SID_HEADER } from '@/lib/formTokens';
import { hoursClock } from '@/lib/hoursState';
import { readFlash } from '@/lib/http/flash';

// /اورژانس: the proxy rewrites it to this ASCII folder (freeze F29) and a POST of it to
// /api/emergency (G2). Renders per request and no-store (layout): the hours state picks the order,
// the HTML holds the form tokens for the no-JS post, and the one-time flash shows its outcome.
export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('emergency');
}

/** This request's hours clock (QA-CLOCK in e2e), form tokens and flash. */
async function requestInputs() {
  const list = await headers();
  const env = readEnv();
  const nowMs = Date.now();
  const flash = readFlash(list);
  return {
    clock: hoursClock(list, env.qaRoutes, nowMs),
    // After a 419 the token is renewed pre-aged, so the next press is not «too fast» (D-K5).
    tokens: pageFormTokens({
      sid: list.get(FORM_SID_HEADER),
      secrets: env.formTokenSecrets,
      nowMs,
      ttlMs: env.formTokenTtlSeconds * 1000,
      renewTs: flash?.form === 'emergency' ? flash.renewTs : undefined,
    }),
    flash,
  };
}

export default async function EmergencyPage() {
  const [page, inputs] = await Promise.all([getPage('emergency'), requestInputs()]);
  return <Emergency page={page} {...inputs} />;
}
