import { Fragment, type ReactNode } from 'react';

import { BookingForm } from '@/components/booking/BookingForm';
import { ButtonLink } from '@/components/ui/Button';
import { MapBlock } from '@/components/ui/Contact';
import { FaqList } from '@/components/ui/Content';
import { HoursTable } from '@/components/ui/Hours';
import { Icon } from '@/components/ui/Icon';
import { Section, SectionHeader } from '@/components/ui/Layout';
import { MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { t } from '@/i18n/fa';
import { toClinicHours } from '@/lib/data/clinicHours';
import { hoursTableNote } from '@/lib/hoursState';
import { telHref } from '@/lib/phone';
import type { Clinic, Media } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

export const mediaOf = (value: number | Media | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null;

export type Tone = 'plain' | 'sunken';

/**
 * A family C list with exactly as many cells as items (templates 1.7): one, two (744 px) and three
 * (1024 px) cards a row, and the cards of a short last row grow to fill it, so no cell stays empty.
 */
export const FILL_GRID =
  'flex flex-wrap gap-3 [&>li]:grid [&>li]:grow [&>li]:basis-full md:[&>li]:basis-[calc(50%-var(--space-3))] lg:[&>li]:basis-[calc(33.333%-var(--space-3))]';

/**
 * The sections that have content, in order, on alternating sunken and plain backgrounds, so two
 * neighbours never share a tone whatever subset of the template renders.
 */
export function Alternating(props: { sections: Array<((tone: Tone) => ReactNode) | null> }) {
  return props.sections
    .filter((render) => render !== null)
    .map((render, i) => <Fragment key={i}>{render(i % 2 === 0 ? 'sunken' : 'plain')}</Fragment>);
}

/**
 * One section of a services template: its heading (an H2 from the section's `id`), its layout
 * family on `data-family` (DESIGN.md 6; the e2e checks read it) and an optional action link.
 * `split` puts the heading beside the content from 1024 px.
 */
export function ServiceSection(props: {
  id: string;
  family: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  tone?: 'plain' | 'sunken' | 'warm';
  anchor?: string;
  split?: boolean;
  children: ReactNode;
}) {
  const header = (
    <SectionHeader
      id={`${props.id}-title`}
      title={props.title}
      lead={props.lead}
      action={props.action}
      className={props.split ? 'lg:mb-0 lg:self-start' : undefined}
    />
  );
  return (
    <div data-section={props.id} data-family={props.family}>
      <Section id={props.anchor} labelledBy={`${props.id}-title`} tone={props.tone}>
        {props.split ? (
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            {header}
            <div className="min-w-0">{props.children}</div>
          </div>
        ) : (
          <>
            {header}
            {props.children}
          </>
        )}
      </Section>
    </div>
  );
}

/**
 * FAQ (family I): native disclosures and, from 1024 px, a sticky aside with booking, call and
 * WhatsApp; under 1024 the sticky bar does that job. Hidden without questions.
 */
export function FaqBlock(props: {
  faqs: Array<{ question: string; answer: string }>;
  clinic: Clinic;
  whatsapp: string | null;
  booking: string;
  serviceKey?: string;
  tone?: Tone;
}) {
  if (props.faqs.length === 0) return null;
  return (
    <ServiceSection id="faq" family="I" title={t('services.faq.heading')} tone={props.tone}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="grid content-start gap-4">
          <FaqList
            items={props.faqs.map((faq) => ({
              // One flex item: the summary spreads its children apart.
              question: <span>{ltr(faq.question)}</span>,
              answer: ltr(faq.answer),
            }))}
          />
        </div>
        <aside
          aria-labelledby="faq-aside"
          className="hidden content-start gap-3 self-start rounded-card border border-line bg-surface-raised p-6 lg:sticky lg:top-[calc(var(--nav-h)+var(--space-4))] lg:grid"
        >
          <h3 id="faq-aside" className="text-body-lg leading-[1.4] font-semibold">
            {t('services.faq.aside')}
          </h3>
          <ButtonLink
            fullWidth
            href={props.booking}
            track={{ event: 'booking_open', location: 'aside', serviceKey: props.serviceKey }}
            data-booking-cta=""
          >
            {t('services.book')}
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            fullWidth
            href={telHref(props.clinic.phones.landline)}
            track={{ event: 'call_click', location: 'aside', serviceKey: props.serviceKey }}
            data-call-sheet=""
          >
            {t('call.label')}
          </ButtonLink>
          {props.whatsapp ? (
            <ButtonLink
              variant="ghost"
              fullWidth
              href={props.whatsapp}
              track={{ event: 'whatsapp_click', location: 'aside', serviceKey: props.serviceKey }}
            >
              {t('services.whatsapp')}
            </ButtonLink>
          ) : null}
        </aside>
      </div>
    </ServiceSection>
  );
}

/**
 * Booking block (family J): the full form on the warm stage beside the static map and the hours;
 * the map goes under the form on phones. The sticky bar steps aside while it is in view
 * (conversion.md 4), and every «رزرو نوبت» on the page scrolls here (the chrome's booking route).
 */
export function BookingBlock(props: { clinic: Clinic; service?: string }) {
  const map = mediaOf(props.clinic.maps?.staticMap);
  const hours = toClinicHours(props.clinic);
  return (
    <div data-section="booking" data-family="J" data-sticky-hide="">
      <Section labelledBy="bk-block-title" tone="warm">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <BookingForm variant="full" instance="block" service={props.service} />
          {/* Tablets put the map beside the address and hours; phones and desktop stack them. */}
          <div className="grid content-start gap-8 md:grid-cols-2 lg:grid-cols-1">
            <MapBlock
              image={
                map ? (
                  <Picture
                    media={map}
                    sizes="(min-width: 1024px) 26rem, (min-width: 744px) 50vw, 100vw"
                  />
                ) : (
                  <MediaPlaceholder caption={t('services.photo.map')} />
                )
              }
              maps={props.clinic.maps}
              location="section"
            />
            <div className="grid content-start gap-8">
              <p className="flex gap-2 text-small">
                <Icon name="map-pin" size="sm" className="mt-[.2em] text-brand" />
                <span>{props.clinic.address.fullFa}</span>
              </p>
              <HoursTable hours={hours} note={hoursTableNote(hours)} />
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
