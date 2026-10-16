import type { ReactNode } from 'react';

import { BookingForm } from '@/components/booking/BookingForm';
import { ButtonLink } from '@/components/ui/Button';
import { CardRail, CategoryTile, DentistCard, TileGrid } from '@/components/ui/Cards';
import { CompareSlider } from '@/components/ui/CompareSlider';
import { MapBlock } from '@/components/ui/Contact';
import { FaqList, Steps } from '@/components/ui/Content';
import { cx } from '@/components/ui/cx';
import { Chip } from '@/components/ui/Field';
import { HoursTable } from '@/components/ui/Hours';
import { Icon } from '@/components/ui/Icon';
import { Section, SectionHeader } from '@/components/ui/Layout';
import { MediaPlaceholder } from '@/components/ui/Media';
import { Picture } from '@/components/ui/Picture';
import { TestimonialCard } from '@/components/ui/Testimonial';
import { TextLink } from '@/components/ui/TextLink';
import { EMERGENCY_PATH, t } from '@/i18n/fa';
import type { CatalogCategory } from '@/lib/data/catalog';
import { hoursTableNote, type ClinicHours } from '@/lib/hoursState';
import { buildPath, PAGE_PATHS } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';
import { telHref } from '@/lib/phone';
import type {
  Case,
  Clinic,
  Doctor,
  Media,
  Service,
  ServiceTier,
  Testimonial,
} from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

type Copy = { heading: string; intro: string | null } | null;

const media = (value: number | Media | null | undefined): Media | null =>
  typeof value === 'object' && value !== null ? value : null;

/**
 * One home section: its scene id for the experience engine (phases 7-8 animate this markup), its
 * place in the T-home order and its layout family (DESIGN.md 6), which the e2e checks read.
 */
function HomeSection(props: {
  scene?: string;
  section: string;
  family: string;
  copy: Copy;
  action?: ReactNode;
  tone?: 'plain' | 'sunken' | 'warm';
  /** From 1024 px the heading sits beside the content (start side), not above it. */
  split?: boolean;
  children: ReactNode;
}) {
  const id = `home-${props.section}-title`;
  const header = props.copy ? (
    <SectionHeader
      id={id}
      title={props.copy.heading}
      lead={props.copy.intro ? ltr(props.copy.intro) : undefined}
      action={props.action}
      className={props.split ? 'lg:mb-0 lg:self-start' : undefined}
    />
  ) : null;
  return (
    <div data-scene={props.scene} data-home-section={props.section} data-family={props.family}>
      <Section labelledBy={props.copy ? id : undefined} tone={props.tone}>
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

/** Scene 3 (family C): one tile per category, the first (cosmetic) large; standalone ones link to their service. */
export function ServicesSection(props: { tree: CatalogCategory[]; copy: Copy }) {
  const categories = props.tree.filter((c) => c.path);
  if (categories.length === 0) return null;
  return (
    <HomeSection
      scene="services"
      section="services"
      family="C"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS['services-hub']} className="-ms-2">
          {t('home.services.all')}
        </TextLink>
      }
    >
      <TileGrid>
        {categories.map((category, i) => (
          <CategoryTile
            key={category.key}
            href={category.path as string}
            title={category.title}
            accent={category.accent}
            icon={category.icon}
            list={
              category.standalone
                ? (category.summary ?? category.services[0]?.summary ?? undefined)
                : category.services.map((s) => s.navLabel).join('، ')
            }
            count={
              category.standalone
                ? undefined
                : `${formatNumberFa(category.services.length)} ${t('home.services.unit')}`
            }
            featured={i === 0}
            media={i === 0 ? <MediaPlaceholder caption={t('home.services.photo')} /> : undefined}
          />
        ))}
      </TileGrid>
    </HomeSection>
  );
}

// The step control shows the panel of the checked tier with CSS alone (no JS, every panel in the
// server HTML). Static classes per position: Tailwind cannot build a class from a tier key.
const PANEL = [
  'group-has-[label:nth-of-type(1)>input:checked]/tiers:grid',
  'group-has-[label:nth-of-type(2)>input:checked]/tiers:grid',
  'group-has-[label:nth-of-type(3)>input:checked]/tiers:grid',
  'group-has-[label:nth-of-type(4)>input:checked]/tiers:grid',
];

/**
 * Scene 4 (family D, the static stepper of phase 4): three steps, a line each, one «رزرو نوبت»
 * that carries the chosen tier to the scene 10 block (C15), and the full comparison on the
 * restoration page. No tier is preselected (F24): until a step is chosen, the button carries
 * the service only. HomeBookingPrefill sends `tier_select` (name `home-tier`).
 */
