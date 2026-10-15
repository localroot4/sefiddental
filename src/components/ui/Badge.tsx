import type { ReactNode } from 'react';

import { cx } from './cx';

const BADGE = {
  // The selected tier only: one warm element per viewport (DESIGN.md section 1).
  warm: 'bg-warm text-on-warm',
  // Emergency: warning fill with navy text, never red (DESIGN.md section 1).
  emergency: 'bg-warning-fill text-on-fill',
  neutral: 'bg-surface-sunken text-ink-muted',
} as const;

/** Badge (DESIGN.md 3.35): 24 px, 8 px radius, caption 600. */
export function Badge(props: {
  tone?: keyof typeof BADGE;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex min-h-6 items-center rounded-badge px-2 text-caption leading-none font-semibold',
        BADGE[props.tone ?? 'neutral'],
        props.className,
      )}
    >
      {props.children}
    </span>
  );
}

/**
 * Tag: a short label in a 32 px pill (a category, a topic). As a link it gains the hover fill and
 * a 44 px hit area around the same pill, so a row of tags keeps one height.
 */
export function Tag(props: { children: ReactNode; href?: string; className?: string }) {
  const classes = cx(
    'inline-flex min-h-8 items-center rounded-pill bg-brand-soft px-3 text-caption font-medium text-brand-strong',
    props.href &&
      "relative transition-colors after:absolute after:inset-x-0 after:inset-y-[-6px] after:content-[''] hover:bg-[color-mix(in_srgb,var(--color-brand)_18%,var(--color-brand-soft))]",
    props.className,
  );
  return props.href ? (
    <a href={props.href} className={classes}>
      {props.children}
    </a>
  ) : (
    <span className={classes}>{props.children}</span>
  );
}
