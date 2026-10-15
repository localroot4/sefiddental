'use client';

import { CallBlock } from '@/components/layout/CallBlock';
import { SystemPage } from '@/components/layout/SystemPage';
import { Button } from '@/components/ui/Button';
import { CLINIC_FALLBACK, SYSTEM_MESSAGES as copy } from '@/i18n/fa-system';

/**
 * Branded 500 for errors inside public pages (spec 14.2). Client component (error boundary):
 * no metadata export, so React 19 hoists the title and robots tags. No data reads: it renders
 * with the database down. The digest matches the `request_error` log line of onRequestError.
 * Next loads this boundary on every page, so it takes its copy from the small fa-system module
 * and renders no Icon (F1, F2).
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
      <title>{`${copy['error.title']} | ${CLINIC_FALLBACK.name}`}</title>
      <meta name="robots" content="noindex" />
      <SystemPage
        heading={copy['error.heading']}
        lead={copy['error.lead']}
        call={
          <CallBlock
            label={copy['call.label']}
            phoneE164={CLINIC_FALLBACK.phoneE164}
            phoneDisplay={CLINIC_FALLBACK.phoneDisplay}
            hoursLine={CLINIC_FALLBACK.hoursLine}
          />
        }
        linksHeading={copy['links.heading']}
      >
        <Button variant="secondary" onClick={() => retry()}>
          {copy['error.retry']}
        </Button>
        {error.digest ? (
          <p className="text-small text-ink-muted">
            {copy['error.code']} <span dir="ltr">{error.digest}</span>
          </p>
        ) : null}
      </SystemPage>
    </>
  );
}
