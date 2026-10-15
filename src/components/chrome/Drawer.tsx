import Link from 'next/link';

import { BrandLogo } from '@/components/layout/BrandLogo';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cx } from '@/components/ui/cx';
import { t } from '@/i18n/fa';
import type { NavTree } from '@/lib/data/catalog';
import type { FooterData } from '@/lib/data/footer';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';

import { DRAWER_ID } from './ids';
import { pageLink, type ChromeLink } from './links';
import { SocialLinks } from './social';
import { ThemeButton } from './ThemeButton';

// Invoker Commands: React 19.3 has no prop for them, so they pass as plain attributes.
export const OPEN_DRAWER = { command: 'show-modal', commandfor: DRAWER_ID } as const;
const CLOSE_DRAWER = { command: 'close', commandfor: DRAWER_ID } as const;

// 48 px rows with a hairline (DESIGN.md 3.7); sub rows are indented, smaller, without one.
const ROW =
  'flex min-h-12 items-center gap-2 border-b border-line px-2 text-ink transition-colors hover:bg-brand-soft';
const SUB_ROW =
  'flex min-h-12 items-center ps-6 pe-2 text-small text-ink transition-colors hover:bg-brand-soft';

function Rows(props: { links: ChromeLink[] }) {
  return (
    <ul className="mt-6">
      {props.links.map((link) => (
        <li key={link.href}>
          <a href={link.href} className={ROW}>
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * The phone drawer (nav spec 1.4): a full-screen modal <dialog> the menu button opens with
 * Invoker Commands (ChromeScripts covers browsers without them, focus, Tab wrap and focus
 * return). Order: booking and call, the service groups as <details>, the decision pages, the
 * information pages, the emergency link, then the theme toggle and the socials.
 */
export function Drawer(props: { nav: NavTree; contact: FooterData }) {
  const { nav, contact } = props;
  return (
    <dialog
      id={DRAWER_ID}
      aria-label={t('nav.drawer')}
      className="m-0 h-[100dvh] max-h-none w-full max-w-none overflow-hidden bg-surface p-0 text-ink opacity-0 transition-[opacity,display,overlay] transition-discrete backdrop:bg-backdrop open:opacity-100 starting:open:opacity-0 lg:hidden"
    >
      <div className="flex h-16 items-center justify-between gap-3 border-b border-line px-gutter">
        <Link href="/" prefetch={false} className="inline-flex min-h-target items-center text-ink">
          <BrandLogo label={t('brand.homeLink')} className="h-8 w-auto" />
        </Link>
        <IconButton
          label={t('nav.menuClose')}
          icon={<Icon name="close" />}
          // Focus target of showModal() (nav spec 1.4), with or without the script.
          autoFocus
          {...CLOSE_DRAWER}
        />
      </div>
      <nav
        aria-label={t('nav.primary')}
        className="h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain px-gutter pt-4 pb-12"
      >
        <div data-call-sheet="" className="grid grid-cols-2 gap-3">
          <ButtonLink
            href={PAGE_PATHS.booking}
            size="lg"
            fullWidth
            data-booking-cta=""
            track={{ event: 'booking_open', location: 'drawer' }}
          >
            {t('nav.book')}
          </ButtonLink>
          <ButtonLink
            href={telHref(contact.phones.landline)}
            variant="secondary"
            size="lg"
            fullWidth
            track={{ event: 'call_click', location: 'drawer' }}
          >
            {t('call.label')}
          </ButtonLink>
        </div>
        <ul className="mt-6">
          {nav.groups.map((group) =>
            group.items.length > 0 ? (
              <li key={group.key}>
                <details className="group border-b border-line">
                  <summary
                    className={cx(
                      ROW,
                      'cursor-pointer list-none justify-between border-b-0 font-semibold [&::-webkit-details-marker]:hidden',
                    )}
                  >
                    {group.label}
                    <Icon
                      name="caret-down"
                      className="text-brand transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <ul className="pb-2">
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <a href={item.path} className={SUB_ROW}>
                          {item.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            ) : (
              // Database down: the category page itself (NAV_FALLBACK has no services).
              <li key={group.key}>
                <a href={group.path} className={cx(ROW, 'font-semibold')}>
                  {group.label}
                </a>
              </li>
            ),
          )}
          {[
            ...nav.others.map((item) => ({ href: item.path, label: item.label })),
            pageLink('services-hub'),
          ].map((link) => (
            <li key={link.href}>
              <a href={link.href} className={ROW}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <Rows links={[pageLink('dentists-hub'), pageLink('cases'), pageLink('pricing')]} />
        <Rows
          links={[
            pageLink('guide-hub'),
            pageLink('articles'),
            pageLink('about'),
            pageLink('address'),
          ]}
        />
        <a
          href={PAGE_PATHS.emergency}
          className={cx(ROW, 'mt-6 border-b-0 font-semibold text-warning')}
        >
          <Icon name="warning" size="sm" />
          {t('urgent.label')}
        </a>
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <ThemeButton location="drawer" />
          <SocialLinks social={contact.social} whatsapp={contact.whatsapp} location="drawer" />
        </div>
      </nav>
    </dialog>
  );
}
