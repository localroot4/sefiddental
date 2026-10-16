import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';

const SIGNS = [
  'emergency.safety.face',
  'emergency.safety.breath',
  'emergency.safety.bleeding',
  'emergency.safety.head',
] as const;

/**
 * The two-level safety box (docs/conversion.md 7.2): go to emergency now, then the same-day exam
 * line. The warning tint of Alert (DESIGN.md 1.1: ink 12.65 / 9.52, icon 4.43 / 5.11), never red
 * and never role="alert": static text must not interrupt on load (EM-B4, EM-B5). The tel:115 link
 * is never tracked (EM-D4) and never sits inside [data-call-sheet], so the closed-hours sheet
 * cannot intercept it. The border stays in forced-colors mode. The `repeat` on success is no named
 * region: two landmarks with one name would list twice in a screen reader's landmarks.
 */
export function SafetyBox(props: { id: string; repeat?: boolean }) {
  const title = `${props.id}-title`;
  return (
    <section
      aria-labelledby={props.repeat ? undefined : title}
      data-section="safety"
      className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-4 rounded-card border border-warning-fill bg-[color-mix(in_srgb,var(--color-warning-fill)_22%,var(--color-surface-raised))] p-4 text-ink md:p-6"
    >
      <Icon name="warning" className="mt-[.3em] text-warning" />
      <div className="grid gap-4">
        <h2 id={title} className="text-body-lg leading-[1.7] font-semibold">
          {t('emergency.safety.before')}{' '}
          <a
            href="tel:115"
            className="font-bold whitespace-nowrap underline decoration-2 underline-offset-[.22em] hover:decoration-[3px]"
          >
            {t('emergency.safety.link')}
          </a>{' '}
          {t('emergency.safety.after')}
        </h2>
        <ul className="grid list-disc gap-2 ps-6 text-body marker:text-warning">
          {SIGNS.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="border-t border-warning-fill pt-4 text-body">
          {t('emergency.safety.sameDay')}
        </p>
      </div>
    </section>
  );
}
