import { HomeSection, type Copy } from '@/components/home/sections/HomeSection';
import { Badge } from '@/components/ui/Badge';
import { CardRail, DentistCard } from '@/components/ui/Cards';
import { MediaFrame, MediaPlaceholder } from '@/components/ui/Media';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { DEMO_COPY, DEMO_DOCTORS, DEMO_VOICES } from '@/lib/demoContent';
import { PAGE_PATHS } from '@/lib/paths';

/*
 * Demo variants of home scenes 6 to 8 for the client preview (DEMO_CONTENT; getHomeData picks
 * them while nothing of the kind is published). The section and family of CasesSection,
 * DentistsSection and VoicesSection, with the house photo placeholder in each image slot and
 * without what a demo item must not carry: a scene id (the experience root sends `scene_view` for
 * each one), the section intro (it may speak of consent or of the dentists), a consent or result
 * line, the compare slider (its first move sends `case_slider_use`) and links to pages that do not
 * list the item.
 */

/** The heading of the page's section row, without its intro. */
const headingOnly = (copy: Copy): Copy => (copy ? { heading: copy.heading, intro: null } : null);

/** Scene 6 (family E): the demo pair side by side, labelled «طرح نمایشی». */
export function DemoCasesSection(props: { copy: Copy }) {
  const pair = [
    ['before', DEMO_COPY.beforePhoto],
    ['after', DEMO_COPY.afterPhoto],
  ] as const;
  return (
    <HomeSection section="compare" family="E" copy={headingOnly(props.copy)}>
      <div className="grid gap-8 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:items-center lg:gap-16">
        <div className="grid grid-cols-2 gap-3">
          {pair.map(([side, caption]) => (
            <MediaFrame key={side} ratio="1:1">
              <MediaPlaceholder caption={caption} />
              <span className="absolute start-3 top-3 rounded-badge bg-surface-raised px-2 py-1 text-caption leading-[1.4] font-semibold">
                {t(`ui.compare.${side}`)}
              </span>
            </MediaFrame>
          ))}
        </div>
        <div className="grid content-start justify-items-start gap-3">
          <Badge>{DEMO_COPY.label}</Badge>
          <p className="max-w-measure text-body text-ink-muted">{DEMO_COPY.caseText}</p>
        </div>
      </div>
    </HomeSection>
  );
}

/** Scene 7 (family F): the demo dentists, labelled in the specialty line; no council line. */
export function DemoDentistsSection(props: { copy: Copy }) {
  return (
    <HomeSection
      section="dentists"
      family="F"
      copy={headingOnly(props.copy)}
      action={
        <TextLink standalone href={PAGE_PATHS['dentists-hub']} className="-ms-2">
          {t('home.dentists.all')}
        </TextLink>
      }
    >
      <CardRail label={t('home.dentists.rail')}>
        {DEMO_DOCTORS.map((doctor) => (
          <DentistCard
            key={doctor.id}
            name={`${t('home.dentists.title')} ${doctor.name}`}
            specialty={doctor.specialty}
            media={<MediaPlaceholder caption={t('pages.photo.dentist')} variant="card" />}
          />
        ))}
      </CardRail>
    </HomeSection>
  );
}

/** Scene 8 (family H): the demo voices; the card's second line is the demo label. */
export function DemoVoicesSection(props: { copy: Copy }) {
  return (
    <HomeSection section="voices" family="H" copy={headingOnly(props.copy)}>
      <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {DEMO_VOICES.map((quote) => (
          <li key={quote} className="grid content-start gap-3">
            <TestimonialCard
              label={DEMO_COPY.patient}
              consent={DEMO_COPY.label}
              media={<MediaPlaceholder caption={DEMO_COPY.posterPhoto} />}
            />
            <p className="text-small text-ink-muted">{quote}</p>
          </li>
        ))}
      </ul>
    </HomeSection>
  );
}
