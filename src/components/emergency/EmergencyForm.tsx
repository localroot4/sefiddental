import type { ReactNode } from 'react';

import { BOOKING_FIELDS as F } from '@/components/booking/fields';
import { ButtonLink, Spinner, submitClasses } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { SuccessCheck } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { TRIAGE } from '@/lib/booking/request';
import type { HoursStateName } from '@/lib/hoursState';
import { PAGE_PATHS } from '@/lib/paths';
import { formatPhoneFa, PHONE_ERRORS, REGISTERED_NUMBER_LABEL, telHref } from '@/lib/phone';
import type { Clinic } from '@/payload-types';

import { EmergencyFormIsland, type EmergencyInitial } from './EmergencyFormIsland';
import { SafetyBox, WARNING_BOX } from './SafetyBox';
import type { EmergencyView } from './view';

/** «هیچ‌کدام؟ …» with its booking link (7.3); also the whole section while the form is off. */
export function NoneLine() {
  return (
    <>
      {t('emergency.none.before')}{' '}
      <TextLink href={PAGE_PATHS.booking}>{t('emergency.none.link')}</TextLink>.
    </>
  );
}

/** A message ending with «با <clinic number> تماس بگیرید…» (5.2, 7.3), the number a call link. */
function withPhone(before: string, phone: string, after: string): ReactNode {
  return (
    <>
      {before}{' '}
      <TextLink
        ltr
        href={telHref(phone)}
        data-call-sheet=""
        track={{ event: 'call_click', location: 'section' }}
        className="whitespace-nowrap"
      >
        {formatPhoneFa(phone)}
      </TextLink>{' '}
      {after}
    </>
  );
}

/**
 * The triage form (docs/conversion.md 7.3, emergency spec 6): the server parent of the island,
 * which renders every static part, the tokens for the no-JS post and the flash's state. It is
 * no booking form: no `data-booking-form`, so the header's «رزرو نوبت» opens the booking dialog
 * on this page (freeze G7, Q11).
 */
export function EmergencyForm(props: {
  clinic: Clinic;
  view: EmergencyView;
  openState: HoursStateName;
  tokens: { csrf: string; ts: string } | null;
  initial: EmergencyInitial;
  cardClassName: string;
}) {
  const { clinic, view } = props;
  const landline = clinic.phones.landline;
  const whatsapp = clinic.phones.whatsappVerified ? clinic.phones.whatsapp : null;
  const nearby = clinic.emergency?.nearby24hCenter?.trim();

  const firstAid =
    view.avulsion === 'call' ? (
      <>
        <p>{t('emergency.avulsion.text')}</p>
        <p className="font-semibold">{t('emergency.avulsion.open')}</p>
        <div data-call-sheet="">
          <ButtonLink
            variant="secondary"
            size="lg"
            href={telHref(landline)}
            iconStart={<Icon name="phone" size="sm" />}
            track={{ event: 'call_click', location: 'section' }}
          >
            {t('call.label')}
          </ButtonLink>
        </div>
      </>
    ) : (
      <>
        <p>{t('emergency.avulsion.text')}</p>
        <p className="font-semibold">{t('emergency.avulsion.closed')}</p>
        {/* Gap 31: the center's name once the clinic fills it in; never a marker. */}
        {nearby ? <p>{nearby}</p> : null}
      </>
    );
  // The safety box's warning tint: the most urgent text on the page, still never red (EM-B4).
  const avulsion = (
    <div className={cx(WARNING_BOX, 'grid grid-cols-[auto_1fr] gap-x-3 p-4')}>
      <Icon name="warning" size="sm" className="mt-[.2em] text-warning" />
      <div className="grid gap-3">{firstAid}</div>
    </div>
  );

  return (
    <EmergencyFormIsland
      action={PAGE_PATHS.emergency}
      openState={props.openState}
      initial={props.initial}
      labels={{
        legend: t('emergency.triage.legend'),
        triage: TRIAGE.map((value) => [value, t(`emergency.triage.${value}`)] as const),
        phone: t('booking.phone'),
        phoneHelp: (
          <>
            {t('booking.phoneHelp')} <bdi dir="ltr">{t('booking.phoneSample')}</bdi>
          </>
        ),
        name: t('booking.name'),
        note: { summary: t('booking.noteSummary'), label: t('booking.note') },
        submit: t('emergency.submit'),
        submitting: t('booking.submitting'),
        done: t('emergency.done'),
        registered: REGISTERED_NUMBER_LABEL,
        callbackGeneric: t('emergency.done.callbackGeneric'),
        errors: {
          ...PHONE_ERRORS,
          noteTooLong: t('booking.noteTooLong'),
          nameTooLong: t('emergency.nameTooLong'),
          triage: t('emergency.triage.required'),
        },
        notices: {
          expired: t('emergency.failed.expired'),
          retry: t('emergency.failed.retry'),
          network: withPhone(t('emergency.failed.network'), landline, t('booking.fallbackAfter')),
          server: (
            <>
              {withPhone(t('emergency.failed.server'), landline, t('booking.fallbackAfter'))}
              {whatsapp ? (
                <>
                  {' '}
                  <TextLink
                    href={`https://wa.me/${whatsapp.replace(/^\+/, '')}?text=${encodeURIComponent(t('pages.whatsappText'))}`}
                    track={{ event: 'whatsapp_click', location: 'section' }}
                  >
                    {t('pages.whatsapp')}
                  </TextLink>
                </>
              ) : null}
            </>
          ),
          neutral: withPhone(t('emergency.repeat.before'), landline, t('emergency.repeat.after')),
        },
      }}
      header={
        <div className="grid gap-2">
          <h2 id="em-title" className="text-heading font-semibold">
            {t('emergency.form.heading')}
          </h2>
          {view.callFirst ? (
            <p className="text-body text-ink-muted">{t('emergency.form.intro')}</p>
          ) : null}
        </div>
      }
      avulsion={avulsion}
      none={<NoneLine />}
      hidden={
        <>
          <input type="hidden" name={F.csrf} defaultValue={props.tokens?.csrf ?? ''} />
          <input type="hidden" name={F.ts} defaultValue={props.tokens?.ts ?? ''} />
          {/* Honeypot (conversion.md 5.3): out of the tab order, autofill and the accessibility tree. */}
          <div aria-hidden="true" className="sr-only">
            <input type="text" name={F.honeypot} tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
        </>
      }
      privacy={
        <p className="text-caption text-ink-muted">
          {t('booking.privacy')}{' '}
          <TextLink href={PAGE_PATHS.privacy} className="whitespace-nowrap">
            {t('booking.privacyLink')}
          </TextLink>
        </p>
      }
      aboveSubmit={
        view.aboveSubmit ? (
          <p className="flex gap-2 text-small font-medium text-ink">
            <Icon name="clock" size="sm" className="mt-[.2em] text-brand" />
            <span>{view.aboveSubmit}</span>
          </p>
        ) : null
      }
      icons={{
        error: <Icon name="warning-circle" size="sm" className="mt-[.15em]" />,
        info: <Icon name="info" size="sm" className="mt-[.15em] text-info" />,
        check: <SuccessCheck />,
        chevron: (
          <Icon
            name="caret-down"
            size="sm"
            className="transition-transform group-open:rotate-180"
          />
        ),
        spinner: <Spinner />,
        tick: <Icon name="check" size="custom" className="size-4" />,
      }}
      // The column's width, not the label's: «در حال ثبت» never resizes it (EM-F7).
      submitClass={submitClasses()}
      success={<SafetyBox id="em-safety-again" repeat />}
      cardClassName={props.cardClassName}
    />
  );
}
