import { cx } from './cx';
import { ICON_SPRITE_HASH, MIRRORED_ICONS, type IconName } from './icons';

// 20, 24, 32 px (20 is an icon size, not a spacing step); `custom` leaves the size to className.
const SIZE = { sm: 'size-[1.25rem]', md: 'size-6', lg: 'size-8', custom: '' } as const;

/**
 * One glyph of the sprite /brand/icons.svg (freeze F2), decorative: the control around it carries
 * the accessible name. 20, 24 or 32 px; color from `currentColor`, the duotone tint from a `fill-*`
 * class (the `fill` attribute is a presentation hint any class overrides). Directional glyphs
 * mirror under RTL. No hooks and no Node APIs, so an island may render it too.
 */
export function Icon(props: { name: IconName; size?: keyof typeof SIZE; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
      className={cx(
        'shrink-0',
        SIZE[props.size ?? 'md'],
        MIRRORED_ICONS.includes(props.name) && 'rtl:-scale-x-100',
        props.className,
      )}
    >
      <use href={`/brand/icons.svg?v=${ICON_SPRITE_HASH}#${props.name}`} />
    </svg>
  );
}
