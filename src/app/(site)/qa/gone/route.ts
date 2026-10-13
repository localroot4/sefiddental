import { notFound } from 'next/navigation';

import { readEnv } from '@/lib/env';
import { renderStaticSystemPage } from '@/lib/system-pages/staticPage';

// The 410 document the proxy serves for `redirects` rows with status 410 (critic G11), here
// with status 410 for screenshots and axe. QA_ROUTES=1 only, read at request time. The proxy's
// page CSP applies and allows the document's style by hash.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  if (!readEnv().qaRoutes) notFound();
  return new Response(renderStaticSystemPage('gone'), {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
