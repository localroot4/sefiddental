import type { Access, FieldAccess, PayloadRequest } from 'payload';

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
/** @public Frozen signature; consumed in wave 2. */
export const isEditor = ({ req }: { req: PayloadRequest }): boolean => hasRole(req.user, 'editor');
export const isAdminField: FieldAccess = ({ req }) => hasRole(req.user, 'admin');
export const isStaffField: FieldAccess = ({ req }) => hasRole(req.user, 'admin', 'editor');

/**
 * Delete access: admins delete (trash and permanent), editors only move to the trash. Payload
 * passes `data.deletedAt` for a trash attempt and no data for a permanent delete (spec-data P22).
 */
export const trashOnlyForEditors: Access = ({ req, data }) =>
  hasRole(req.user, 'admin') ||
  (hasRole(req.user, 'editor') &&
    Boolean((data as { deletedAt?: unknown } | undefined)?.deletedAt));

/** `admin.hidden`: only admins see the entity in the navigation (UI only, spec-data P20). */
export const hiddenForEditors = ({ user }: { user: object | null | undefined }): boolean =>
  !hasRole(user, 'admin');
