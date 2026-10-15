import type { ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';

export type FactItem = { value: ReactNode; caption?: ReactNode };

/**
 * Fact (DESIGN.md Fact, b.html): the value in body 600, a caption line in ink-muted, a 2 px brand
 * line at the start side. `number` is the display-2 variant for verified statistics only (gap 15).
 */
export function Fact(props: FactItem & { number?: boolean; className?: string }) {
  return (
    <div
      className={cx('grid content-start gap-[2px] border-s-2 border-brand ps-3', props.className)}
    >
      <p
        className={
          props.number
            ? 'font-display text-display-2 font-bold text-ink'
            : 'text-body leading-[1.5] font-semibold text-ink'
        }
      >
        {props.value}
      </p>
      {props.caption ? <p className="text-caption text-ink-muted">{props.caption}</p> : null}
    </div>
  );
}

// Exactly as many cells as facts (freeze F8): 2 columns on phones and tablets; from 1024 one row
// up to four, five and six facts in rows of three.
const COLUMNS = [
  '',
  'lg:grid-cols-1',
  'lg:grid-cols-2',
  'lg:grid-cols-3',
  'lg:grid-cols-4',
  'lg:grid-cols-3',
  'lg:grid-cols-3',
];

/** Fact row (family B): only the facts that exist render; none renders nothing. */
export function FactsRow(props: {
  facts: FactItem[];
  label?: string;
  number?: boolean;
  className?: string;
}) {
  const facts = props.facts.slice(0, 6);
  if (facts.length === 0) return null;
  return (
    <ul
      aria-label={props.label}
      className={cx('grid grid-cols-2 gap-x-6 gap-y-4', COLUMNS[facts.length], props.className)}
    >
      {facts.map((fact, i) => (
        <li key={i} className="grid">
          <Fact {...fact} number={props.number} />
        </li>
      ))}
    </ul>
  );
}

export type FaqEntry = { question: ReactNode; answer: ReactNode; open?: boolean };

/**
 * FAQ (DESIGN.md FAQ item): native `<details>`, 44 px summary, the chevron turns on open; no
 * height animation. Works without JavaScript. The page adds the FAQPage JSON-LD.
 */
export function FaqList(props: { items: FaqEntry[]; className?: string }) {
  if (props.items.length === 0) return null;
  return (
    <div className={cx('border-b border-line', props.className)}>
      {props.items.map((item, i) => (
        <details key={i} open={item.open} className="group border-t border-line">
          <summary className="flex min-h-target cursor-pointer list-none items-center justify-between gap-4 py-3 font-semibold transition-colors hover:text-brand-strong [&::-webkit-details-marker]:hidden">
            {item.question}
            <Icon
              name="caret-down"
              className="text-brand transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="max-w-measure pb-4 text-small text-ink-muted">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}

export type StepEntry = { title: ReactNode; text?: ReactNode };

/**
 * Steps, family G-static (DESIGN.md section 5): a vertical list with the diamond markers joined by
 * a hairline. The order is the list order; no «مرحلهٔ ۱» labels.
 */
export function Steps(props: {
  items: StepEntry[];
  headingLevel?: 'h3' | 'h4';
  className?: string;
}) {
  if (props.items.length === 0) return null;
  const Heading = props.headingLevel ?? 'h3';
  return (
    <ol className={cx('grid', props.className)}>
      {props.items.map((step, i) => (
        <li
          key={i}
          className="group relative grid grid-cols-[1rem_minmax(0,1fr)] gap-x-4 pb-8 last:pb-0"
        >
          <span aria-hidden="true" className="flex justify-center pt-2">
            <span className="size-2 rotate-45 bg-brand" />
          </span>
          <span
            aria-hidden="true"
            className="absolute start-[calc(.5rem-.5px)] top-6 bottom-1 w-px bg-line group-last:hidden"
          />
          <div className="grid gap-1">
            <Heading className="text-body-lg leading-[1.4] font-semibold">{step.title}</Heading>
            {step.text ? (
              <p className="max-w-measure text-small text-ink-muted">{step.text}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Quote (studio decision, design-components Q-11): a short patient quote with its attribution,
 * under the brand's bar motif. Only consented, real quotes; at most three lines of body.
 */
export function Quote(props: { children: ReactNode; cite: ReactNode; className?: string }) {
  return (
    <figure
      className={cx(
        "grid content-start gap-3 pt-4 before:block before:h-[2px] before:w-8 before:bg-brand before:content-['']",
        props.className,
      )}
    >
      <blockquote className="text-body-lg text-ink">{props.children}</blockquote>
      <figcaption className="text-small text-ink-muted">{props.cite}</figcaption>
    </figure>
  );
}
