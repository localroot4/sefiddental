import { DirectionsLinks } from '@/components/ui/Contact';
import { SuccessCheck } from '@/components/ui/Feedback';
import { HoursTable } from '@/components/ui/Hours';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { t } from '@/i18n/fa';
import { toClinicHours } from '@/lib/data/clinicHours';
import { getClinic } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { hoursTableNote } from '@/lib/hoursState';
import { PAGE_PATHS } from '@/lib/paths';
import { REGISTERED_NUMBER_LABEL } from '@/lib/phone';

import { BookingDialog } from './BookingDialog';
import { BookingForm } from './BookingForm';
import { BookingSuccessExtras } from './BookingSuccess';
import type { BookingPageInputs } from './pageInputs';

const crumbs = (title: string) => [
  { label: t('pages.crumb.home'), href: '/' },
  { label: title, href: PAGE_PATHS.booking },
];

/**
 * T-booking (docs/ia.md): the one full form on the warm stage with a trust aside (address with
 * «مسیریابی», hours, the insurers by name under «همکاری با بیمه‌ها», F31). Phones put the form
 * first, right under the H1, and the aside after it. No sticky bar here (SiteShell), and the
 * chrome's «رزرو نوبت» focuses this form (`data-booking-form="page"`). The HTML carries the form
 * tokens for the no-JS post and, after one, the kept values and the message (the flash).
 */
export async function BookingPageView(props: {
  title: string;
  tokens: { csrf: string; ts: string } | null;
  inputs: BookingPageInputs;
}) {
  const [clinic, insurers] = await Promise.all([
    getClinic(),
    getPublished('insurances', { where: { featured: { equals: true } }, sort: 'order' }),
  ]);
  const hours = toClinicHours(clinic);
  const { inputs } = props;
  return (
    <div data-page-type="booking" className="bg-warm-soft">
      <div className="mx-auto grid w-full max-w-content gap-6 px-gutter pt-4 pb-section md:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-x-12 lg:gap-y-8">
        <div className="grid gap-4 lg:col-span-2">
          <Breadcrumbs items={crumbs(props.title)} />
          <h1 className="font-display text-display-2 font-bold">{props.title}</h1>
        </div>
        <BookingForm
          variant="full"
          instance="page"
          service={inputs.service}
          tier={inputs.tier}
          dentist={inputs.dentist}
          location={inputs.location}
          tokens={props.tokens}
          restore={inputs.restore}
        />
        {/* Not an <aside>: a complementary landmark inside main fails axe's top-level rule. */}
        <div className="grid content-start gap-8 lg:pt-6">
          <section className="grid gap-2">
            <h3 className="text-small font-semibold">{t('pages.address.address')}</h3>
            <p className="text-body">{clinic.address.fullFa}</p>
            <DirectionsLinks maps={clinic.maps} location="page" className="-ms-3" />
          </section>
          <section className="grid gap-2">
            <h3 className="text-small font-semibold">{t('pages.address.hours')}</h3>
            <HoursTable hours={hours} note={hoursTableNote(hours)} />
          </section>
          {insurers.length ? (
            <section className="grid gap-2">
              <h3 className="text-small font-semibold">{t('home.trust.insurance')}</h3>
              <ul className="flex flex-wrap gap-2">
                {insurers.map((insurer) => (
                  <li
                    key={insurer.id}
                    className="rounded-pill border border-line bg-surface-raised px-3 py-1 text-small"
                  >
                    {insurer.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

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
        <div className="grid max-w-[36rem] justify-items-start gap-2 rounded-sheet border border-line bg-surface-raised p-6 shadow-raised md:p-8">
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
