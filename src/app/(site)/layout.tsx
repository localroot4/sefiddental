import '../globals.css';

import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';

import { Estedad, Vazirmatn } from '@/lib/fonts';
import { THEME_INIT_SCRIPT } from '@/lib/theme/themeInitScript';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  // Equal to --color-surface in design/tokens.css, light and dark.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F8F7' },
    { media: '(prefers-color-scheme: dark)', color: '#071A2B' },
  ],
};

// Interim metadata; the platform lane replaces it with buildSiteMetadata().
export const metadata: Metadata = {
  title: 'کلینیک دندانپزشکی سفید',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-32.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
};

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers renders every public page per request (CSP nonce from the proxy).
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${Vazirmatn.variable} ${Estedad.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          پرش به محتوای اصلی
        </a>
        <div className="site">
          <main id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
