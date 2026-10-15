import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';

import { whatsappHref } from './social';

// Icon over label, pill, caption 600 (DESIGN.md 3.8); the bar's 8 px padding leaves 48 px cells.
const CELL =
  'flex min-w-0 flex-col items-center justify-center gap-[2px] rounded-pill text-caption leading-[1.2] font-semibold transition-[background-color,scale] active:scale-[.98]';
const HEIGHT = 'h-[calc(var(--sticky-bar-h)+env(safe-area-inset-bottom))]';

/**
 * The phone and tablet sticky bar (conversion.md 4, nav spec 1.7): «تماس» | «واتساپ» |
 * «رزرو نوبت», WhatsApp only once verified (F12). The spacer before it keeps the end of the page
 * clear of the bar, hidden or not, and matches the footer surface. Hidden from 1024 px, while a
 * dialog is open (CSS), and as ChromeScripts decides (`data-hidden`, inert).
 */
export function StickyBar(props: { phone: string; whatsapp: string | null }) {
  return (
    <>
      <div aria-hidden="true" className={cx(HEIGHT, 'bg-surface-sunken lg:hidden')} />
      <nav
        aria-label={t('nav.quick')}
        data-sticky-bar=""
        data-call-sheet=""
        className={cx(
          HEIGHT,
          'fixed inset-x-0 bottom-0 z-40 grid gap-2 border-t border-line bg-surface-raised px-2 pt-2 pb-[calc(var(--space-2)+env(safe-area-inset-bottom))] shadow-floating transition-transform duration-(--dur-3) data-hidden:translate-y-[120%] lg:hidden [body:has(dialog[open])_&]:translate-y-[120%]',
          props.whatsapp ? 'grid-cols-3' : 'grid-cols-2',
        )}
      >
        <a
          href={telHref(props.phone)}
          data-track="call_click"
          data-location="sticky"
          className={cx(CELL, 'text-ink hover:bg-brand-soft')}
        >
          <Icon name="phone" size="sm" />
          {t('nav.quickCall')}
        </a>
        {props.whatsapp ? (
          <a
            href={whatsappHref(props.whatsapp)}
            data-track="whatsapp_click"
            data-location="sticky"
            className={cx(CELL, 'text-ink hover:bg-brand-soft')}
          >
            <Icon name="whatsapp" size="sm" />
            {t('nav.quickWhatsapp')}
          </a>
        ) : null}
        <a
          href={PAGE_PATHS.booking}
          data-booking-cta=""
          data-track="booking_open"
          data-location="sticky"
          className={cx(CELL, 'bg-brand text-on-brand hover:bg-brand-strong')}
        >
          <Icon name="calendar" size="sm" />
          {t('nav.book')}
        </a>
      </nav>
    </>
  );
}
