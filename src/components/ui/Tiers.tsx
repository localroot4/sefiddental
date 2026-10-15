import type { ReactNode } from 'react';

import { Badge } from './Badge';
import { cx } from './cx';

export type TierColumn = {
  key: string;
  name: ReactNode;
  summary?: ReactNode;
  rows: Array<{ term: ReactNode; value: ReactNode }>;
  action?: ReactNode;
};

/** Choice mode (freeze G13): a radio per card and the section's one CTA, swapped by CSS. */
export type TierChoice = {
  /** The radios' name (the tier_select listener knows it). */
  name: string;
  /** The radio group's name, read by screen readers only. */
  legend: string;
  /** Shown on the checked card. */
  badge: ReactNode;
  /** The section's primary CTA for no tier (null) and for each tier key. */
  action: (tierKey: string | null) => ReactNode;
};

// Which CTA shows, by the position of the checked card: Tailwind cannot build a class from a tier
// key. shortcut: four tiers at most in choice mode (three today); add a row for a fifth.
const SHOW = [
  'group-has-[article:nth-of-type(1)_input:checked]/tiers:block',
  'group-has-[article:nth-of-type(2)_input:checked]/tiers:block',
  'group-has-[article:nth-of-type(3)_input:checked]/tiers:block',
  'group-has-[article:nth-of-type(4)_input:checked]/tiers:block',
];

/**
 * Tier comparison (DESIGN.md 3.19): one article per tier with a definition list. Under 1024 px a
 * native snap scroller bleeding into the gutters (the page never scrolls sideways); from 1024 three
 * equal columns. `selectedKey` (the warm state with its badge) is for a page where the visitor
 * picked one. With `choice` the visitor picks on the page: a native radio in each card heading,
 * none checked in the server HTML (F24), the whole card its hit area; the checked card turns warm
 * and the CTA under the cards carries its tier, through CSS alone, so it works without JavaScript.
 */
export function TierComparison(props: {
  tiers: TierColumn[];
  label: string;
  selectedKey?: string;
  selectedLabel?: ReactNode;
  choice?: TierChoice;
  headingLevel?: 'h3' | 'h4';
  className?: string;
}) {
  const { choice } = props;
  const tiers = choice ? props.tiers.slice(0, SHOW.length) : props.tiers;
  if (tiers.length === 0) return null;
  const Heading = props.headingLevel ?? 'h3';
  const scroller = (
    <div
      role="region"
      aria-label={props.label}
      // The radios make the scroller keyboard-reachable; without them it takes focus itself.
      tabIndex={choice ? undefined : 0}
      className={cx(
        '-mx-gutter grid snap-x snap-mandatory auto-cols-[min(84%,20rem)] grid-flow-col gap-3 overflow-x-auto scroll-px-gutter px-gutter pt-1 pb-3 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible lg:px-0',
        !choice && props.className,
      )}
    >
      {tiers.map((tier) => {
        const selected = tier.key === props.selectedKey;
        return (
          <article
            key={tier.key}
            className={cx(
              'grid snap-start content-start gap-4 rounded-card border-[1.5px] p-6',
              selected ? 'border-warm bg-warm-soft' : 'border-line bg-surface-raised',
              choice &&
                'group/card relative transition-colors hover:border-line-strong has-[input:checked]:border-warm has-[input:checked]:bg-warm-soft',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Heading className="text-heading font-semibold">
                {choice ? (
                  // The label's ::after covers the card (its positioned ancestor): a tap anywhere
                  // on the card chooses the tier.
                  <label className="flex cursor-pointer items-center gap-3 after:absolute after:inset-0 after:rounded-card after:content-['']">
                    <input
                      type="radio"
                      name={choice.name}
                      value={tier.key}
                      // Above the label's ::after, so the radio itself takes the pointer too.
                      className="relative z-[1] size-5 shrink-0 cursor-pointer accent-brand"
                    />
                    {tier.name}
                  </label>
                ) : (
                  tier.name
                )}
              </Heading>
              {choice ? (
                <span className="hidden group-has-[input:checked]/card:block">
                  <Badge tone="warm">{choice.badge}</Badge>
                </span>
              ) : selected && props.selectedLabel ? (
                <Badge tone="warm">{props.selectedLabel}</Badge>
              ) : null}
            </div>
            {tier.summary ? <p className="text-small text-ink-muted">{tier.summary}</p> : null}
            {tier.rows.length ? (
              <dl className="grid gap-3">
                {tier.rows.map((row, i) => (
                  <div key={i} className="grid gap-[2px]">
                    <dt className="text-caption font-medium text-ink-muted">{row.term}</dt>
                    <dd className="text-small">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {tier.action ? <div className="mt-2">{tier.action}</div> : null}
          </article>
        );
      })}
    </div>
  );
  if (!choice) return scroller;
  return (
    <div className={cx('group/tiers grid gap-8', props.className)}>
      <fieldset className="min-w-0">
        <legend className="sr-only">{choice.legend}</legend>
        {scroller}
      </fieldset>
      <div>
        <div className="group-has-[input:checked]/tiers:hidden">{choice.action(null)}</div>
        {tiers.map((tier, i) => (
          <div key={tier.key} className={cx('hidden', SHOW[i])}>
            {choice.action(tier.key)}
          </div>
        ))}
      </div>
    </div>
  );
}
