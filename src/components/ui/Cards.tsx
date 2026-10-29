import { Children, type ReactNode } from 'react';

import { toPersianDigits } from '@/lib/persianText';

import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type Accent = 'cosmetic' | 'surgery' | 'restorative' | 'ortho' | 'kids';

// Category colors fill the duotone layer only; the outline stays ink so the glyph reads in both
// themes (yellow on white is 1.2:1). Decorative next to its title (freeze F23).
const ACCENT_FILL: Record<Accent, string> = {
  cosmetic: 'fill-cat-cosmetic',
  surgery: 'fill-cat-surgery',
  restorative: 'fill-cat-restorative',
  ortho: 'fill-cat-ortho',
  kids: 'fill-cat-kids',
};

const DEFAULT_GLYPH: Record<Accent, IconName> = {
  cosmetic: 'duo-sparkle',
  surgery: 'duo-bandaids',
  restorative: 'duo-tooth',
  ortho: 'duo-smiley',
  kids: 'duo-baby',
};

// The admin's free-text Phosphor name (service-categories.icon) through an allowlist (Q-19).
const GLYPHS: Record<string, IconName> = {
  sparkle: 'duo-sparkle',
  bandaids: 'duo-bandaids',
  tooth: 'duo-tooth',
  smiley: 'duo-smiley',
  baby: 'duo-baby',
};

