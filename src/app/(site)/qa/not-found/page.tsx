import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { NotFoundView } from '@/components/layout/NotFoundView';
import { t } from '@/i18n/fa';
import { readEnv } from '@/lib/env';

// Lighthouse target (decision 3): the 404 template with status 200. QA_ROUTES=1 only, read at
// request time; otherwise a real 404. Never prerendered.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: t('notFound.title'),
  robots: { index: false, follow: false },
};

export default function QaNotFound() {
  if (!readEnv().qaRoutes) notFound();
  return <NotFoundView />;
}
