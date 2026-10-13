'use client';

import { SystemPage } from '@/components/layout/SystemPage';
import { CLINIC_FALLBACK, t } from '@/i18n/fa';

/**
 * Branded 500 for errors inside public pages (spec 14.2). Client component (error boundary):
 * no metadata export, so React 19 hoists the title and robots tags. No data reads: it renders
 * with the database down. The digest matches the `request_error` log line of onRequestError.
 */
export default function SiteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <>
      <title>{`${t('error.title')} | ${CLINIC_FALLBACK.name}`}</title>
      <meta name="robots" content="noindex" />
      <SystemPage heading={t('error.heading')} lead={t('error.lead')} showLinks>
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-target items-center rounded-pill border border-brand px-6 font-bold text-brand-strong transition-colors duration-200 hover:bg-brand-soft motion-reduce:transition-none"
        >
          {t('error.retry')}
        </button>
        {error.digest ? (
          <p className="text-small text-ink-muted">
            {t('error.code')} <span dir="ltr">{error.digest}</span>
          </p>
        ) : null}
      </SystemPage>
    </>
  );
}
