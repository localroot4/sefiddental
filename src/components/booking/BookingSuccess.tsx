import { ButtonLink } from '@/components/ui/Button';
import { DirectionsLinks } from '@/components/ui/Contact';
import { Icon } from '@/components/ui/Icon';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { getClinic } from '@/lib/data/globals';
import { formatPhoneFa, telHref } from '@/lib/phone';

import { clinicVcardHref } from './vcard';

/** wa.me link with the success prefill (conversion.md 8), or null until the number is verified (F12). */
export function successWhatsappHref(phones: {
  whatsapp?: string | null;
  whatsappVerified?: boolean | null;
}) {
  return phones.whatsappVerified && phones.whatsapp
    ? `https://wa.me/${phones.whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(t('booking.whatsappText'))}`
    : null;
}

/**
 * Success items after the callback line (conversion.md 5.4): 4, the caller line with the vCard;
 * `full` adds 5, what to bring, and 6, the address with «مسیریابی», then the call fallback
 * «تماس با کلینیک» (freeze G9; through the closed-hours sheet) and WhatsApp once verified (F12).
 * Shared by the form's in-place success and the success page /رزرو-نوبت/ثبت-شد.
 */
export async function BookingSuccessExtras(props: { full: boolean }) {
  const clinic = await getClinic();
  const caller = clinic.reception.callerNumber;
  const landline = clinic.phones.landline;
  const whatsapp = successWhatsappHref(clinic.phones);
  return (
    <>
      {caller ? (
        <p className="text-small text-ink-muted">
          {t('booking.callerBefore')} <bdi dir="ltr">{formatPhoneFa(caller)}</bdi>{' '}
          {t('booking.callerAfter')}
        </p>
      ) : null}
      <ButtonLink
        variant="secondary"
        href={clinicVcardHref({
          name: clinic.nameFa,
          phones: [caller ?? '', landline, clinic.phones.mobile ?? ''],
          street: clinic.address.fullFa,
          city: clinic.address.city,
          site: `https://${clinic.domain}`,
        })}
        download="sefid-dental.vcf"
        track={{ event: 'save_contact', location: 'success' }}
        className="mt-1"
      >
        {t('booking.saveContact')}
      </ButtonLink>
      {props.full ? (
        <>
          <div className="mt-4 grid gap-2">
            <h3 className="text-body leading-[1.5] font-semibold">{t('booking.bringHeading')}</h3>
            <ul className="grid list-disc gap-1 ps-6 text-small text-ink-muted">
              {(['id', 'insurance', 'xray', 'meds'] as const).map((item) => (
                <li key={item}>{t(`booking.bring.${item}`)}</li>
              ))}
            </ul>
          </div>
          <p className="mt-2 flex gap-2 text-small">
            <Icon name="map-pin" size="sm" className="mt-[.2em] text-brand" />
            <span>{clinic.address.fullFa}</span>
          </p>
          <DirectionsLinks maps={clinic.maps} location="success" />
          <div className="-ms-2 flex flex-wrap gap-x-4">
            <TextLink
              standalone
              href={telHref(landline)}
              data-call-sheet=""
              track={{ event: 'call_click', location: 'success' }}
            >
              {t('call.label')}
            </TextLink>
            {whatsapp ? (
              <TextLink
                standalone
                href={whatsapp}
                track={{ event: 'whatsapp_click', location: 'success' }}
              >
                {t('booking.whatsapp')}
              </TextLink>
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
