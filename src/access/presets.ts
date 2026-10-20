import type { CollectionConfig } from 'payload';

import { isAdmin, isStaff, trashOnlyForEditors } from './roles';
import { SERVER_USER_UPDATE, totpUnlessServerUser } from './totp';

/**
 * The access rows of spec-data 5.1 with the TOTP consequences (freeze decisions 9, 26, 27):
 * no anonymous REST read anywhere (the site reads through the Local API); collections with
 * scheduled publish let Payload's job update as the scheduling user.
 */
type Access = NonNullable<CollectionConfig['access']>;
type Preset = { access: Access; custom?: CollectionConfig['custom'] };

const withSchedule = (access: Access, scheduled: boolean): Preset =>
  scheduled
    ? {
        access: { ...access, update: totpUnlessServerUser(access.update ?? isAdmin) },
        custom: SERVER_USER_UPDATE,
      }
    : { access };

/** Taxonomy: editors read (relationship pickers), admins write; `tags` also editor-writable. */
export function taxonomyAccess(
  options: { scheduled?: boolean; editorsWrite?: boolean } = {},
): Preset {
  const write = options.editorsWrite ? isStaff : isAdmin;
  return withSchedule(
    { read: isStaff, create: write, update: write, delete: isAdmin, readVersions: isAdmin },
    Boolean(options.scheduled),
  );
}

/** Editorial: editors create, publish and schedule; they only move documents to the trash. */
export function editorialAccess(options: { scheduled?: boolean } = {}): Preset {
  return withSchedule(
    {
      read: isStaff,
      create: isStaff,
      update: isStaff,
      delete: trashOnlyForEditors,
      readVersions: isStaff,
    },
    Boolean(options.scheduled),
  );
}

/** Admin only (pages, redirects); `editorsRead` lets editors read, never write (H7: pages). */
export function adminAccess(options: { scheduled?: boolean; editorsRead?: boolean } = {}): Preset {
  return withSchedule(
    {
      read: options.editorsRead ? isStaff : isAdmin,
      create: isAdmin,
      update: isAdmin,
      delete: isAdmin,
      readVersions: isAdmin,
    },
    Boolean(options.scheduled),
  );
}

/** System logs: admins read, nobody writes through the API (hooks use the Local API). */
export const readOnlyForAdmins: Access = {
  read: isAdmin,
  create: () => false,
  update: () => false,
  delete: () => false,
};
