import type { FieldAccess, PayloadRequest } from 'payload';

export type Role = 'admin' | 'editor';

/** Accepts the request user and the admin's client user (`admin.hidden` receives the latter). */
export function hasRole(user: object | null | undefined, ...roles: Role[]): boolean {
  const role = user ? (user as { role?: unknown }).role : undefined;
  return typeof role === 'string' && (roles as string[]).includes(role);
}

// Boolean-only helpers: usable for `access.admin`, which must return a boolean.
export const isAdmin = ({ req }: { req: PayloadRequest }): boolean => hasRole(req.user, 'admin');
export const isStaff = ({ req }: { req: PayloadRequest }): boolean =>
  hasRole(req.user, 'admin', 'editor');
export const isEditor = ({ req }: { req: PayloadRequest }): boolean => hasRole(req.user, 'editor');
export const isAdminField: FieldAccess = ({ req }) => hasRole(req.user, 'admin');
