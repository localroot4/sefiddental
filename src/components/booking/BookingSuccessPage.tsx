import { SuccessCheck } from '@/components/ui/Feedback';
import { t } from '@/i18n/fa';
import { REGISTERED_NUMBER_LABEL } from '@/lib/phone';

import { BookingDialog } from './BookingDialog';
import { BookingSuccessExtras } from './BookingSuccess';

/**
 * T-booking-success (conversion.md 5.4; noindex): what the no-JS post leads to, the same items as
 * the form's in-place success: the drawn check (static under reduced motion), «درخواست شما ثبت
 * شد» (focused on load), the callback line the handler computed at submit time (else the generic
 * line), the masked number, then items 4-6 and the call fallback. The page has no form of its own,
 * so its «رزرو نوبت» links open the booking dialog.
 */
export function BookingSuccessView(props: { callback: string; masked: string | null }) {
  return (
    <div data-page-type="booking_success" className="bg-warm-soft">
      <div className="mx-auto w-full max-w-content px-gutter pt-8 pb-section md:pt-12">
        <div className="mx-auto grid max-w-[36rem] justify-items-start gap-2 rounded-sheet border border-line bg-surface-raised p-6 shadow-raised md:p-8">
          <SuccessCheck />
          {/* autofocus without JavaScript too: the success heading takes focus (5.4). */}
          <h1
            tabIndex={-1}
            autoFocus
            className="font-display text-display-2 font-bold focus:outline-none"
          >
            {t('booking.done')}
          </h1>
          <div className="text-body text-ink-muted">
            <p>{props.callback}</p>
            {props.masked ? (
              <p>
                {REGISTERED_NUMBER_LABEL} <bdi dir="ltr">{props.masked}</bdi>
              </p>
            ) : null}
          </div>
          <BookingSuccessExtras full />
        </div>
      </div>
      <BookingDialog />
    </div>
  );
}
