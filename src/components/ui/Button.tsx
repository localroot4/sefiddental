import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import type { EventLocation, EventName } from '@/lib/events/allowlist';

import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

/** Measurement attributes read by the delegated TrackListener (CallBlock convention). */
export type Track = { event: EventName; location: EventLocation; serviceKey?: string };

// Hover and press only while enabled: a disabled control shows no feedback (DESIGN.md 7). Every
// variant sets its own border color: two border-color classes on one element would race.
const VARIANT: Record<ButtonVariant, string> = {
  primary:
    'border-transparent bg-brand text-on-brand hover:not-disabled:not-aria-disabled:bg-brand-strong',
  secondary: 'border-brand text-brand-strong hover:not-disabled:not-aria-disabled:bg-brand-soft',
  ghost: 'border-transparent text-brand-strong hover:not-disabled:not-aria-disabled:bg-brand-soft',
  // Not `danger`: in dark it is a pink text color, too light under the white label.
  danger:
    'border-transparent bg-danger-fill text-on-danger hover:not-disabled:not-aria-disabled:bg-danger-strong',
};

// Padding-inline is half the height (22 / 26 px); every variant keeps a 1.5 px border so all
// variants share one box.
const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-target px-[1.375rem] text-small',
  lg: 'min-h-target-lg px-[1.625rem] text-body',
};

// A spinner without a start icon to replace adds 26 px (18 px ring and the 8 px gap): take 13 px
// off each side so the button keeps its width. `ps`/`pe` come after `px` in the CSS.
const LOADING_PAD: Record<ButtonSize, string> = {
  md: 'ps-[.5625rem] pe-[.5625rem]',
  lg: 'ps-[.8125rem] pe-[.8125rem]',
};

/** Classes of the Button look, for elements that are not a Button (a summary, a label). */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  fullWidth = false,
): string {
  return cx(
    'relative inline-flex items-center justify-center gap-2 rounded-pill border-[1.5px] font-semibold leading-[1.2] whitespace-nowrap no-underline',
    '[transition:background-color_var(--dur-2)_var(--ease-out),border-color_var(--dur-2)_var(--ease-out),color_var(--dur-2)_var(--ease-out),scale_var(--dur-1)_var(--ease-out)]',
    'active:not-disabled:not-aria-disabled:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
    VARIANT[variant],
    SIZE[size],
    fullWidth && 'w-full',
  );
}

/** 18 px ring (DESIGN.md 3.1); 0.8 s per turn, 1.6 s under reduced motion (globals.css). */
export function Spinner(props: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-block size-[1.125rem] shrink-0 animate-spin rounded-full border-2 border-current border-e-transparent',
        props.className,
      )}
    />
  );
}

type Common = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  track?: Track;
  className?: string;
  children: ReactNode;
};

function trackAttrs(track: Track | undefined) {
  return track
    ? {
        'data-track': track.event,
        'data-location': track.location,
        'data-service-key': track.serviceKey,
      }
    : {};
}

/**
 * A `<button>`. Loading keeps the label and the width, swaps the start icon for the spinner and
 * sets `aria-busy` and `data-loading`; the owning form island sets it and ignores a second
 * submit. No hooks and no handlers of its own, so server components and islands both render it.
 */
export function Button({
  variant,
  size,
  fullWidth,
  iconStart,
  iconEnd,
  track,
  className,
  children,
  loading = false,
  type = 'button',
  ...rest
}: Common & { loading?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return (
    <button
      {...rest}
      {...trackAttrs(track)}
      type={type}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      className={cx(
        buttonClasses(variant, size, fullWidth),
        loading && 'pointer-events-none',
        loading && !iconStart && LOADING_PAD[size ?? 'md'],
        className,
      )}
    >
      {loading ? <Spinner /> : iconStart}
      {children}
      {iconEnd}
    </button>
  );
}

/**
 * A link with the Button look (navigation, `tel:`, wa.me). Disabled renders an `<a>` without
 * `href` and with `aria-disabled`, so it is neither focusable nor activatable (D-3); `role="link"`
 * keeps it a link for screen readers, which ignore `aria-disabled` on a bare `<a>`.
 */
export function ButtonLink({
  variant,
  size,
  fullWidth,
  iconStart,
  iconEnd,
  track,
  className,
  children,
  disabled = false,
  href,
  ...rest
}: Common & { href: string; disabled?: boolean } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'children' | 'href'
  >) {
  return (
    <a
      {...rest}
      {...trackAttrs(track)}
      href={disabled ? undefined : href}
      role={disabled ? 'link' : undefined}
      aria-disabled={disabled || undefined}
      className={cx(buttonClasses(variant, size, fullWidth), className)}
    >
      {iconStart}
      {children}
      {iconEnd}
    </a>
  );
}

/**
 * Icon-only control, 44 x 44 at every width, with a required Persian name (DESIGN.md 3.3):
 * a `<button>` without `href`, a link with it.
 */
export function IconButton({
  label,
  href,
  icon,
  className,
  track,
  ...rest
}: {
  label: string;
  icon: ReactNode;
  href?: string;
  className?: string;
  track?: Track;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const classes = cx(
    'inline-grid size-target shrink-0 place-items-center rounded-pill text-ink transition-[background-color,scale] hover:not-disabled:bg-brand-soft active:not-disabled:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50',
    className,
  );
  if (href) {
    return (
      <a href={href} aria-label={label} className={classes} {...trackAttrs(track)}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} className={classes} {...trackAttrs(track)} {...rest}>
      {icon}
    </button>
  );
}
