import type { ReactNode } from 'react';

import { cx } from './cx';

const TONE = {
  plain: '',
  sunken: 'bg-surface-sunken',
  // The warm stage behind the booking scene (DESIGN.md section 1).
  warm: 'bg-warm-soft',
} as const;

/**
 * A page section: the section rhythm (`--section-y`), the 1280 px content container with the
 * gutter, and an accessible name from its heading.
 */
export function Section(props: {
  labelledBy?: string;
  tone?: keyof typeof TONE;
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section
      id={props.id}
      aria-labelledby={props.labelledBy}
      className={cx('py-section', TONE[props.tone ?? 'plain'], props.className)}
    >
      <div className={cx('mx-auto w-full max-w-content px-gutter', props.innerClassName)}>
        {props.children}
      </div>
    </section>
  );
}

/**
 * Section heading: an H2 in display-2 with an optional lead under it (stacked, never a split
 * header) and one optional action (a «همهٔ …» link) at the end side from 744 px.
 */
export function SectionHeader(props: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'mb-8 grid gap-4 md:mb-12 md:flex md:items-end md:justify-between md:gap-8',
        props.className,
      )}
    >
      <div className="grid max-w-measure gap-3">
        <h2 id={props.id} className="font-display text-display-2 font-bold">
          {props.title}
        </h2>
        {props.lead ? <p className="text-body-lg text-ink-muted">{props.lead}</p> : null}
      </div>
      {props.action ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
}

// DESIGN.md 2: headlines take at most two lines at 1440 px. Display-1 holds about 34 characters
// there in the hero's text column (measured in phase 4); a longer H1 takes the hero size, which
// stays a step above the display-2 section H2s.
const LONG_TITLE = 34;

/** The PageHero `titleSize` for an H1 text: `hero` when display-1 would wrap past two lines. */
export const heroTitleSize = (title: string): 'display-1' | 'hero' =>
  [...title].length > LONG_TITLE ? 'hero' : 'display-1';

/**
 * Inner-page hero, family A (DESIGN.md section 6; brief decision 19): text at the start side,
 * media in a plain 24 px frame at the end side, no mark mask. Phones stack text, media, then the
 * CTAs; from 744 px the text and CTAs sit beside the media, centered on it. `compact` (hubs) has
 * no media and a display-2 H1. The H1 takes the whole text column; the summary keeps the reading
 * measure. One H1 per page: this one.
 */
export function PageHero(props: {
  breadcrumbs?: ReactNode;
  label?: ReactNode;
  title: ReactNode;
  /** Display-1 by default; `hero` for a long H1 (heroTitleSize). Ignored when `compact`. */
  titleSize?: 'display-1' | 'hero';
  summary?: ReactNode;
  actions?: ReactNode;
  /** Under the CTAs, e.g. the quiet «درد شدید دارید؟» link of the root-canal page. */
  note?: ReactNode;
  media?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const split = Boolean(props.media) && !props.compact;
  return (
    <header
      className={cx(
        'mx-auto w-full max-w-content px-gutter pt-4 pb-12 md:pt-6 md:pb-16',
        props.className,
      )}
    >
      {props.breadcrumbs}
      <div
        className={cx(
          'mt-6 grid gap-6 md:mt-8',
          split
            ? "[grid-template-areas:'text'_'media'_'actions'] md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] md:grid-rows-[1fr_auto_auto_1fr] md:gap-x-12 md:gap-y-6 md:[grid-template-areas:'._media'_'text_media'_'actions_media'_'._media'] lg:gap-x-16"
            : "[grid-template-areas:'text'_'actions']",
        )}
      >
        <div className="grid gap-4 [grid-area:text]">
          {props.label ? (
            <p className="text-small font-semibold text-brand-strong">{props.label}</p>
          ) : null}
          <h1
            className={cx(
              'font-display font-bold',
              props.compact
                ? 'text-display-2'
                : props.titleSize === 'hero'
                  ? 'text-hero'
                  : 'text-display-1',
            )}
          >
            {props.title}
          </h1>
          {props.summary ? (
            <p className="max-w-measure text-body-lg text-ink-muted">{props.summary}</p>
          ) : null}
        </div>
        {split ? (
          <div className="w-full max-w-[30rem] [grid-area:media] md:justify-self-end">
            {props.media}
          </div>
        ) : null}
        {props.actions || props.note ? (
          <div className="grid justify-items-start gap-4 [grid-area:actions]">
            {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
            {props.note}
          </div>
        ) : null}
      </div>
    </header>
  );
}
