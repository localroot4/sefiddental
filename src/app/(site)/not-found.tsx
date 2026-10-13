import type { Metadata } from 'next';

import { NotFoundView } from '@/components/layout/NotFoundView';
import { t } from '@/i18n/fa';

// Rendered inside the (site) layout for every notFound(); Next sends 404 and adds noindex.
export const metadata: Metadata = { title: t('notFound.title') };

export default function NotFound() {
  return <NotFoundView />;
}
