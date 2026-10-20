import { JsonLd } from '@/components/seo/JsonLd';
import { DirectionsLinks } from '@/components/ui/Contact';
import { HoursTable } from '@/components/ui/Hours';
import { Breadcrumbs } from '@/components/ui/Navigation';
import { t } from '@/i18n/fa';
import { toClinicHours } from '@/lib/data/clinicHours';
import { getClinic } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { hoursTableNote } from '@/lib/hoursState';
import { PAGE_PATHS } from '@/lib/paths';
import { breadcrumbNode, jsonLdGraph } from '@/lib/seo/jsonld';

import { BookingForm } from './BookingForm';
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
  const trail = crumbs(props.title);
  return (
    <div data-page-type="booking" className="bg-warm-soft">
      <div className="mx-auto grid w-full max-w-content gap-6 px-gutter pt-4 pb-section md:pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-x-12 lg:gap-y-8">
        <div className="grid gap-4 lg:col-span-2">
          <Breadcrumbs items={trail} />
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
      {/* H15: the booking page's trail in JSON-LD, as every other inner page. */}
      <JsonLd
        data={jsonLdGraph(breadcrumbNode(trail.map((c) => ({ name: c.label, path: c.href }))))}
      />
    </div>
  );
}
