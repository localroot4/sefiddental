'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { setupBookingRoute } from './bookingRoute';
import { setupChoices } from './choices';
import { setupClosedSheet } from './closedSheet';
import { closeModals, setupDialogs } from './dialogs';
import { setupDrawer } from './drawer';
import { setupMegaMenu } from './megaMenu';
import { setupSkipLink } from './skipLink';
import { setupStickyBar } from './stickyBar';

/**
 * The one behavior island of the site chrome. Every element it drives is server HTML that works
 * without it (links, `tel:`, Popover API, Invoker Commands); it renders nothing and ships no
 * strings or icons. Re-attached after a client navigation, so the sticky bar observes the new
 * page's blocks; the drawer, the sheet and the mega menu close then. It also mirrors the page's
 * open modal and radio choices into attributes CSS reads instead of `:has()` (dialogs.ts,
 * choices.ts).
 */
export function ChromeScripts(): null {
  const pathname = usePathname();
  useEffect(() => {
    const cleanups = [
      setupDialogs(document),
      setupDrawer(document),
      setupMegaMenu(document),
      setupClosedSheet(document),
      setupStickyBar(document),
      setupBookingRoute(document),
      setupSkipLink(document),
      setupChoices(document),
    ];
    return () => {
      // A client navigation closes what the old page had open (the header logo is a next/link).
      closeModals(document);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname]);
  return null;
}
