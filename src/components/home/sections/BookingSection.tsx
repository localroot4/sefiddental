import { BookingForm } from '@/components/booking/BookingForm';
import { MapBlock } from '@/components/ui/Contact';
import { HoursTable } from '@/components/ui/Hours';
import { Icon } from '@/components/ui/Icon';
import { Section } from '@/components/ui/Layout';
import { MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { t } from '@/i18n/fa';
import { hoursTableNote, type ClinicHours } from '@/lib/hoursState';
import type { Clinic } from '@/payload-types';

import { media } from './HomeSection';

/**
 * Scene 10 (family J): the full form on the warm stage with the static map and the hours; the
 * map sits under the form on phones. «رزرو نوبت» links scroll here (the chrome's booking route).
 * `[data-booking-card]` is the box the scene module (scenes/dom/booking.ts) raises once on
 * enter at tiers 1 to 3; the server HTML is the resting state.
 */
export function BookingSection(props: { clinic: Clinic; hours: ClinicHours }) {
  const map = media(props.clinic.maps?.staticMap);
  return (
    // data-sticky-hide: the sticky bar steps aside while this block is in view (conversion.md 4).
    <div data-scene="booking" data-home-section="booking" data-family="J" data-sticky-hide="">
      <Section labelledBy="bk-block-title" tone="warm">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <div data-booking-card="" className="min-w-0">
            {/* No contextual emergency link on home, by the client's wish (conversion.md 3, G10). */}
            <BookingForm variant="full" instance="block" emergencyLink={false} />
          </div>
          <div className="grid content-start gap-8">
            <MapBlock
              image={
                map ? (
                  <Picture media={map} sizes="(min-width: 1024px) 26rem, 100vw" />
                ) : (
                  <MediaPlaceholder caption={t('home.booking.map')} />
                )
              }
              maps={props.clinic.maps}
              location="section"
            />
            <p className="flex gap-2 text-small">
              <Icon name="map-pin" size="sm" className="mt-[.2em] text-brand" />
              <span>{props.clinic.address.fullFa}</span>
            </p>
            <HoursTable hours={props.hours} note={hoursTableNote(props.hours)} />
          </div>
        </div>
      </Section>
    </div>
  );
}
