import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { t } from '@/i18n/fa';
import type { Service, Testimonial } from '@/payload-types';

import { HomeSection, media, type Copy } from './HomeSection';

type HomeTestimonial = Omit<Testimonial, 'service'> & { service: Service | null };

/**
 * Scene 8 (family H): poster cards with the patient's label and consent line. The video plays
 * only with Persian captions (WCAG 1.2.2) and testimonials have no captions file yet, so the
 * card shows the poster and the written summary until that field exists.
 */
export function VoicesSection(props: { testimonials: HomeTestimonial[]; copy: Copy }) {
  const items = props.testimonials.filter((v) => media(v.poster) || v.quote);
  if (items.length === 0) return null;
  return (
    <HomeSection scene="voices" section="voices" family="H" copy={props.copy}>
      <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {items.map((voice) => {
          const poster = media(voice.poster);
          return (
            <li key={voice.id} className="grid content-start gap-3">
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
    </HomeSection>
  );
}