export function RestorationSection(props: {
  tiers: ServiceTier[];
  path: string | null;
  copy: Copy;
}) {
  const tiers = props.tiers.slice(0, PANEL.length);
  if (tiers.length === 0) return null;
  const service = typeof tiers[0]?.service === 'object' ? tiers[0].service : null;
  const book = (tier: ServiceTier | null) => (
    <ButtonLink
      size="lg"
      href={`${PAGE_PATHS.booking}?service=${service?.key ?? 'restoration'}${tier ? `&tier=${tier.key}` : ''}`}
      track={{ event: 'booking_open', location: 'tier', serviceKey: service?.key }}
      data-booking-cta=""
      data-booking-group={service?.bookingGroup ?? undefined}
    >
      {t('home.book')}
    </ButtonLink>
  );
  return (
    <HomeSection scene="restoration" section="restoration" family="D" copy={props.copy} split>
      <div className="group/tiers grid gap-6">
        <fieldset className="min-w-0">
          <legend className="sr-only">{t('home.restoration.legend')}</legend>
          <div className="flex flex-wrap gap-2">
            {tiers.map((tier) => (
              <Chip
                key={tier.key}
                name="home-tier"
                value={tier.key}
                label={ltr(tier.name)}
                className="min-w-24 justify-center"
              />
            ))}
          </div>
        </fieldset>
        <div
          data-tier-panel=""
          className="grid justify-items-start group-has-[input:checked]/tiers:hidden"
        >
          {book(null)}
        </div>
        {tiers.map((tier, i) => (
          <div
            key={tier.key}
            data-tier-panel={tier.key}
            className={cx(
              'hidden content-start justify-items-start gap-4 rounded-card border border-line bg-surface-raised p-6',
              PANEL[i],
            )}
          >
            <h3 className="text-heading font-semibold">{ltr(tier.name)}</h3>
            <p className="max-w-measure text-body text-ink-muted">{ltr(tier.description)}</p>
            {book(tier)}
          </div>
        ))}
        {props.path ? (
          <TextLink
            standalone
            href={`${props.path}#سطح-ترمیم`}
            className="-ms-2 justify-self-start"
          >
            {t('home.restoration.compare')}
          </TextLink>
        ) : null}
      </div>
    </HomeSection>
  );
}

type HomeCase = Omit<Case, 'service' | 'doctor'> & { service: Service | null };

