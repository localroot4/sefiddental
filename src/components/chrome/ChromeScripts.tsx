'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { setupBookingRoute } from './bookingRoute';
import { setupClosedSheet } from './closedSheet';
import { closeModals, setupDialogs } from './dialogs';
import { setupDrawer } from './drawer';
import { setupMegaMenu } from './megaMenu';
import { setupStickyBar } from './stickyBar';

/**
 * The one behavior island of the site chrome. Every element it drives is server HTML that works
 * without it (links, `tel:`, Popover API, Invoker Commands); it renders nothing and ships no
 * strings or icons. Re-attached after a client navigation, so the sticky bar observes the new
 * page's blocks; the drawer, the sheet and the mega menu close then.
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
    ];
    return () => {
      // A client navigation closes what the old page had open (the logo is a next/link).
      closeModals(document);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [pathname]);
  return null;
}
