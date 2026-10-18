import type { ReactNode } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';
import type { IconName } from './icons';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

// Tinted fill with ink text (styleguide; DESIGN.md X-12): the fill token mixed into the raised
// surface, the border in the fill, the icon in the semantic text color. Both themes measured in
// the phase 4 report; red only for errors.
const TONE: Record<AlertTone, { box: string; icon: string; name: IconName }> = {
  info: {
    box: 'border-info-fill bg-[color-mix(in_srgb,var(--color-info-fill)_22%,var(--color-surface-raised))]',
    icon: 'text-info',
    name: 'info',
  },
  success: {
    box: 'border-success-fill bg-[color-mix(in_srgb,var(--color-success-fill)_22%,var(--color-surface-raised))]',
    icon: 'text-success',
    name: 'check-circle',
  },
  warning: {
    box: 'border-warning-fill bg-[color-mix(in_srgb,var(--color-warning-fill)_22%,var(--color-surface-raised))] dark:bg-[color-mix(in_srgb,var(--color-warning-fill)_22%,var(--color-warm-soft))]',
    icon: 'text-warning',
    name: 'warning',
  },
  danger: {
    box: 'border-danger-fill bg-[color-mix(in_srgb,var(--color-danger-fill)_14%,var(--color-surface-raised))]',
    icon: 'text-danger',
    name: 'x-circle',
  },
};

/**
 * Alert (DESIGN.md Alerts): a bold first line and an optional body. `role="alert"` for danger,
 * `role="status"` otherwise. Article callouts reuse it.
 */
export function Alert(props: {
  tone: AlertTone;
  title: ReactNode;
  children?: ReactNode;
  id?: string;
  className?: string;
}) {
  const tone = TONE[props.tone];
  return (
    <div
      id={props.id}
      role={props.tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'grid grid-cols-[auto_1fr] content-start items-start gap-3 rounded-card border p-4 text-small text-ink',
        tone.box,
        props.className,
      )}
    >
      <Icon name={tone.name} className={cx('mt-[.1em]', tone.icon)} />
      <div className="grid gap-1">
        <p className="font-semibold">{props.title}</p>
        {props.children ? <div>{props.children}</div> : null}
      </div>
    </div>
  );
}
