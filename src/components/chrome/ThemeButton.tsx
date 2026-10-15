import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';

// Both glyphs share one grid cell; the outgoing one fades (--dur-2) while it turns and shrinks
// (--dur-3). The dark: variant drives it, so the server HTML shows the right icon (C18: the target
// theme, a moon in light). The tokens are 0 ms under reduced motion.
const MORPH =
  '[grid-area:1/1] transition-[opacity,rotate,scale] [transition-duration:var(--dur-2),var(--dur-3),var(--dur-3)]';

/** The theme toggle with its label and icons (header from 1024 px, drawer foot under it). */
export function ThemeButton(props: { location: 'header' | 'drawer' }) {
  return (
    <ThemeToggle label={t('theme.toggle')} location={props.location}>
      <Icon name="moon" className={`${MORPH} dark:scale-60 dark:-rotate-60 dark:opacity-0`} />
      <Icon
        name="sun"
        className={`${MORPH} scale-60 rotate-60 opacity-0 dark:scale-100 dark:rotate-0 dark:opacity-100`}
      />
    </ThemeToggle>
  );
}
