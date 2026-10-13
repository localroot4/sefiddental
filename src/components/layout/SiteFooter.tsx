import { CallBlock } from '@/components/layout/CallBlock';
import { CLINIC_FALLBACK, t } from '@/i18n/fa';

/** Jalali year in Persian digits for Asia/Tehran (a number only: no month or weekday names). */
function jalaliYear(now: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-arabext', {
    year: 'numeric',
    timeZone: 'Asia/Tehran',
  })
    .formatToParts(now)
    .filter((part) => part.type === 'year')
    .map((part) => part.value)
    .join('');
}

/**
 * Phase 3 footer (spec 5.2): the clinic name, the call block with the number in an LTR island
 * and the hours line, and the copyright with the Jalali year. Phase 4 adds the legal lines
 * (license, technical supervisor, address, privacy link) from the clinic global.
 */
export function SiteFooter(props: {
  name?: string;
  phoneE164?: string;
  phoneDisplay?: string;
  hoursLine?: string;
  now?: Date;
}) {
  return (
    <footer className="mt-auto border-t border-line bg-surface-sunken">
      <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-gutter py-12">
        <p className="font-display text-heading text-ink">{props.name ?? CLINIC_FALLBACK.name}</p>
        <CallBlock
          phoneE164={props.phoneE164}
          phoneDisplay={props.phoneDisplay}
          hoursLine={props.hoursLine}
          location="footer"
        />
        <p className="text-caption text-ink-muted">
          © {jalaliYear(props.now ?? new Date())} {t('footer.copyright')}
        </p>
      </div>
    </footer>
  );
}
