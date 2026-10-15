import type { ReactNode } from 'react';

import { ButtonLink } from '@/components/ui/Button';
import type { EventLocation } from '@/lib/events/allowlist';

/**
 * «تماس با کلینیک» with the number in an LTR island and the hours line under it. The call goes
 * through the closed-hours sheet (`data-call-sheet`, C13). A primary action passed as children
 * comes first and the call becomes secondary (the 404: «رزرو نوبت» first, conversion.md 3).
 * Label, values and glyph come from the caller: the 404 passes live clinic data and a
 * server-rendered icon, the 500 boundary the static fallback and no glyph (it ships no icon
 * code, F2). No hooks, so the 500 boundary renders it too.
 */
export function CallBlock(props: {
  label: string;
  phoneE164: string;
  phoneDisplay: string;
  hoursLine: string | null;
  icon?: ReactNode;
  location?: EventLocation;
  children?: ReactNode;
}) {
  return (
    <div data-call-sheet="" className="flex flex-wrap items-center gap-x-4 gap-y-3">
      {props.children}
      <ButtonLink
        href={`tel:${props.phoneE164}`}
        variant={props.children ? 'secondary' : 'primary'}
        iconStart={props.icon}
        track={{ event: 'call_click', location: props.location ?? 'page' }}
      >
        {props.label}
      </ButtonLink>
      <span dir="ltr" className="font-semibold whitespace-nowrap text-ink">
        {props.phoneDisplay}
      </span>
      {props.hoursLine ? (
        <p className="basis-full text-small text-ink-muted">{props.hoursLine}</p>
      ) : null}
    </div>
  );
}
