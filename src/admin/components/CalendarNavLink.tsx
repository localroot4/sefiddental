import Link from 'next/link';
import type { ServerProps } from 'payload';

import { hasRole } from '@/access/roles';
import { CALENDAR_PATH } from '@/admin/calendar';
import { adminText } from '@/i18n/fa-admin';

/**
 * `admin.components.afterNavLinks`: the editorial calendar for staff, after the groups (C12: the
 * config cannot place a link inside «محتوا»). The view itself checks the TOTP session.
 */
export function CalendarNavLink({ user }: ServerProps) {
  if (!hasRole(user, 'admin', 'editor')) return null;
  return (
    <Link className="nav__link" href={CALENDAR_PATH} id="nav-content-calendar" prefetch={false}>
      <span className="nav__link-label">{adminText('admin.calendar.title')}</span>
    </Link>
  );
}
