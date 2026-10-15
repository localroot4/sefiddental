import type { ReactNode } from 'react';

import type { HoursStateName } from '@/lib/hoursState';

import { cx } from './cx';
import { Skeleton } from './Feedback';

// Green only while open; the closed states stay quiet (red is for errors only).
const TONE: Record<HoursStateName, string> = {
  open: 'text-success',
  'closing-soon': 'text-warning',
  'before-open': 'text-ink-muted',
  closed: 'text-ink-muted',
  holiday: 'text-ink-muted',
};

/**
 * The live hours state from /api/form-session: a clock and a short label. `state` null (not
 * known yet) keeps the same box as a skeleton, so nothing shifts when it arrives. Labels come in
 * as props (hoursBadgeLabels() in a server parent) and so does the clock glyph: an island must not
 * import the message table or icon code (F2).
 */
export function HoursBadge(props: {
  state: HoursStateName | null;
  labels: Record<HoursStateName, string>;
  icon: ReactNode;
  className?: string;
}) {
  if (!props.state) {
    return <Skeleton className={cx('h-8 w-[9rem] rounded-pill', props.className)} />;
  }
  return (
    <span
      className={cx(
        'inline-flex min-h-8 items-center gap-2 text-small font-semibold',
        TONE[props.state],
        props.className,
      )}
    >
      {props.icon}
      {props.labels[props.state]}
    </span>
  );
}
