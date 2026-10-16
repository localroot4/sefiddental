import { BOOKING_DIALOG_ID } from '@/components/chrome/ids';
import { IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { log } from '@/lib/log/logger';

import { BookingForm } from './BookingForm';

const CLOSE = { command: 'close', commandfor: BOOKING_DIALOG_ID } as const;

/**
 * The booking dialog (conversion.md 5, freeze G7) for a page without an inline booking form:
 * the 404 and system pages, privacy, the success page, the emergency page, articles. Never on
 * home or on a page with a booking block (one form instance per page). The chrome's booking route
 * opens it from any «رزرو نوبت» link (`data-booking-cta`) with the link's service and tier, locks
 * the page scroll and moves focus (field, or heading on touch); Esc and «بستن» close it and focus
 * returns to the link (src/components/chrome/bookingRoute.ts, dialogs.ts). The closed-hours sheet
 * pattern: a bottom sheet under 1024 px, centered from 1024 px, never taller than the screen,
 * scrolling inside. The form's success state shows in place. Without JavaScript it never opens:
 * the links navigate to /رزرو-نوبت. With the database down it renders nothing, so the branded 404
 * still answers (CC-7) and its links navigate.
 */
export async function BookingDialog(props: {
  /** Slug or key of the service the page is about: the form shows «خدمت: …» (conversion.md 5.1). */
  service?: string;
  /** Off on the emergency page, which is where the link goes. */
  emergencyLink?: boolean;
}) {
  try {
    // The form's own reads: cached, so the form below reads them again for free.
    await Promise.all([getClinic(), getFeatures()]);
  } catch (err) {
    log.warn({ msg: 'booking_dialog_unavailable', err });
    return null;
  }
  return (
    <dialog
      id={BOOKING_DIALOG_ID}
      aria-labelledby="bk-dialog-title"
      data-booking-dialog=""
      className="mx-0 mt-auto mb-0 max-h-[100dvh] w-full max-w-none translate-y-full overflow-y-auto overscroll-contain rounded-t-sheet border border-b-0 border-line bg-surface-raised px-6 pt-0 pb-[calc(var(--space-6)+env(safe-area-inset-bottom))] text-ink shadow-floating transition-[translate,opacity,display,overlay] transition-discrete duration-(--dur-3) backdrop:bg-backdrop open:translate-y-0 starting:open:translate-y-full lg:m-auto lg:max-h-[calc(100dvh-var(--space-12))] lg:max-w-[36rem] lg:translate-y-0 lg:rounded-sheet lg:border-b lg:pb-6 lg:opacity-0 lg:open:opacity-100 lg:starting:open:opacity-0"
    >
      {/* Sticky, so «بستن» stays in reach while the form scrolls inside a phone-high sheet. */}
      <div className="sticky top-0 z-10 -mx-6 flex justify-end bg-surface-raised px-3 pt-3">
        <IconButton label={t('booking.close')} icon={<Icon name="close" />} {...CLOSE} />
      </div>
      <BookingForm
        variant="full"
        instance="dialog"
        plain
        service={props.service}
        emergencyLink={props.emergencyLink}
      />
    </dialog>
  );
}
