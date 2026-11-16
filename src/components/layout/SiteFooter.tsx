import type { ReactNode } from 'react';

import { pageLink, type ChromeLink } from '@/components/chrome/links';
import { SocialLinks } from '@/components/chrome/social';
import { BrandLogo, FOOTER_LOGO_CLASS, FooterEmblem } from '@/components/layout/BrandLogo';
import { DirectionsLinks, PhoneNumber } from '@/components/ui/Contact';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';
import type { FooterData, MapProvider } from '@/lib/data/footer';

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

// DirectionsLinks reads the clinic global's field names.
const MAP_FIELD = {
  google: 'googleMapsUrl',
  neshan: 'neshanUrl',
  balad: 'baladUrl',
  waze: 'wazeUrl',
} as const satisfies Record<MapProvider, string>;

const LINK =
  '-mx-2 inline-flex min-h-target items-center px-2 text-small text-ink transition-colors hover:text-brand-strong';

function Group(props: { title: string; links: (ChromeLink & { urgent?: boolean })[] }) {
  return (
    // From 744 px the content shows whether or not the <details> is open; where the browser has
    // no ::details-content the summary stays and the group works as a disclosure (Q-16).
    <details className="group border-b border-line md:border-0 md:supports-[selector(::details-content)]:details-content:[content-visibility:visible]">
      <summary
        className={cx(
          'flex min-h-target cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink [&::-webkit-details-marker]:hidden',
          'md:supports-[selector(::details-content)]:hidden',
        )}
      >
        {props.title}
        <Icon name="caret-down" className="text-brand transition-transform group-open:rotate-180" />
      </summary>
      <h2 className="hidden min-h-target items-center font-semibold text-ink md:supports-[selector(::details-content)]:flex">
        {props.title}
      </h2>
      <ul className="grid pb-3 md:pb-0">
        {props.links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className={
                link.urgent
                  ? '-mx-2 inline-flex min-h-target items-center px-2 text-small font-semibold text-warning hover:underline'
                  : LINK
              }
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Line(props: { icon: 'map-pin' | 'phone' | 'clock'; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-small text-ink">
      <Icon name={props.icon} size="sm" className="mt-[.2rem] text-brand" />
      <span>{props.children}</span>
    </p>
  );
}

/**
 * The static footer (docs/ia.md 3, DESIGN.md 3.30, F25): the contact block (always open; its
 * entering view hides the sticky bar), then «خدمات پرطرفدار», «کلینیک» and «راهنما» as
 * disclosures on phones and open columns from 744 px, then socials, legal lines once provided
 * and the copyright. Every value comes from FooterData; with the database down it is the fallback.
 * The phones here are NAP: they dial without the closed-hours sheet (C13). Dark in both themes
 * (`data-theme="dark"` scopes the dark tokens). The large logo opens the brand column on every
 * page; on home the playground's parts lie over it (PlaygroundSection), so the two are one.
 */
export function SiteFooter(props: { contact: FooterData; now?: Date }) {
  const { contact } = props;
  const firstVisit = contact.guides.find((guide) => guide.key === 'guide-first-visit');
  const hours = contact.hours ?? contact.hoursNote; // R3: the note only for an irregular week
  const maps = Object.fromEntries(contact.maps.map((m) => [MAP_FIELD[m.provider], m.url]));
  const { licenseNumber, technicalSupervisor } = contact.legal;
  return (
    // One dark section in both themes (docs/experience/footer.md): the dark tokens apply inside it.
    <footer
      data-theme="dark"
      className="relative isolate mt-auto overflow-clip bg-surface-sunken text-ink"
    >
      {/* The emblem (owner 2026-11-16: a background that shows the brand): the mark drawn as one
          fine line, monumental, standing on the footer's floor at its inline-end corner and
          fading out upward (globals.css .footer-emblem). Under the content: the footer isolates
          its layers. */}
      <FooterEmblem className="footer-emblem pointer-events-none absolute end-[2%] -bottom-12 -z-10 h-[18rem] w-auto md:-bottom-16 md:h-[28rem] lg:end-[1%]" />
      {/* pb-16: a thrown mark (59 px) rests on the floor below the last link row, not over it. */}
      <div className="mx-auto grid w-full max-w-content gap-6 px-gutter pt-12 pb-16 md:grid-cols-3 md:gap-8 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div data-sticky-hide="" className="grid content-start gap-3 md:col-span-3 lg:col-span-1">
          {/* The footer's anchor on every page; on home the playground's parts lie over it. */}
          <div data-footer-logo="" className="mb-3 justify-self-start">
            <BrandLogo label={contact.name} className={cx('block text-ink', FOOTER_LOGO_CLASS)} />
          </div>
          {contact.line ? <p className="text-small text-ink-muted">{contact.line}</p> : null}
          {contact.address ? <Line icon="map-pin">{contact.address}</Line> : null}
          {contact.phones.landline || contact.phones.mobile ? (
            <Line icon="phone">
              <span className="flex flex-wrap gap-x-4">
                {[contact.phones.landline, contact.phones.mobile].map((phone) =>
                  phone ? (
                    <PhoneNumber
                      key={phone}
                      e164={phone}
                      link
                      standalone
                      track={{ event: 'call_click', location: 'footer' }}
                      className="-mx-2 text-small"
                    />
                  ) : null,
                )}
              </span>
            </Line>
          ) : null}
          {hours ? <Line icon="clock">{hours}</Line> : null}
          <DirectionsLinks maps={maps} location="footer" />
        </div>
        <Group
          title={t('nav.footerPopular')}
          links={[
            ...contact.popular.map((service) => ({ href: service.path, label: service.label })),
            pageLink('services-hub'),
          ]}
        />
        <Group
          title={t('nav.footerClinic')}
          links={[
            pageLink('dentists-hub'),
            pageLink('pricing'),
            pageLink('about'),
            pageLink('address'),
          ]}
        />
        <Group
          title={t('nav.footerGuide')}
          links={[
            pageLink('guide-hub'),
            ...(firstVisit ? [pageLink('guide-first-visit', firstVisit.path)] : []),
            pageLink('articles'),
            { ...pageLink('emergency'), urgent: true },
            pageLink('privacy'),
          ]}
        />
      </div>
      {/* The footer's floor (globals.css): a fine lit horizon; the playground's parts land on it. */}
      <div data-footer-floor="" className="footer-floor relative">
        <div className="mx-auto flex w-full max-w-content flex-col gap-3 px-gutter py-6 text-caption text-ink-muted md:grid md:grid-cols-[auto_1fr_auto] md:items-center md:gap-6">
          <div className="flex flex-wrap items-center gap-1 empty:hidden">
            <SocialLinks social={contact.social} whatsapp={contact.whatsapp} location="footer" />
          </div>
          <p className="flex flex-wrap gap-x-4 empty:hidden md:col-start-2">
            {licenseNumber ? (
              <span>
                {t('nav.footerLicense')} <span dir="ltr">{licenseNumber}</span>
              </span>
            ) : null}
            {technicalSupervisor ? (
              <span>
                {t('nav.footerSupervisor')} {technicalSupervisor}
              </span>
            ) : null}
          </p>
          <p className="md:col-start-3">
            © {jalaliYear(props.now ?? new Date())} {contact.name}
          </p>
        </div>
      </div>
    </footer>
  );
}
