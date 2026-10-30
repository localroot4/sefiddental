import { ButtonLink } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Chip } from '@/components/ui/Field';
import { TextLink } from '@/components/ui/TextLink';
import { t } from '@/i18n/fa';
import { PAGE_PATHS } from '@/lib/paths';
import type { ServiceTier } from '@/payload-types';

import { ltr } from '@/components/ui/ltr';

import { MolarStepper } from '../MolarStepper';
import { HomeSection, type Copy } from './HomeSection';

// The step control shows the panel of the checked tier (every panel in the server HTML) by its
// position, `data-choice` (ChromeScripts' choices.ts); without JavaScript a `:has()` rule that
// exists only then (`noscript:`). Static classes per position: Tailwind cannot build a class from
// a tier key.
const PANEL = [
  'group-data-[choice=1]/tiers:grid noscript:group-has-[label:nth-of-type(1)>input:checked]/tiers:grid lg:[[data-pins]_&]:group-data-[choice=1]/tiers:visible',
  'group-data-[choice=2]/tiers:grid noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:grid lg:[[data-pins]_&]:group-data-[choice=2]/tiers:visible',
  'group-data-[choice=3]/tiers:grid noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:grid lg:[[data-pins]_&]:group-data-[choice=3]/tiers:visible',
  'group-data-[choice=4]/tiers:grid noscript:group-has-[label:nth-of-type(4)>input:checked]/tiers:grid lg:[[data-pins]_&]:group-data-[choice=4]/tiers:visible',
];
// Pinned (html[data-pins] from 1024 px): every panel sits in one grid cell and the unchosen ones
// are only invisible, so the sticky stage keeps one height whatever the scroll checks. A height
// change there moved the reader by Chrome's scroll anchoring (70 px on a reload at VIP, F2).
const STACKED = 'lg:[[data-pins]_&]:grid lg:[[data-pins]_&]:[grid-area:2/1]';

/**
 * Scene 4 (family D): the molar stepper (D16) beside three steps, a line each, one «رزرو نوبت»
 * that carries the chosen tier to the scene 10 block (C15), and the full comparison on the
 * restoration page. No tier is preselected (F24): until a step is chosen, the button carries
 * the service only and the molar shows the plain level. HomeBookingPrefill sends `tier_select`
 * (name `home-tier`) on a user choice; the pinned scrub of `scenes/dom/restoration.ts` checks
 * the step from the scroll without one. The molar and the panels share the `group/tiers`, so
 * both follow the same `data-choice`.
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
    <HomeSection
      scene="restoration"
      section="restoration"
      family="D"
      copy={props.copy}
      split
      pin={1}
    >
      <div data-choices="" className="group/tiers grid gap-6">
        {/* The molar beside the steps, except in the split's content column from 1024 to 1279 px,
            where the three chips would wrap beside it: there it stacks above them, smaller
            (MolarStepper), so the pinned stage fits a 768 px high viewport. */}
        <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8 lg:grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)]">
          <MolarStepper className="justify-self-center md:justify-self-start" />
          <div className="grid content-start gap-6">
            <fieldset className="min-w-0" aria-describedby="home-tiers-note">
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
              {/* What the levels differ in, before a chip is chosen (the brief's tier facts). One
                  caption line at 1024 px, so the pinned stage still fits a 768 px viewport. */}
              <p id="home-tiers-note" className="mt-2 text-caption text-ink-muted">
                {ltr(t('home.restoration.levels'))}
              </p>
            </fieldset>
            <div
              data-tier-panel=""
              className={`grid content-start justify-items-start group-data-choice/tiers:hidden noscript:group-has-[input:checked]/tiers:hidden ${STACKED} lg:[[data-pins]_&]:group-data-choice/tiers:grid lg:[[data-pins]_&]:group-data-choice/tiers:invisible`}
            >
              {book(null)}
            </div>
            {tiers.map((tier, i) => (
              <div
                key={tier.key}
                data-tier-panel={tier.key}
                className={cx(
                  'hidden content-start justify-items-start gap-4 rounded-card border border-line bg-surface-raised p-6',
                  STACKED,
                  'lg:[[data-pins]_&]:invisible',
                  PANEL[i],
                )}
              >
                <h3 className="text-heading font-semibold">{ltr(tier.name)}</h3>
                <p className="max-w-measure text-body text-ink-muted">{ltr(tier.description)}</p>
                {book(tier)}
              </div>
            ))}
          </div>
        </div>
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
