import Link from 'next/link';
import type { ServerProps } from 'payload';

import { hasRole } from '@/access/roles';
import { ADMIN_ROUTE } from '@/lib/paths';

/**
 * `admin.components.afterNavLinks`: the link to the system status view, for admins only (the view
 * itself refuses everyone else). Payload's own nav classes, so it looks like the other links.
 */
export function SystemStatusNavLink({ user }: ServerProps) {
  if (!hasRole(user, 'admin')) return null;
  return (
    <Link
      className="nav__link"
      href={`${ADMIN_ROUTE}/system-status`}
      id="nav-system-status"
      prefetch={false}
    >
      <span className="nav__link-label">وضعیت سیستم</span>
    </Link>
  );
}
