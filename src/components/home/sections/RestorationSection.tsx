import { ButtonLink } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
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
// The segmented control's indicator under the chosen level, by its position (RTL: the start is
// the right, so later levels move it left).
const SLIDE =
  'group-data-[choice=2]/tiers:-translate-x-full group-data-[choice=3]/tiers:-translate-x-[200%] group-data-[choice=4]/tiers:-translate-x-[300%] ltr:group-data-[choice=2]/tiers:translate-x-full ltr:group-data-[choice=3]/tiers:translate-x-[200%] ltr:group-data-[choice=4]/tiers:translate-x-[300%]';
// The track's columns and the indicator's width per number of levels (static classes).
const SEGMENTS: Record<number, { cols: string; width: string }> = {
  1: { cols: 'grid-cols-1', width: 'w-[calc(100%-6px)]' },
  2: { cols: 'grid-cols-2', width: 'w-[calc((100%-6px)/2)]' },
  3: { cols: 'grid-cols-3', width: 'w-[calc((100%-6px)/3)]' },
  4: { cols: 'grid-cols-4', width: 'w-[calc((100%-6px)/4)]' },
};
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
      pin={2}
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
              {/* A segmented control: the same radio group, one track; the chosen level raises
                  its own surface (its text's background, for every contrast check) and a brand
                  bar slides under it, below the text (none until one is chosen, F24). */}
              <div
                className={`relative grid max-w-[26rem] rounded-pill bg-surface-sunken p-[3px] ring-1 ring-line ring-inset ${SEGMENTS[tiers.length]?.cols ?? ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute start-[3px] bottom-[5px] h-[3px] px-[18%] opacity-0 transition-[translate,opacity] duration-(--dur-3) ease-out motion-reduce:transition-none group-data-choice/tiers:opacity-100 ${SLIDE} ${SEGMENTS[tiers.length]?.width ?? ''}`}
                >
                  <span className="block size-full rounded-full bg-brand" />
                </span>
                {tiers.map((tier) => (
                  <label
                    key={tier.key}
                    className="relative flex min-h-target cursor-pointer rounded-pill"
                  >
                    <input
                      type="radio"
                      name="home-tier"
                      value={tier.key}
                      className="peer absolute inset-0 m-0 size-full cursor-pointer rounded-[inherit] opacity-0"
                    />
                    {/* The segment's face: the text on its own surface, which the chosen level
                        raises (no box behind the text, so every contrast check reads it). */}
                    <span className="pointer-events-none flex flex-1 items-center justify-center rounded-pill px-3 text-small font-medium text-ink transition-[background-color,box-shadow,color] duration-(--dur-2) peer-checked:bg-surface-raised peer-checked:font-semibold peer-checked:text-brand-strong peer-checked:shadow-raised peer-checked:ring-1 peer-checked:ring-brand/50 peer-checked:ring-inset motion-reduce:transition-none forced-colors:peer-checked:outline-2 forced-colors:peer-checked:-outline-offset-2 forced-colors:peer-checked:outline-[Highlight] forced-colors:peer-checked:outline-solid">
                      {ltr(tier.name)}
                    </span>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-pill outline-offset-2 outline-focus peer-focus-visible:outline-2"
                    />
                  </label>
                ))}
              </div>
              {/* What the levels differ in, before a chip is chosen (the brief's tier facts). One
                  caption line at 1024 px, so the pinned stage still fits a 768 px viewport. */}
              <p id="home-tiers-note" className="mt-[0.25rem] text-caption text-ink-muted">
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
