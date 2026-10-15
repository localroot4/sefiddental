import type { ReactNode } from 'react';

import { t } from '@/i18n/fa';
import type { EventLocation } from '@/lib/events/allowlist';
import { formatPhoneFa, telHref } from '@/lib/phone';
import type { Clinic } from '@/payload-types';

import type { Track } from './Button';
import { cx } from './cx';
import { Icon } from './Icon';

/**
 * A phone number as an LTR island in Persian digits («۰۲۱ ۵۵۱۰ ۱۰۵۴»). As a link it dials E.164;
 * `standalone` gives it the 44 px hit area. The closed-hours sheet is the caller's island.
 */
export function PhoneNumber(props: {
  e164: string;
  link?: boolean;
  standalone?: boolean;
  track?: Track;
  className?: string;
}) {
  const text = formatPhoneFa(props.e164);
  if (!props.link) {
    return (
      <span dir="ltr" className={cx('font-semibold whitespace-nowrap', props.className)}>
        {text}
      </span>
    );
  }
  return (
    <a
      href={telHref(props.e164)}
      dir="ltr"
      data-track={props.track?.event}
      data-location={props.track?.location}
      className={cx(
        'font-semibold whitespace-nowrap text-ink transition-colors hover:text-brand-strong',
        props.standalone && 'inline-flex min-h-target items-center px-2',
        props.className,
      )}
    >
      {text}
    </a>
  );
}

type Maps = NonNullable<Clinic['maps']>;

const APPS = [
  ['googleMapsUrl', 'ui.directions.google'],
  ['neshanUrl', 'ui.directions.neshan'],
  ['baladUrl', 'ui.directions.balad'],
  ['wazeUrl', 'ui.directions.waze'],
] as const;

/**
 * «مسیریابی» with the deep links the clinic filled in (brief decision 12: no map script, no
 * third-party request). Hidden when no link exists.
 */
export function DirectionsLinks(props: {
  maps: Maps | null | undefined;
  location?: EventLocation;
  className?: string;
}) {
  const links = APPS.flatMap(([field, key]) => {
    const href = props.maps?.[field];
    return href ? [{ href, label: t(key) }] : [];
  });
  if (links.length === 0) return null;
  return (
    <div className={cx('flex flex-wrap items-center gap-x-1 gap-y-0', props.className)}>
      <p className="me-2 inline-flex items-center gap-2 text-small font-semibold">
        <Icon name="navigation" size="sm" className="text-brand" />
        {t('ui.directions.label')}:
      </p>
      <ul className="flex flex-wrap gap-x-1">
        {links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              rel="noopener"
              data-track="directions_click"
              data-location={props.location ?? 'page'}
              className="inline-flex min-h-target items-center rounded-pill px-3 text-small font-medium text-brand-strong transition-colors hover:bg-brand-soft"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Map block (DESIGN.md 3.29): the self-hosted static map image (a Picture or a placeholder from
 * the caller) in a 24 px radius frame, then the directions links.
 */
export function MapBlock(props: {
  image: ReactNode;
  maps: Maps | null | undefined;
  location?: EventLocation;
  className?: string;
}) {
  return (
    <div className={cx('grid content-start gap-3', props.className)}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-media bg-surface-sunken">
        {props.image}
      </div>
      <DirectionsLinks maps={props.maps} location={props.location} />
    </div>
  );
}