/** Scene 6 (family E): one compare slider and up to two thumbnails into the gallery. */
export function CasesSection(props: { cases: HomeCase[]; copy: Copy }) {
  const [featured, ...rest] = props.cases.flatMap((c) => {
    const before = media(c.before);
    const after = media(c.after);
    return before && after ? [{ ...c, before, after }] : [];
  });
  if (!featured) return null;
  return (
    <HomeSection
      scene="compare"
      section="compare"
      family="E"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS.cases} className="-ms-2">
          {t('home.cases.all')}
        </TextLink>
      }
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:items-center lg:gap-16">
        <figure className="grid gap-3" data-service-key={featured.service?.key}>
          <CompareSlider
            before={
              <Picture
                media={featured.before}
                crop="square"
                sizes="(min-width: 744px) 28rem, 100vw"
              />
            }
            after={
              <Picture
                media={featured.after}
                crop="square"
                sizes="(min-width: 744px) 28rem, 100vw"
              />
            }
            handle={
              <span className="flex">
                <Icon name="caret-back" size="sm" />
                <Icon name="caret-forward" size="sm" />
              </span>
            }
            labels={{
              before: t('ui.compare.before'),
              after: t('ui.compare.after'),
              slider: t('ui.compare.label'),
              percent: t('ui.compare.percent'),
            }}
          />
          <figcaption className="text-small text-ink-muted">{t('ui.compare.consent')}</figcaption>
        </figure>
        <div className="grid content-start justify-items-start gap-3">
          <h3 className="text-heading font-semibold">{featured.title}</h3>
          {featured.notes ? (
            <p className="max-w-measure text-body text-ink-muted">{featured.notes}</p>
          ) : null}
          {featured.service && buildPath('services', featured.service) ? (
            <TextLink
              standalone
              href={buildPath('services', featured.service) as string}
              className="-ms-2"
            >
              {featured.service.navLabel}
            </TextLink>
          ) : null}
          {rest.length > 0 ? (
            <ul className="mt-4 grid w-full max-w-[28rem] grid-cols-2 gap-3">
              {rest.map((c) => (
                <li key={c.id}>
                  <a
                    href={PAGE_PATHS.cases}
                    className="grid gap-2 rounded-card text-small font-medium text-brand-strong"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-media bg-surface-sunken">
                      <Picture
                        media={c.after}
                        crop="square"
                        sizes="(min-width: 744px) 14rem, 50vw"
                      />
                    </span>
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </HomeSection>
  );
}

type HomeDoctor = Omit<Doctor, 'services'> & { services: Service[] };

/** Scene 7 (family F): hidden until a dentist is published (storyboard scene 7). */
export function DentistsSection(props: { doctors: HomeDoctor[]; copy: Copy }) {
  if (props.doctors.length === 0) return null;
  return (
    <HomeSection
      scene="dentists"
      section="dentists"
      family="F"
      copy={props.copy}
      action={
        <TextLink standalone href={PAGE_PATHS['dentists-hub']} className="-ms-2">
          {t('home.dentists.all')}
        </TextLink>
      }
    >
      <CardRail label={t('home.dentists.rail')}>
        {props.doctors.map((doctor) => {
          const photo = media(doctor.photo);
          return (
            <DentistCard
              key={doctor.id}
              name={`${t('home.dentists.title')} ${doctor.name}`}
              specialty={doctor.specialty}
              councilLabel={t('ui.dentist.council')}
              councilNumber={doctor.councilNumber}
              href={buildPath('doctors', doctor) ?? undefined}
              media={
                photo ? (
                  <Picture media={photo} crop="portrait" sizes="(min-width: 1024px) 26rem, 84vw" />
                ) : null
              }
            />
          );
        })}
      </CardRail>
    </HomeSection>
  );
}

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

/** Scene 9, first half (family G-static): the first-visit steps and the guide when it is published. */
export function JourneySection(props: {
  steps: Array<{ title: string; text: string }>;
  guidePath: string | null;
  copy: Copy;
}) {
  if (props.steps.length === 0) return null;
  return (
    <HomeSection section="journey" family="G" copy={props.copy} split>
      <Steps items={props.steps} />
      {props.guidePath ? (
        <TextLink standalone href={props.guidePath} className="mt-6 -ms-2">
          {t('home.journey.guide')}
        </TextLink>
      ) : null}
    </HomeSection>
  );
}

/**
 * Scene 9, second half (family I): the FAQ with a sticky aside from 1024 px (call, WhatsApp,
 * booking); under 1024 the sticky bar does that job. The emergency answer links the emergency
 * page (conversion.md 3: home reaches it through the FAQ).
 */
export function FaqSection(props: {
  faqs: Array<{ question: string; answer: string }>;
  copy: Copy;
  phone: string;
  whatsapp: string | null;
}) {
  if (props.faqs.length === 0) return null;
  const urgent = props.faqs.findIndex((f) => f.question.includes('درد شدید'));
  const items = props.faqs.map((faq, i) => ({
    question: faq.question,
    answer:
      i === urgent ? (
        <>
          {faq.answer}{' '}
          <TextLink href={EMERGENCY_PATH} className="whitespace-nowrap">
            {t('urgent.label')}
          </TextLink>
        </>
      ) : (
        faq.answer
      ),
  }));
  return (
    <HomeSection section="faq" family="I" copy={props.copy} tone="sunken">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
        <div className="grid gap-4">
          <FaqList items={items} />
          {urgent < 0 ? (
            <TextLink href={EMERGENCY_PATH} standalone className="-ms-2 justify-self-start">
              {t('urgent.label')}
            </TextLink>
          ) : null}
        </div>
        <aside
          aria-labelledby="home-faq-aside"
          className="hidden content-start gap-3 self-start rounded-card border border-line bg-surface-raised p-6 lg:sticky lg:top-[calc(var(--nav-h)+var(--space-4))] lg:grid"
        >
          <h3 id="home-faq-aside" className="text-body-lg leading-[1.4] font-semibold">
            {t('home.faq.aside')}
          </h3>
          <ButtonLink
            fullWidth
            href={PAGE_PATHS.booking}
            track={{ event: 'booking_open', location: 'aside' }}
            data-booking-cta=""
          >
            {t('home.book')}
          </ButtonLink>
          <ButtonLink
            variant="secondary"
            fullWidth
            href={telHref(props.phone)}
            track={{ event: 'call_click', location: 'aside' }}
            data-call-sheet=""
          >
            {t('call.label')}
          </ButtonLink>
          {props.whatsapp ? (
            <ButtonLink
              variant="ghost"
              fullWidth
              href={props.whatsapp}
              track={{ event: 'whatsapp_click', location: 'aside' }}
            >
              {t('booking.whatsapp')}
            </ButtonLink>
          ) : null}
        </aside>
      </div>
    </HomeSection>
  );
}

/**
 * Scene 10 (family J): the full form on the warm stage with the static map and the hours; the
 * map sits under the form on phones. «رزرو نوبت» links scroll here (the chrome's booking route).
 */
export function BookingSection(props: { clinic: Clinic; hours: ClinicHours }) {
  const map = media(props.clinic.maps?.staticMap);
  return (
    // data-sticky-hide: the sticky bar steps aside while this block is in view (conversion.md 4).
    <div data-scene="booking" data-home-section="booking" data-family="J" data-sticky-hide="">
      <Section labelledBy="bk-block-title" tone="warm">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          {/* No contextual emergency link on home, by the client's wish (conversion.md 3, G10). */}
          <BookingForm variant="full" instance="block" emergencyLink={false} />
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
