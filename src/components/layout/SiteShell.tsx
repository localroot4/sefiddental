import type { ReactNode } from 'react';

import { ChromeScripts } from '@/components/chrome/ChromeScripts';
import { ClosedSheet } from '@/components/chrome/ClosedSheet';
import { StickyBarGate } from '@/components/chrome/NavLink';
import { StickyBar } from '@/components/chrome/StickyBar';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { getLocale, t } from '@/i18n/fa';
import { getNavTree } from '@/lib/data/catalog';
import { getFooterData } from '@/lib/data/footer';
import { Estedad, Vazirmatn } from '@/lib/fonts';
import { PAGE_PATHS } from '@/lib/paths';
import { THEME_INIT_SCRIPT } from '@/lib/theme/themeInitScript';

// Templates the sticky bar never covers (conversion.md 4).
const NO_STICKY_BAR = [PAGE_PATHS.booking, PAGE_PATHS['booking-success'], PAGE_PATHS.emergency];

/**
 * The public document (spec 5.2): `<html lang dir>`, the no-flash theme script with the
 * request nonce (its hash is in the CSP too), skip link, `.site` stacking wrapper (G20), one
 * header, one main (focus target of the skip link), one footer, the sticky bar, the closed-hours
 * sheet and the chrome's behavior island. Shared by the (site) root layout and
 * src/app/global-not-found.tsx, so the 404 for unmatched URLs is the same document. The chrome
 * readers answer static fallbacks when the database is down (CC-7). Under 1024 px the scroll
 * padding keeps focused fields and anchors clear of the sticky bar, and an open modal stops the
 * page behind it from scrolling, except the home intro `#intro` (phase 7, C17): the page is at
 * the top and inert under it, and taking the scrollbar away would shift it 15 px. The open modal
 * reaches CSS as `data-modal` (ChromeScripts, dialogs.ts); without JavaScript a `:has()` rule
 * under `noscript:` does it (scripts/check-has.mjs). `extras` renders after the wrapper (JSON-LD,
 * the track listener).
 */
export async function SiteShell(props: {
  nonce: string | undefined;
  children: ReactNode;
  extras?: ReactNode;
}) {
  const { lang, dir } = getLocale();
  const [nav, contact] = await Promise.all([getNavTree(), getFooterData()]);
  return (
    <html
      lang={lang}
      dir={dir}
      className={`${Vazirmatn.variable} ${Estedad.variable} max-lg:scroll-pbe-[calc(var(--sticky-bar-h)+env(safe-area-inset-bottom)+var(--space-2))] max-lg:data-modal:overflow-hidden noscript:max-lg:has-[dialog:modal:not(#intro)]:overflow-hidden`}
      suppressHydrationWarning
    >
      {/* The root document of the App Router (rendered by root layouts): next/head is Pages Router only. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script
          nonce={props.nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          {t('skip.toMain')}
        </a>
        <div className="site flex min-h-[100dvh] flex-col">
          <SiteHeader nav={nav} contact={contact} />
          <main id="main">{props.children}</main>
          <SiteFooter contact={contact} />
          <StickyBarGate hiddenOn={NO_STICKY_BAR}>
            <StickyBar phone={contact.phones.landline} whatsapp={contact.whatsapp} />
          </StickyBarGate>
        </div>
        <ClosedSheet phone={contact.phones.landline} />
        <ChromeScripts />
        {props.extras}
      </body>
    </html>
  );
}
