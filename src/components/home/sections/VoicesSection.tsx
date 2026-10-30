import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { t } from '@/i18n/fa';
import type { Service, Testimonial } from '@/payload-types';

import { HomeSection, media, type Copy } from './HomeSection';

type HomeTestimonial = Omit<Testimonial, 'service'> & { service: Service | null };

const ROW_ID = 'home-voices-row';

/**
 * Scene 8 (family H): poster cards with the patient's label and consent line. The video plays
 * only with Persian captions (WCAG 1.2.2) and testimonials have no captions file yet, so the
 * card shows the poster and the written summary until that field exists: no `<video>`, nothing
 * preloaded. The list is the `voices` world slot (phase 8 draws the soft 3D carousel there).
 * Under 1024 px it is a native scroll-snap row at every tier (phone spec D24: the same boxes at
 * tiers 0 to 3), and the «قبلی» and «بعدی» box is there at every tier, invisible and inert until
 * `voices.ts` shows and wires the buttons at tiers 1 to 3 (the spec's fallback for the home
 * initial JS: no island). From 1024 px tier 0 is the grid; at tiers 1 to 3 `voices.ts` sets
 * `data-carousel` on the list, which makes it the row, and the buttons show while it overflows.
 * Each press scrolls the row by one card. One voice gets no buttons at any tier (`data-single`).
 * Like CardRail, the row is a focusable region at every width, so a keyboard scrolls it.
 * `data-lenis-prevent-horizontal`: Lenis takes every wheel gesture whose vertical delta is not
 * exactly 0, and a trackpad swipe never is, so without it the row cannot be swiped on a desktop.
 */
export function VoicesSection(props: { testimonials: HomeTestimonial[]; copy: Copy }) {
  const items = props.testimonials.filter((v) => media(v.poster) || v.quote);
  if (items.length === 0) return null;
  return (
    <HomeSection scene="voices" section="voices" family="H" copy={props.copy}>
      <ul
        id={ROW_ID}
        data-world-slot="voices"
        data-lenis-prevent-horizontal=""
        aria-labelledby={props.copy ? 'home-voices-title' : undefined}
        tabIndex={0}
        className="peer/voices grid max-lg:-mx-gutter max-lg:auto-cols-[min(84%,24rem)] max-lg:grid-flow-col max-lg:snap-x max-lg:snap-mandatory max-lg:scroll-px-gutter max-lg:gap-4 max-lg:overflow-x-auto max-lg:px-gutter pt-1 pb-3 lg:grid-cols-3 lg:gap-8 lg:data-carousel:auto-cols-[min(84%,24rem)] lg:data-carousel:grid-flow-col lg:data-carousel:grid-cols-none lg:data-carousel:snap-x lg:data-carousel:snap-mandatory lg:data-carousel:gap-4 lg:data-carousel:overflow-x-auto"
      >
        {items.map((voice) => {
          const poster = media(voice.poster);
          return (
            <li key={voice.id} className="grid snap-start content-start gap-3">
              <TestimonialCard
                label={voice.patientLabel}
                consent={t('home.voices.consent')}
                media={
                  poster ? (
                    <Picture
                      media={poster}
                      crop="portrait"
                      sizes="(min-width: 1024px) 26rem, (min-width: 744px) 50vw, 100vw"
                    />
                  ) : null
                }
              />
              {voice.transcriptSummary || voice.quote ? (
                <p className="text-small text-ink-muted">
                  {voice.transcriptSummary || voice.quote}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div
        data-voices-nav=""
        data-single={items.length === 1 ? '' : undefined}
        inert
        className="invisible mt-6 flex gap-3 data-single:hidden lg:hidden lg:peer-data-carousel/voices:flex"
      >
        <Button
          variant="secondary"
          aria-controls={ROW_ID}
          data-dir="-1"
          iconStart={<Icon name="caret-back" size="sm" />}
        >
          {t('home.voices.prev')}
        </Button>
        <Button
          variant="secondary"
          aria-controls={ROW_ID}
          data-dir="1"
          iconEnd={<Icon name="caret-forward" size="sm" />}
        >
          {t('home.voices.next')}
        </Button>
      </div>
    </HomeSection>
  );
}
