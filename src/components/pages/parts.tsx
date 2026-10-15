import { Fragment, type ReactNode } from 'react';

import { BookingForm } from '@/components/booking/BookingForm';
import { MapBlock } from '@/components/ui/Contact';
import { cx } from '@/components/ui/cx';
import { HoursTable } from '@/components/ui/Hours';
import { Icon } from '@/components/ui/Icon';
import { Section, SectionHeader } from '@/components/ui/Layout';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { t } from '@/i18n/fa';
import { toClinicHours } from '@/lib/data/clinicHours';
import { hoursNote } from '@/lib/hoursState';
import type { Clinic, Media } from '@/payload-types';

import { mediaOf } from './view';

export type Tone = 'plain' | 'sunken';

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
 * One section of a pages template: an H2 from its `id` (or none when the content brings its own
 * H2s, as a rich-text story), its layout family on `data-family` for the e2e checks, an action.
 */
export function Band(props: {
  id: string;
  family: string;
  title?: ReactNode;
  action?: ReactNode;
  tone?: Tone;
  children: ReactNode;
}) {
  const titleId = props.title ? `${props.id}-title` : undefined;
  return (
    <div data-section={props.id} data-family={props.family}>
      <Section labelledBy={titleId} tone={props.tone}>
        {props.title ? (
          <SectionHeader id={`${props.id}-title`} title={props.title} action={props.action} />
        ) : null}
        {props.children}
      </Section>
    </div>
  );
}

/** The inner-hero media (family A): the page photo, else the labeled block of gap 45. */
export function HeroMedia(props: { media: number | Media | null | undefined; caption: string }) {
  const media = mediaOf(props.media);
  return (
    <MediaFrame ratio="hero">
      {media ? (
        <Picture
          media={media}
          priority
          sizes="(min-width: 1024px) 30rem, (min-width: 744px) 40vw, 100vw"
        />
      ) : (
        <MediaPlaceholder caption={props.caption} />
      )}
    </MediaFrame>
  );
}

/** Missing client text (gap 13): a neutral block naming what goes here, like a photo placeholder. */
export function TextPlaceholder(props: { caption: string; className?: string }) {
  return (
    <p
      className={cx(
        'max-w-measure rounded-card border border-dashed border-line-strong bg-surface-sunken p-4 text-caption text-ink-muted',
        props.className,
      )}
    >
      <span className="font-semibold">{t('pages.textPlaceholder')}</span> {props.caption}
    </p>
  );
}

/** The static map image, else its labeled block (gap 47, freeze F3). */
export function MapImage(props: { clinic: Clinic; sizes: string }) {
  const map = mediaOf(props.clinic.maps?.staticMap);
  return map ? (
    <Picture media={map} sizes={props.sizes} />
  ) : (
    <MediaPlaceholder caption={t('pages.photo.map')} />
  );
}

/**
 * Booking block (family J): the full form on the warm stage beside the static map, the address
 * and the hours; on phones they go under the form. `map={false}` is J-form (address page, which
 * shows its map at the top): the same grid without the map. On a dentist profile `dentist` (the
 * slug) rides along in the form. The sticky bar steps aside while it is in view (conversion.md
 * 4), and the page's «رزرو نوبت» links scroll here (the chrome's booking route).
 */
export function PageBooking(props: { clinic: Clinic; map?: boolean; dentist?: string }) {
  const withMap = props.map !== false;
  const hours = toClinicHours(props.clinic);
  return (
    <div data-section="booking" data-family={withMap ? 'J' : 'J-form'} data-sticky-hide="">
      <Section labelledBy="bk-block-title" tone="warm">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <BookingForm variant="full" instance="block" dentist={props.dentist} />
          <div className="grid content-start gap-8">
            {withMap ? (
              <MapBlock
                image={<MapImage clinic={props.clinic} sizes="(min-width: 1024px) 26rem, 100vw" />}
                maps={props.clinic.maps}
                location="block"
              />
            ) : null}
            <p className="flex gap-2 text-small">
              <Icon name="map-pin" size="sm" className="mt-[.2em] text-brand" />
              <span>{props.clinic.address.fullFa}</span>
            </p>
            <HoursTable hours={hours} note={hoursNote(hours)} />
          </div>
        </div>
      </Section>
    </div>
  );
}
