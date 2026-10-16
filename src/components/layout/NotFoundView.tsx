import { BookingDialog } from '@/components/booking/BookingDialog';
import { CallBlock } from '@/components/layout/CallBlock';
import { SystemPage } from '@/components/layout/SystemPage';
import { ButtonLink } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EMERGENCY_PATH, t } from '@/i18n/fa';
import { getFooterData } from '@/lib/data/footer';
import { PAGE_PATHS } from '@/lib/paths';
import { formatPhoneFa } from '@/lib/phone';

/**
 * Body of the branded 404 (spec 14.1); also rendered with status 200 by /qa/not-found. CTA map
 * of conversion.md 3: «رزرو نوبت» primary, «تماس با کلینیک» secondary with the live clinic
 * number and hours (the reader falls back with the database down), the service links and
 * «درد شدید دارید؟».
 */
export async function NotFoundView() {
  const contact = await getFooterData();
  // The page has no inline form: «رزرو نوبت» opens the booking dialog (freeze G7).
  return (
    <>
      <SystemPage
        heading={t('notFound.heading')}
        lead={t('notFound.lead')}
        call={
          <CallBlock
            label={t('call.label')}
            icon={<Icon name="phone" size="sm" />}
            phoneE164={contact.phones.landline}
            phoneDisplay={formatPhoneFa(contact.phones.landline)}
            hoursLine={contact.hours ?? contact.hoursNote}
          >
            <ButtonLink
              href={PAGE_PATHS.booking}
              iconStart={<Icon name="calendar" size="sm" />}
              data-booking-cta=""
              track={{ event: 'booking_open', location: 'section' }}
            >
              {t('nav.book')}
            </ButtonLink>
          </CallBlock>
        }
        linksHeading={t('links.heading')}
        linkIcon={<Icon name="caret-forward" className="text-ink-faint" />}
        urgent={
          <a
            href={EMERGENCY_PATH}
            className="mt-6 inline-flex min-h-target items-center gap-2 font-semibold text-warning hover:underline"
          >
            <Icon name="warning" size="sm" />
            {t('urgent.label')}
          </a>
        }
      />
      <BookingDialog />
    </>
  );
}
