import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { getLocale, t } from '@/i18n/fa';
import { Estedad, Vazirmatn } from '@/lib/fonts';
import { THEME_INIT_SCRIPT } from '@/lib/theme/themeInitScript';

/**
 * The public document (spec 5.2): `<html lang dir>`, the no-flash theme script with the
 * request nonce (its hash is in the CSP too), skip link, `.site` stacking wrapper (G20), one
 * header, one main (focus target of the skip link), one footer. Shared by the (site) root
 * layout and src/app/global-not-found.tsx, so the 404 for unmatched URLs is the same document.
 * `extras` renders after the wrapper (JSON-LD, the track listener).
 */
export function SiteShell(props: {
  nonce: string | undefined;
  children: ReactNode;
  extras?: ReactNode;
}) {
  const { lang, dir } = getLocale();
  return (
    <html
      lang={lang}
      dir={dir}
      className={`${Vazirmatn.variable} ${Estedad.variable}`}
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
          <SiteHeader />
          <main id="main" tabIndex={-1}>
            {props.children}
          </main>
          <SiteFooter />
        </div>
        {props.extras}
      </body>
    </html>
  );
}
