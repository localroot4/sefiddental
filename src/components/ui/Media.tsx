import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';
import { readEnv } from '@/lib/env';

import { cx } from './cx';
import { PLACEHOLDER_SURFACE } from './Feedback';
import { Icon } from './Icon';

/**
 * Image ratios of DESIGN.md section 4. `hero` is the inner-page hero frame: 4:5 up to 1023 px,
 * 3:2 from 1024 (design-components Q-4).
 */
export const RATIO = {
  '4:5': 'aspect-[4/5]',
  '3:2': 'aspect-[3/2]',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  hero: 'aspect-[4/5] lg:aspect-[3/2]',
} as const;

export type Ratio = keyof typeof RATIO;

/**
 * Plain media frame (family A): fixed ratio, 24 px radius, no mark mask. The image or the
 * placeholder fills it.
 */
export function MediaFrame(props: { ratio: Ratio; children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-media bg-surface-sunken',
        RATIO[props.ratio],
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}

/**
 * Whether the «جای عکس» captions show: on the client preview only (DEMO_CONTENT), where the clinic
 * sees which photo goes where. Unset is off, so readEnv parses the flag only when it is set: a
 * page or a test without the full environment never needs it.
 */
export function photoCaptions(): boolean {
  return Boolean(process.env.DEMO_CONTENT) && readEnv().demoContent;
}

/**
 * A missing client photo (freeze F3): a calm brand panel (PLACEHOLDER_SURFACE) that names the
 * photo it waits for. The mark sits in it as a quiet relief, porcelain white in light and teal
 * glass in dark (decorative, non-text), and steps back (invisible, its row kept) when the panel is
 * under 10rem tall, where it would shrink to a stray icon. The caption «جای عکس: …» tells the
 * clinic which photo goes where, so it shows on the client preview only (DEMO_CONTENT): a small
 * label in its own row at the bottom start, visible text in Persian digits. Elsewhere the panel
 * is decorative and keeps the caption in `data-photo-slot` for QA. Nothing moves. The
 * panel is a size container, so its content never changes the ratio. `fill` and `card` fill a
 * positioned frame (MediaFrame, a card's media slot) that clips them to its radius; `standalone`
 * has its own ratio and radius. Every placement has a row in docs/content/gaps.md.
 */
export function MediaPlaceholder(props: {
  caption: string;
  ratio?: Ratio;
  variant?: 'fill' | 'standalone' | 'card';
  className?: string;
}) {
  return (
    <div
      data-photo-slot={props.caption}
      className={cx(
        '@container-size grid grid-cols-1 grid-rows-[minmax(0,1fr)_auto] gap-3 p-4 text-caption text-ink-muted',
        PLACEHOLDER_SURFACE,
        props.variant === 'standalone'
          ? cx('rounded-media', RATIO[props.ratio ?? '4:3'])
          : 'absolute inset-0',
        props.className,
      )}
    >
      <Icon
        name="mark"
        size="custom"
        className="aspect-[184/223] h-[min(56%,10rem)] w-auto max-w-full place-self-center text-surface-raised/75 dark:text-brand/15 [@container(height<10rem)]:invisible"
      />
      {photoCaptions() ? (
        <p className="max-w-[30ch]">
          <span className="font-semibold text-brand-strong">{t('ui.placeholder.prefix')}</span>{' '}
          {props.caption}
        </p>
      ) : null}
    </div>
  );
}
