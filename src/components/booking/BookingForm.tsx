import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import { DirectionsLinks } from '@/components/ui/Contact';
import { cx } from '@/components/ui/cx';
import { SuccessCheck } from '@/components/ui/Feedback';
import { ChipGroup, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { TextLink } from '@/components/ui/TextLink';
import { t, type MessageKey } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { PAGE_PATHS } from '@/lib/paths';
import { formatPhoneFa, PHONE_ERRORS, REGISTERED_NUMBER_LABEL, telHref } from '@/lib/phone';

import { BookingFormIsland } from './BookingFormIsland';
import { BOOKING_FIELDS as F, BOOKING_GROUPS, TIME_PREFS } from './fields';
import { clinicVcardHref } from './vcard';

/**
 * The one booking form (docs/conversion.md 5.1): `compact` in the home hero card, `full` in the
 * home scene 10 block and on other pages. Phase 4 ships markup and client validation; phase 5
 * wires submission. Without JavaScript it posts to /رزرو-نوبت.
 */
export type BookingFormProps = {
  variant: 'compact' | 'full';
  /** Prefix of every id and the `location` of booking_submit: `hero`, `block`, `page`, ... */
  instance: string;
  /** Slug (or key) of the service to preselect (service pages, tier steps). */
  service?: string;
  /** Restoration tier key to carry (`standard`, `vip`, `cip`). */
  tier?: string;
  /** Slug of the dentist whose profile shows the form. */
  dentist?: string;
  /** Placement classes on the card or sheet (width, alignment). */
  className?: string;
};

async function serviceOf(ref: string) {
  const [doc] = await getPublished('services', {
    where: { or: [{ slug: { equals: ref } }, { key: { equals: ref } }] },
    limit: 1,
  });
  return doc ?? null;
}

const groupLabel = (group: string, free: boolean) =>
  t((group === 'exam' && free ? 'booking.group.examFree' : `booking.group.${group}`) as MessageKey);

/** Card (compact, home hero) or sheet (full) with the form and its success state in one cell. */
export async function BookingForm(props: BookingFormProps) {
  const [features, clinic, service] = await Promise.all([
    getFeatures(),
    getClinic(),
    props.service ? serviceOf(props.service) : null,
  ]);
  const full = props.variant === 'full';
  const free = features.freeConsultation !== false;
  const p = `bk-${props.instance}`;
  const landline = clinic.phones.landline;
  const caller = clinic.reception.callerNumber;
  const whatsapp = clinic.phones.whatsappVerified ? clinic.phones.whatsapp : null;

  const chips = (
    <ChipGroup
      legend={t('booking.serviceLegend')}
      name={F.service}
      defaultValue={service?.bookingGroup ?? undefined}
      options={BOOKING_GROUPS.map((group) => ({ value: group, label: groupLabel(group, free) }))}
    />
  );

  const fields: ReactNode = full ? (
    <>
      <TextField id={`${p}-name`} name={F.name} label={t('booking.name')} autoComplete="name" />
      {service ? (
        // The page knows the service: one line, and «تغییر» opens the chips (works without JS).
        <details>
          <summary className="flex min-h-target cursor-pointer list-none flex-wrap items-center gap-x-3 text-small [&::-webkit-details-marker]:hidden">
            <span>
              <span className="font-semibold">{t('booking.serviceKnown')}</span> {service.navLabel}
            </span>
            <span className="font-medium text-brand-strong underline decoration-line-strong underline-offset-[.22em]">
              {t('booking.serviceChange')}
            </span>
          </summary>
          <div className="pt-2">{chips}</div>
        </details>
      ) : (
        chips
      )}
      <ChipGroup
        legend={t('booking.timeLegend')}
        name={F.timePref}
        options={TIME_PREFS.map((time) => ({
          value: time,
          label: t(`booking.time.${time}` as MessageKey),
        }))}
      />
    </>
  ) : null;

  const hidden = (
    <>
      <input type="hidden" name={F.serviceKey} defaultValue={service?.key ?? ''} />
      <input type="hidden" name={F.tier} defaultValue={props.tier ?? ''} />
      <input type="hidden" name={F.dentist} defaultValue={props.dentist ?? ''} />
      <input type="hidden" name={F.location} defaultValue={props.instance} />
      {/* Honeypot (conversion.md 5.3): out of the tab order, autofill and the accessibility tree. */}
      <div aria-hidden="true" className="sr-only">
        <input type="text" name={F.honeypot} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
    </>
  );

  const success: ReactNode = (
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
      {full ? (
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
          {whatsapp ? (
            <TextLink
              standalone
              href={`https://wa.me/${whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(t('booking.whatsappText'))}`}
              track={{ event: 'whatsapp_click', location: 'success' }}
              className="-ms-2"
            >
              {t('booking.whatsapp')}
            </TextLink>
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <div
      className={cx(
        'w-full border border-line bg-surface-raised p-6',
        full ? 'rounded-sheet shadow-raised' : 'max-w-[26rem] rounded-card shadow-floating',
        props.className,
      )}
    >
      <BookingFormIsland
        variant={props.variant}
        instance={props.instance}
        action={PAGE_PATHS.booking}
        labels={{
          phone: t('booking.phone'),
          phoneHelp: (
            <>
              {t('booking.phoneHelp')} <bdi dir="ltr">{t('booking.phoneSample')}</bdi>
            </>
          ),
          submit: t('booking.submit'),
          submitting: t('booking.submitting'),
          done: t('booking.done'),
          registered: REGISTERED_NUMBER_LABEL,
          errors: { ...PHONE_ERRORS, noteTooLong: t('booking.noteTooLong') },
          failed: {
            network: (
              <>
                {t('booking.failed.network')}{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {formatPhoneFa(landline)}
                </bdi>{' '}
                {t('booking.fallbackAfter')}
              </>
            ),
            server: (
              <>
                {t('booking.failed.server')}{' '}
                <bdi dir="ltr" className="whitespace-nowrap">
                  {formatPhoneFa(landline)}
                </bdi>{' '}
                {t('booking.fallbackAfter')}
              </>
            ),
          },
          ...(full
            ? {
                note: {
                  summary: t('booking.noteSummary'),
                  label: t('booking.note'),
                  help: t('booking.noteHelp'),
                },
                fallback: {
                  before: t('booking.fallbackBefore'),
                  after: t('booking.fallbackAfter'),
                  phone: formatPhoneFa(landline),
                  href: telHref(landline),
                },
              }
            : {}),
        }}
        header={
          <div className="grid gap-1">
            <h2 id={`${p}-title`} className="text-heading font-semibold">
              {t('booking.heading')}
            </h2>
            <p className="text-small text-ink-muted">{t('booking.lead')}</p>
            {full && free ? (
              <p className="text-small text-ink-muted">{t('content.freeConsultation')}</p>
            ) : null}
          </div>
        }
        fields={fields}
        hidden={hidden}
        privacy={
          <p className="text-caption text-ink-muted">
            {t('booking.privacy')}{' '}
            <TextLink href={PAGE_PATHS.privacy} className="whitespace-nowrap">
              {t('booking.privacyLink')}
            </TextLink>
          </p>
        }
        icons={{
          error: <Icon name="warning-circle" size="sm" className="mt-[.15em]" />,
          check: <SuccessCheck compact={!full} />,
          chevron: (
            <Icon
              name="caret-down"
              size="sm"
              className="transition-transform group-open:rotate-180"
            />
          ),
        }}
        success={success}
      />
    </div>
  );
}