/** The duotone category icon: the admin's glyph when allowed, else the accent's default. */
export function CategoryIcon(props: {
  accent: Accent;
  icon?: string | null;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const glyph = GLYPHS[props.icon?.trim().toLowerCase() ?? ''] ?? DEFAULT_GLYPH[props.accent];
  return (
    <Icon
      name={glyph}
      size={props.size ?? 'md'}
      // Dark: the ink outline turns light, so the tint dims to keep the inner strokes readable (S1).
      className={cx('text-ink dark:[fill-opacity:0.4]', ACCENT_FILL[props.accent], props.className)}
    />
  );
}

// Link cards: the title's link stretches over the card (one accessible name, no nested
// controls), the ring shows on the card, the 2 px lift and the shadow come on hover. The shadow
// sits on a pseudo-element and fades by opacity (DESIGN.md X-16). The lift transitions `translate`
// only: a scene that tweens `transform` would restart a CSS transition every frame.
const LINK_CARD =
  "relative isolate rounded-card border border-line bg-surface-raised transition-[translate] hover:-translate-y-[2px] before:absolute before:-inset-px before:-z-10 before:rounded-[inherit] before:opacity-0 before:shadow-raised before:transition-opacity before:content-[''] hover:before:opacity-100";

/**
 * The link's ::after covers the card's border box with the card's radius and carries its ring
 * (the card itself would need `:has()`, which makes every DOM insertion restyle the whole page).
 */
export const STRETCHED =
  "after:absolute after:-inset-px after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus";

/**
 * Service card (DESIGN.md 3.17): 4:3 media, the title with its category icon, one line, short
 * facts, and a link-styled line («هزینه و شرایط …»). The media is a Picture or a placeholder.
 */
export function ServiceCard(props: {
  href: string;
  title: ReactNode;
  line?: ReactNode;
  accent?: Accent;
  icon?: string | null;
  media?: ReactNode;
  facts?: ReactNode[];
  linkText?: ReactNode;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading = props.headingLevel ?? 'h3';
  return (
    <article className={cx(LINK_CARD, 'flex flex-col', props.className)}>
      {props.media ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-t-[19px] bg-surface-sunken">
          {props.media}
        </div>
      ) : null}
      <div className="grid gap-2 px-6 pt-4 pb-6">
        <Heading className="flex items-center gap-2 text-heading font-semibold">
          {props.accent ? <CategoryIcon accent={props.accent} icon={props.icon} /> : null}
          <a href={props.href} className={STRETCHED}>
            {props.title}
          </a>
        </Heading>
        {props.line ? <p className="text-small text-ink-muted">{props.line}</p> : null}
        {props.facts?.length ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
            {props.facts.map((fact, i) => (
              <li key={i} className="inline-flex items-center gap-1">
                <Icon name="check" size="sm" className="text-line-strong" />
                {fact}
              </li>
            ))}
          </ul>
        ) : null}
        {props.linkText ? (
          <span className="mt-2 inline-flex items-center gap-1 text-small font-medium text-brand-strong underline decoration-line-strong underline-offset-[.22em]">
            {props.linkText}
            <Icon name="arrow-forward" size="sm" />
          </span>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Category tile (DESIGN.md 3.18): the duotone icon, title, service list, count. `featured` (the
 * cosmetic tile) spans two rows from 744 px and ends with its media. Lay tiles out in TileGrid.
 */
export function CategoryTile(props: {
  href: string;
  title: ReactNode;
  accent: Accent;
  icon?: string | null;
  list?: ReactNode;
  count?: ReactNode;
  media?: ReactNode;
  featured?: boolean;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading = props.headingLevel ?? 'h3';
  return (
    <article
      className={cx(
        LINK_CARD,
        'grid content-start gap-3 p-6',
        props.featured && 'md:row-span-2',
        props.className,
      )}
    >
      <CategoryIcon accent={props.accent} icon={props.icon} size="lg" />
      <Heading className="text-heading font-semibold">
        <a href={props.href} className={STRETCHED}>
          {props.title}
        </a>
      </Heading>
      {props.list ? <p className="text-small text-ink-muted">{props.list}</p> : null}
      {props.count ? <p className="text-caption text-ink-muted">{props.count}</p> : null}
      {props.featured && props.media ? (
        <div className="relative mt-auto aspect-[4/3] overflow-hidden rounded-media bg-surface-sunken">
          {props.media}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Bento of category tiles (family C, five cells exactly): one column, two from 744 and three
 * from 1024, the featured tile first and two rows tall.
 */
export function TileGrid(props: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid gap-3 md:grid-cols-2 lg:grid-cols-3', props.className)}>
      {props.children}
    </div>
  );
}

/**
 * Dentist card (DESIGN.md 3.20): 4:5 portrait, name, specialty, the council number as an LTR
 * island. A link card when it has a profile. Never an invented name.
 */
export function DentistCard(props: {
  name: ReactNode;
  specialty?: ReactNode;
  councilLabel?: ReactNode;
  councilNumber?: string | null;
  media: ReactNode;
  href?: string;
  headingLevel?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading = props.headingLevel ?? 'h3';
  return (
    <article
      className={cx(
        props.href ? LINK_CARD : 'rounded-card border border-line bg-surface-raised',
        'flex flex-col',
        props.className,
      )}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-t-[19px] bg-surface-sunken">
        {props.media}
      </div>
      <div className="grid gap-1 px-6 pt-4 pb-6">
        <Heading className="text-heading font-semibold">
          {props.href ? (
            <a href={props.href} className={STRETCHED}>
              {props.name}
            </a>
          ) : (
            props.name
          )}
        </Heading>
        {props.specialty ? <p className="text-small text-ink-muted">{props.specialty}</p> : null}
        {props.councilNumber ? (
          <p className="text-caption text-ink-muted">
            {props.councilLabel} <bdi dir="ltr">{toPersianDigits(props.councilNumber)}</bdi>
          </p>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Family F: a native snap carousel under 1024 px (bleeding into the gutters, the tier scroller
 * values) and a three-column grid from 1024. Focusable with a name so keyboard users can scroll.
 * A single card shows no peek of a next one: it takes the row up to 24rem.
 */
export function CardRail(props: { label: string; children: ReactNode; className?: string }) {
  const single = Children.toArray(props.children).length === 1;
  return (
    <div
      role="region"
      aria-label={props.label}
      tabIndex={0}
      className={cx(
        '-mx-gutter grid snap-x snap-mandatory grid-flow-col gap-3 overflow-x-auto scroll-px-gutter px-gutter pt-1 pb-3 lg:mx-0 lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible lg:px-0 [&>*]:snap-start',
        single ? 'auto-cols-[min(100%,24rem)]' : 'auto-cols-[min(84%,20rem)]',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
