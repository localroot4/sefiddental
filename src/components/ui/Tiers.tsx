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

/**
 * Tier comparison (DESIGN.md 3.19): one article per tier with a definition list. Under 1024 px a
 * native snap scroller bleeding into the gutters (the page never scrolls sideways); from 1024 three
 * equal columns. No tier is preselected on the restoration page (freeze F24); `selectedKey` (the
 * warm state with its badge) is for a page where the visitor picked one.
 */
export function TierComparison(props: {
  tiers: TierColumn[];
  label: string;
  selectedKey?: string;
  selectedLabel?: ReactNode;
  headingLevel?: 'h3' | 'h4';
  className?: string;
}) {
  if (props.tiers.length === 0) return null;
  const Heading = props.headingLevel ?? 'h3';
  return (
    <div
      role="region"
      aria-label={props.label}
      tabIndex={0}
      className={cx(
        '-mx-gutter grid snap-x snap-mandatory auto-cols-[min(84%,20rem)] grid-flow-col gap-3 overflow-x-auto scroll-px-gutter px-gutter pt-1 pb-3 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible lg:px-0',
        props.className,
      )}
    >
      {props.tiers.map((tier) => {
        const selected = tier.key === props.selectedKey;
        return (
          <article
            key={tier.key}
            className={cx(
              'grid snap-start content-start gap-4 rounded-card border-[1.5px] p-6',
              selected ? 'border-warm bg-warm-soft' : 'border-line bg-surface-raised',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <Heading className="text-heading font-semibold">{tier.name}</Heading>
              {selected && props.selectedLabel ? (
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
}
