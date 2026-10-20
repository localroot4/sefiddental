'use client';

import { useRef, useState, type ReactNode } from 'react';

import { toPersianDigits } from '@/lib/digits';
import { track } from '@/lib/track/track';

import { cx } from './cx';

/**
 * Before/after compare slider (DESIGN.md 3.21, family E): a square, the after layer clipped at the
 * divider, «قبل» at the start side and «بعد» at the end side. A native range input over the box
 * gives pointer, touch and arrow keys; it writes `--pos` through CSSOM (no style attribute in the
 * server HTML). Without JavaScript the range moves and the clip stays at 50%. The media and the
 * handle glyphs arrive as server-rendered nodes, the labels as props: no icon code and no message
 * table in the island (F2). The first move of the divider, by pointer or keys, sends one
 * `case_slider_use` with the `data-service-key` of an ancestor (conversion.md 9).
 */
export function CompareSlider(props: {
  before: ReactNode;
  after: ReactNode;
  handle: ReactNode;
  labels: { before: string; after: string; slider: string; percent: string };
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(50);
  const used = useRef(false);
  return (
    <div
      ref={root}
      className={cx(
        'group relative aspect-square w-full max-w-[28rem] touch-pan-y overflow-hidden rounded-media bg-surface-sunken [--pos:50]',
        props.className,
      )}
    >
      <div className="absolute inset-0">{props.before}</div>
      {/* The divider sits --pos% from the start side; the after layer keeps the end side. */}
      <div className="absolute inset-0 [clip-path:inset(0_calc(var(--pos)*1%)_0_0)] ltr:[clip-path:inset(0_0_0_calc(var(--pos)*1%))]">
        {props.after}
      </div>
      <span className="pointer-events-none absolute start-3 top-3 rounded-badge bg-surface-raised px-2 py-1 text-caption leading-[1.4] font-semibold">
        {props.labels.before}
      </span>
      <span className="pointer-events-none absolute end-3 top-3 rounded-badge bg-surface-raised px-2 py-1 text-caption leading-[1.4] font-semibold">
        {props.labels.after}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={props.labels.slider}
        aria-valuetext={`${toPersianDigits(String(value))} ${props.labels.percent}`}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          root.current?.style.setProperty('--pos', String(next));
          setValue(next);
          if (used.current) return;
          used.current = true;
          const serviceKey = root.current
            ?.closest('[data-service-key]')
            ?.getAttribute('data-service-key');
          track('case_slider_use', { location: 'section', ...(serviceKey ? { serviceKey } : {}) });
        }}
        className="absolute inset-0 z-10 m-0 size-full cursor-ew-resize opacity-0 focus-visible:outline-none"
      />
      {/* The 44 px handle is centered on the 2 px divider by flex (it overflows both sides). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 start-[calc(var(--pos)*1%)] flex w-[2px] translate-x-1/2 items-center justify-center bg-surface-raised ltr:-translate-x-1/2"
      >
        <span className="flex size-target shrink-0 items-center justify-center rounded-full border-[1.5px] border-brand bg-surface-raised text-brand shadow-raised group-has-[input:focus-visible]:outline-2 group-has-[input:focus-visible]:outline-offset-2 group-has-[input:focus-visible]:outline-focus">
          {props.handle}
        </span>
      </span>
    </div>
  );
}
