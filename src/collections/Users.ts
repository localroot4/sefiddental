import type { Access, CollectionConfig } from 'payload';

import { hasRole, isAdmin, isAdminField, isStaff } from '../access/roles';
import { firstUserIsAdmin } from '../hooks/firstUserIsAdmin';
import { enforcePasswordPolicy } from '../hooks/passwordPolicy';
import { readEnv } from '../lib/env';

const adminOrSelf: Access = ({ req }) => {
  if (hasRole(req.user, 'admin')) return true;
  return req.user ? { id: { equals: req.user.id } } : false;
};

// Admins delete other accounts, never their own.
const deleteOthers: Access = ({ req }) =>
  req.user && hasRole(req.user, 'admin') ? { id: { not_equals: req.user.id } } : false;

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'کاربر', plural: 'کاربران' },
  admin: {
    group: 'سیستم',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'role', 'updatedAt'],
    hidden: ({ user }) => !hasRole(user, 'admin'),
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
    useSessions: true,
    cookies: { sameSite: 'Strict', secure: readEnv().nodeEnv === 'production' },
  },
  access: {
    admin: isStaff,
    create: isAdmin,
    read: adminOrSelf,
    update: adminOrSelf,
    delete: deleteOthers,
    // Default unlock access is any signed-in user; it also lifts TOTP code locks.
    unlock: isAdmin,
  },
  hooks: {
    beforeOperation: [enforcePasswordPolicy],
    beforeChange: [firstUserIsAdmin],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'نام',
      required: true,
      maxLength: 60,
      admin: { description: 'نام کامل، در سابقهٔ تغییرات و یادداشت‌ها دیده می‌شود.' },
    },
    {
      name: 'role',
      type: 'select',
      label: 'نقش',
      required: true,
      index: true,
      saveToJWT: true,
      defaultValue: 'editor',
      options: [
        { label: 'مدیر', value: 'admin' },
        { label: 'ویراستار پذیرش', value: 'editor' },
      ],
      // No self-promotion: only admins set or change roles.
      access: { create: isAdminField, update: isAdminField },
      admin: {
        description:
          'نقش کاربر. ویراستار فقط مقاله، نمونهٔ قبل و بعد، نظر بیماران و نوبت‌ها را می‌بیند.',
      },
    },
  ],
};
