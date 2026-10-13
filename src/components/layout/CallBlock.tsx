import { CLINIC_FALLBACK, t } from '@/i18n/fa';

/**
 * «تماس با کلینیک» with the number in an LTR island and the hours line next to it: no button
 * dials a closed clinic without a warning (conversion.md self-review 5). Values are the static
 * fallback so the block renders with the database down; phase 4 passes live clinic data and
 * replaces the hours line with the closed-hours sheet.
 */
export function CallBlock(props: {
  phoneE164?: string;
  phoneDisplay?: string;
  hoursLine?: string;
  location?: 'page' | 'footer' | 'header';
}) {
  const phoneE164 = props.phoneE164 ?? CLINIC_FALLBACK.phoneE164;
  const phoneDisplay = props.phoneDisplay ?? CLINIC_FALLBACK.phoneDisplay;
  const hoursLine = props.hoursLine ?? CLINIC_FALLBACK.hoursLine;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a
        href={`tel:${phoneE164}`}
        data-track="call_click"
        data-location={props.location ?? 'page'}
        className="inline-flex min-h-target items-center rounded-pill bg-brand px-6 font-bold text-on-brand transition-colors duration-200 hover:bg-brand-strong motion-reduce:transition-none"
      >
        {t('call.label')}
      </a>
      <span dir="ltr" className="font-bold text-ink">
        {phoneDisplay}
      </span>
      <p className="basis-full text-small text-ink-muted">{hoursLine}</p>
    </div>
  );
}
