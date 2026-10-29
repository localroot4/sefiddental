import type { ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';

/**
 * The panel of content still to come: missing photos (MediaPlaceholder), missing text
 * (TextPlaceholder) and empty states. Brand mixed into surface-raised at 14%, the share
 * `PLACEHOLDER` in design/tools/contrast.py (change both together); ink-muted captions and
 * brand-strong prefixes hold AA on it (DESIGN.md 1.1). Here, not in Media.tsx, so the island-safe
 * HoursBadge (which imports Skeleton) never reaches the message table.
 */
export const PLACEHOLDER_SURFACE =
  'bg-[color-mix(in_srgb,var(--color-brand)_14%,var(--color-surface-raised))]';

/**
 * Transient message (DESIGN.md toast): fixed above the sticky bar under 1024 px, 24 px from the
 * bottom from 1024; enters with a 16 px rise and a fade over --dur-3. The `role="status"` wrapper
 * is always exposed, so assistive tech already watches it when the panel appears; only the panel
 * hides. The owning island toggles `open`, closes it after 4 s and keeps the last message as
 * children while it fades out.
 */
export function Toast(props: { open: boolean; children: ReactNode }) {
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-gutter bottom-[calc(var(--sticky-bar-h)+env(safe-area-inset-bottom)+var(--space-4))] z-50 flex justify-center lg:bottom-6"
    >
      <div
        className={cx(
          'pointer-events-auto flex w-full max-w-[26rem] items-center gap-3 rounded-card border border-line bg-surface-raised px-4 py-3 text-small text-ink shadow-floating',
          'transition-[translate,opacity,visibility] duration-(--dur-3)',
          props.open ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-4 opacity-0',
        )}
      >
        <Icon name="check-circle" className="text-success" />
        <span>{props.children}</span>
      </div>
    </div>
  );
}

/**
 * Skeleton bars (DESIGN.md Skeletons): sunken surface, 8 px radius, an opacity pulse that stops
 * under reduced motion. Shapes match the final layout; the container names what is loading.
 */
export function Skeleton(props: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('block animate-pulse rounded-badge bg-line', props.className)}
    />
  );
}

/** Loading container: `aria-busy` and a Persian name, so screen readers hear what is loading. */
export function Loading(props: { label: string; children: ReactNode; className?: string }) {
  return (
    <div aria-busy="true" aria-label={props.label} role="status" className={props.className}>
      {props.children}
    </div>
  );
}

/** The service-card skeleton: card border, 4:3 block, three lines at 60, 85 and 40 percent. */
export function SkeletonCard() {
  return (
    <div className="grid gap-3 overflow-hidden rounded-card border border-line pb-6">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <Skeleton className="mx-6 h-[.9rem] w-[60%]" />
      <Skeleton className="mx-6 h-[.9rem] w-[85%]" />
      <Skeleton className="mx-6 h-[.9rem] w-[40%]" />
    </div>
  );
}

/**
 * Empty state (DESIGN.md): one sentence that names the next step and one action, around the brand
 * mark, on the placeholder panel with no outline, so content still to come reads the same as a
 * missing photo or text (MediaPlaceholder).
 */
export function EmptyState(props: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'grid content-center justify-items-center gap-3 rounded-card px-6 py-12 text-center',
        PLACEHOLDER_SURFACE,
        props.className,
      )}
    >
      <Icon name="mark" size="custom" className="h-[2.75rem] w-[2.25rem] text-brand/45" />
      <p className="text-small text-ink-muted">{props.children}</p>
      {props.action}
    </div>
  );
}

/**
 * The drawn success check (conversion.md 5.4 item 1): circle, then the tick 60% into the circle's
 * draw; already drawn under reduced motion (the durations become 0). 64 px, 48 px when compact.
 */
export function SuccessCheck(props: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cx('shrink-0 text-success', props.compact ? 'size-12' : 'size-16')}
    >
      <circle
        cx="32"
        cy="32"
        r="29"
        pathLength={1}
        className="animate-draw [stroke-dasharray:1] [stroke-dashoffset:1]"
      />
      <path
        d="M20 33l8 8 16-17"
        pathLength={1}
        className="animate-draw [animation-delay:calc(var(--dur-4)*.6)] [stroke-dasharray:1] [stroke-dashoffset:1]"
      />
    </svg>
  );
}
