import { SystemPage } from '@/components/layout/SystemPage';
import { t } from '@/i18n/fa';

/** Body of the branded 404 (spec 14.1); also rendered with status 200 by /qa/not-found. */
export function NotFoundView() {
  return (
    <SystemPage heading={t('notFound.heading')} lead={t('notFound.lead')} showLinks showUrgent />
  );
}
