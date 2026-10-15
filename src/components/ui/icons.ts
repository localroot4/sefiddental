/**
 * The icon set of the site (DESIGN.md section 4, freeze F2): Phosphor regular for the interface,
 * Phosphor duotone for the category icons, plus the brand mark. Only these names reach the sprite
 * `public/brand/icons.svg`, built at predev and prebuild by scripts/sync-public-assets.mjs.
 * Sources: `phosphor/<weight>/<file>` in @phosphor-icons/core 2.1.1 (MIT), `brand/<file>` in
 * design/brand. No imports: Node runs this file directly from the sync script.
 */
export const ICONS = {
  'address-book': 'phosphor/regular/address-book',
  'arrow-forward': 'phosphor/regular/arrow-right',
  calendar: 'phosphor/regular/calendar-blank',
  'caret-back': 'phosphor/regular/caret-left',
  'caret-down': 'phosphor/regular/caret-down',
  'caret-forward': 'phosphor/regular/caret-right',
  check: 'phosphor/regular/check',
  'check-circle': 'phosphor/regular/check-circle',
  clock: 'phosphor/regular/clock',
  close: 'phosphor/regular/x',
  info: 'phosphor/regular/info',
  instagram: 'phosphor/regular/instagram-logo',
  'map-pin': 'phosphor/regular/map-pin',
  menu: 'phosphor/regular/list',
  moon: 'phosphor/regular/moon',
  navigation: 'phosphor/regular/navigation-arrow',
  phone: 'phosphor/regular/phone',
  play: 'phosphor/regular/play',
  sun: 'phosphor/regular/sun',
  telegram: 'phosphor/regular/telegram-logo',
  warning: 'phosphor/regular/warning',
  'warning-circle': 'phosphor/regular/warning-circle',
  whatsapp: 'phosphor/regular/whatsapp-logo',
  'x-circle': 'phosphor/regular/x-circle',
  'duo-baby': 'phosphor/duotone/baby-duotone',
  'duo-bandaids': 'phosphor/duotone/bandaids-duotone',
  'duo-smiley': 'phosphor/duotone/smiley-duotone',
  'duo-sparkle': 'phosphor/duotone/sparkle-duotone',
  'duo-tooth': 'phosphor/duotone/tooth-duotone',
  mark: 'brand/logo-mark',
} as const;

export type IconName = keyof typeof ICONS;

/**
 * Directional glyphs, drawn LTR-forward and mirrored under RTL so a later LTR locale works.
 * Phones, clocks, checks, play and logos never mirror (DESIGN.md section 4).
 */
export const MIRRORED_ICONS: readonly IconName[] = ['arrow-forward', 'caret-back', 'caret-forward'];

/**
 * First 8 hex digits of the SHA-256 of the built sprite: the cache-busting query of every `<use>`.
 * The sync script and test IS1 fail when it no longer matches, so a changed name list or package
 * version can never serve a stale sprite from the week-long /brand cache.
 */
export const ICON_SPRITE_HASH = '3d4c1902';
