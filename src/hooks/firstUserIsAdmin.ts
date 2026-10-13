import type { CollectionBeforeChangeHook } from 'payload';

/** The first account is always an admin, so the first-user screen never locks the panel out. */
export const firstUserIsAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data;
  const { totalDocs } = await req.payload.count({ collection: 'users', req });
  return totalDocs === 0 ? { ...data, role: 'admin' } : data;
};
