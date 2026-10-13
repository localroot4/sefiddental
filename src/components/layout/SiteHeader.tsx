import Link from 'next/link';

import { BrandLogo } from '@/components/layout/BrandLogo';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { t } from '@/i18n/fa';

/**
 * Phase 3 header (spec 5.2): the logo at the start side (right in RTL) linking home, the theme
 * toggle at the end. Phase 4 adds the navigation, the phone island and «رزرو نوبت».
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-content items-center justify-between gap-4 px-gutter lg:h-nav">
        <Link href="/" className="inline-flex min-h-target items-center text-ink">
          <BrandLogo label={t('brand.homeLink')} className="h-8 w-auto" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
