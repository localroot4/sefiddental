import type { ReactNode } from 'react';

import { alertBoxClass } from '@/components/ui/Alert';
import { Spinner, submitClasses } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { SuccessCheck } from '@/components/ui/Feedback';
import { ChipGroup, CONTROL, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { TextLink } from '@/components/ui/TextLink';
import { EMERGENCY_PATH, t, type MessageKey } from '@/i18n/fa';
import { NAME_MAX } from '@/lib/booking/request';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { PAGE_PATHS } from '@/lib/paths';
import { formatPhoneFa, PHONE_ERRORS, REGISTERED_NUMBER_LABEL, telHref } from '@/lib/phone';

import type { BookingFormIsland } from './BookingFormIsland';
import { BookingSuccessExtras, successWhatsappHref } from './BookingSuccess';
import { BOOKING_FIELDS as F, BOOKING_GROUPS, TIME_PREFS } from './fields';
import type { BookingRestore } from './restore';

/**
 * The one booking form (docs/conversion.md 5.1): `compact` in the home hero card, `full` in the
 * home scene 10 block, the page blocks, the booking page and the booking dialog. Without
 * JavaScript it posts to /رزرو-نوبت; the proxy hands the post to /api/booking (freeze G2).
 */
/** The form instances (conversion.md 5): one per page, two on home; also the events' location. */
export type BookingInstance = 'hero' | 'block' | 'dialog' | 'page';

export type BookingFormProps = {
  variant: 'compact' | 'full';
  /** Prefix of every id (`bk-<instance>-…`) and the `location` of the booking events. */
  instance: BookingInstance;
  /** Slug (or key) of the service to preselect (service pages, tier steps). */
  service?: string;
  /** Restoration tier key to carry (`standard`, `vip`, `cip`). */
  tier?: string;
  /** Slug of the dentist whose profile shows the form. */
  dentist?: string;
  /** The stored `formLocation` when it differs from the instance (a no-JS home post, 5.6). */
  location?: string;
  /** Placement classes on the card or sheet (width, alignment). */
  className?: string;
  /** No card frame of its own: the dialog is the sheet. */
  plain?: boolean;
  /** The full form's «درد شدید دارید؟» link (freeze G10); off on home (conversion.md 3). */
  emergencyLink?: boolean;
  /** Booking page only: the tokens of the no-JS post and what a no-JS post left (the flash). */
  tokens?: { csrf: string; ts: string } | null;
  restore?: BookingRestore | null;
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

/**
 * Card (compact, home hero) or sheet (full) with the form and its success state in one cell. The
 * island is the caller's: BookingForm passes the eager one, the booking dialog a deferred one.
 */
export async function BookingFormBody({
  Island,
  ...props
}: BookingFormProps & { Island: typeof BookingFormIsland }) {
  const [features, clinic, service] = await Promise.all([
    getFeatures(),
    getClinic(),
    props.service ? serviceOf(props.service) : null,
  ]);
  const full = props.variant === 'full';
  const free = features.freeConsultation !== false;
  const p = `bk-${props.instance}`;
  const landline = clinic.phones.landline;
  const whatsapp = successWhatsappHref(clinic.phones);
  const kept = props.restore?.values ?? {};

  const chips = (
    <ChipGroup
      legend={t('booking.serviceLegend')}
      name={F.service}
      defaultValue={kept[F.service] ?? service?.bookingGroup ?? undefined}
      options={BOOKING_GROUPS.map((group) => ({ value: group, label: groupLabel(group, free) }))}
    />
  );

  const fields: ReactNode = full ? (
    <>
      <TextField
        id={`${p}-name`}
        name={F.name}
        label={t('booking.name')}
        autoComplete="name"
        maxLength={NAME_MAX}
        defaultValue={kept[F.name]}
        error={props.restore?.nameError ? t('booking.nameTooLong') : undefined}
      />
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
        defaultValue={kept[F.timePref]}
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
      <input type="hidden" name={F.location} defaultValue={props.location ?? props.instance} />
      {/* Honeypot (conversion.md 5.3): out of the tab order, autofill and the accessibility tree. */}
      <div aria-hidden="true" className="sr-only">
        <input type="text" name={F.honeypot} tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
    </>
  );

  // A message, then the clinic number as an LTR call link and «تماس بگیرید.» (conversion.md 5.2):
  // the call is the way out of a failure, so it is one tap, through the closed-hours sheet.
  const withNumber = (key: MessageKey) => (
    <>
      {t(key)}{' '}
      <TextLink
        ltr
        href={telHref(landline)}
        data-call-sheet=""
        track={{ event: 'call_click', location: props.instance }}
        className="whitespace-nowrap"
      >
        {formatPhoneFa(landline)}
      </TextLink>{' '}
      {t('booking.fallbackAfter')}
    </>
  );

  return (
    <div
      className={cx(
        'w-full',
        !props.plain && 'border border-line bg-surface-raised p-6',
        !props.plain &&
          (full ? 'rounded-sheet shadow-raised' : 'max-w-[26rem] rounded-card shadow-floating'),
        props.className,
      )}
    >
      <Island
        variant={props.variant}
        instance={props.instance}
        action={PAGE_PATHS.booking}
        tokens={props.tokens}
        initial={props.restore?.initial}
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
          callbackGeneric: t('booking.callbackGeneric'),
          errors: { ...PHONE_ERRORS, noteTooLong: t('booking.noteTooLong') },
          notices: {
            network: withNumber('booking.failed.network'),
            server: (
              <>
                {withNumber('booking.failed.server')}
                {whatsapp ? (
                  <>
                    {' '}
                    <TextLink
                      href={whatsapp}
                      track={{ event: 'whatsapp_click', location: props.instance }}
                    >
                      {t('booking.whatsapp')}
                    </TextLink>
                  </>
                ) : null}
              </>
            ),
            expired: t('booking.failed.expired'),
            name: t('booking.nameTooLong'),
            neutral: withNumber('booking.neutral'),
            retry: t('booking.retry'),
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
            {/* The booking page's H1 already says «رزرو نوبت» right above the card: the form keeps
                its name for assistive tech, but no second visible title (jury note 4). */}
            <h2
              id={`${p}-title`}
              className={cx('text-heading font-semibold', props.instance === 'page' && 'sr-only')}
            >
              {t('booking.heading')}
            </h2>
            <p className="text-small text-ink-muted">{t('booking.lead')}</p>
            {full && free ? (
              <p className="text-small text-ink-muted">{t('content.freeConsultation')}</p>
            ) : null}
            {full && props.emergencyLink !== false ? (
              <TextLink standalone href={EMERGENCY_PATH} className="-ms-2 w-fit text-small">
                {t('urgent.label')}
              </TextLink>
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
          info: <Icon name="info" className="mt-[.1em] text-info" />,
          check: <SuccessCheck compact={!full} />,
          chevron: (
            <Icon
              name="caret-down"
              size="sm"
              className="transition-transform group-open:rotate-180"
            />
          ),
          spinner: <Spinner />,
        }}
        submitClass={submitClasses()}
        controlClass={CONTROL}
        infoClass={alertBoxClass('info')}
        success={<BookingSuccessExtras full={full} />}
      />
    </div>
  );
}
