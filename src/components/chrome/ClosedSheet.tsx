import { ButtonLink, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';

import { SHEET_ID } from './ids';

const CLOSE = { command: 'close', commandfor: SHEET_ID } as const;

/**
 * The closed-hours sheet (nav spec 1.5): a modal <dialog> from the bottom under 1024 px and a
 * centered 28rem dialog from 1024 px (Q13). Its sentence is hours-dependent, so the server HTML
 * leaves it empty and ChromeScripts writes `hours.copy.closedSheet` from /api/form-session before
 * it opens. «رزرو نوبت» routes like every booking CTA; «تماس با کلینیک» dials (for people who
 * still want to try).
 */
export function ClosedSheet(props: { phone: string }) {
  return (
    <dialog
      id={SHEET_ID}
      aria-labelledby={`${SHEET_ID}-text`}
      className="mx-0 mt-auto mb-0 w-full max-w-none translate-y-full rounded-t-sheet border border-b-0 border-line bg-surface-raised p-6 pt-3 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] text-ink shadow-floating transition-[translate,display,overlay] transition-discrete duration-(--dur-3) backdrop:bg-backdrop open:translate-y-0 starting:open:translate-y-full lg:m-auto lg:max-w-[28rem] lg:translate-y-0 lg:rounded-sheet lg:border-b lg:pb-6"
    >
      <div className="flex justify-end">
        <IconButton label={t('nav.sheetClose')} icon={<Icon name="close" />} {...CLOSE} />
      </div>
      <p id={`${SHEET_ID}-text`} data-sheet-text="" className="text-body-lg text-ink" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <ButtonLink
          href={PAGE_PATHS.booking}
          size="lg"
          fullWidth
          data-booking-cta=""
          track={{ event: 'booking_open', location: 'closed_sheet' }}
        >
          {t('nav.book')}
        </ButtonLink>
        <ButtonLink
          href={telHref(props.phone)}
          variant="secondary"
          size="lg"
          fullWidth
          track={{ event: 'call_click', location: 'closed_sheet' }}
        >
          {t('call.label')}
        </ButtonLink>
      </div>
    </dialog>
  );
}
