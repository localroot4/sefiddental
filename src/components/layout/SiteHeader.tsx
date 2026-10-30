import Link from 'next/link';

import { Drawer, OPEN_DRAWER } from '@/components/chrome/Drawer';
import { DRAWER_ID } from '@/components/chrome/ids';
import { pageLink } from '@/components/chrome/links';
import { MegaMenu, NAV_ITEM } from '@/components/chrome/MegaMenu';
import { NavLink } from '@/components/chrome/NavLink';
import { ThemeButton } from '@/components/chrome/ThemeButton';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { ButtonLink, IconButton } from '@/components/ui/Button';
import { PhoneNumber } from '@/components/ui/Contact';
import { Icon } from '@/components/ui/Icon';
import { t } from '@/i18n/fa';
import type { NavTree } from '@/lib/data/catalog';
import type { FooterData } from '@/lib/data/footer';
import { PAGE_PATHS } from '@/lib/paths';
import { telHref } from '@/lib/phone';

/**
 * The site header (nav spec 1.1, DESIGN.md 3.5): sticky, 64 px plus a hairline under 1024 px and
 * 72 px with it from 1024 px (the home hero's `100svh - 65px` depends on these numbers). Phones:
 * logo, call icon, menu button. From 1024 px: logo, the four items on one line, theme toggle, the
 * call icon (the number from 1280 px), «رزرو نوبت». Every call control passes the closed-hours
 * sheet (`data-call-sheet`). The drawer dialog follows the header, outside the banner landmark.
 */
export function SiteHeader(props: { nav: NavTree; contact: FooterData }) {
  const phone = props.contact.phones.landline;
  // The dentists hub is linked only once a dentist is published (JURY 4, decision 1a).
  const links = [
    ...(props.contact.hubs.dentists ? [pageLink('dentists-hub')] : []),
    pageLink('pricing'),
    pageLink('address'),
  ];
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface-raised/88 backdrop-blur-[12px]">
        <div className="mx-auto flex h-16 w-full max-w-content items-center gap-3 px-gutter lg:h-[calc(var(--nav-h)-1px)]">
          <Link
            href="/"
            prefetch={false}
            className="inline-flex min-h-target shrink-0 items-center text-ink lg:me-2"
          >
            <BrandLogo label={t('brand.homeLink')} className="h-8 w-auto" />
          </Link>
          <nav aria-label={t('nav.primary')} className="max-lg:hidden">
            <ul className="flex items-center gap-1">
              <MegaMenu
                nav={props.nav}
                hubs={{
                  guides: props.contact.guides.length > 0,
                  articles: props.contact.hubs.articles,
                }}
              />
              {links.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href} className={NAV_ITEM}>
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div data-call-sheet="" className="ms-auto flex shrink-0 items-center gap-2">
            <div className="max-lg:hidden">
              <ThemeButton location="header" />
            </div>
            <PhoneNumber
              e164={phone}
              link
              standalone
              track={{ event: 'call_click', location: 'header' }}
              className="text-small max-xl:hidden"
            />
            <IconButton
              href={telHref(phone)}
              label={t('call.label')}
              icon={<Icon name="phone" />}
              track={{ event: 'call_click', location: 'header' }}
              className="xl:hidden"
            />
            <ButtonLink
              href={PAGE_PATHS.booking}
              size="lg"
              data-booking-cta=""
              track={{ event: 'booking_open', location: 'header' }}
              className="max-lg:hidden"
            >
              {t('nav.book')}
            </ButtonLink>
            <IconButton
              label={t('nav.menuOpen')}
              icon={<Icon name="menu" />}
              aria-controls={DRAWER_ID}
              aria-expanded="false"
              className="lg:hidden"
              {...OPEN_DRAWER}
            />
          </div>
        </div>
      </header>
      <Drawer nav={props.nav} contact={props.contact} />
    </>
  );
}
