import type { CollectionSlug, GlobalSlug, Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { allowed, getTestPayload, type StaffUser, staffUsers, unique } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

// spec-data 5.1 with the TOTP consequences (freeze decisions 9, 26-28).
const COLLECTIONS: CollectionSlug[] = [
  'service-categories',
  'services',
  'service-tiers',
  'doctors',
  'articles',
  'article-categories',
  'tags',
  'pages',
  'testimonials',
  'cases',
  'insurances',
  'financing-options',
  'bookings',
  'media',
  'redirects',
  'events-daily',
  'audit-log',
  'users',
];
const EDITOR_READS: CollectionSlug[] = [
  'service-categories',
  'services',
  'service-tiers',
  'doctors',
  'articles',
  'article-categories',
  'tags',
  // H7: the link drawer lists the guides; pages stay out of the editor's navigation.
  'pages',
  'testimonials',
  'cases',
  'insurances',
  'financing-options',
  'bookings',
  'media',
  'users',
];
const GLOBALS: GlobalSlug[] = ['clinic', 'seo-defaults', 'features', 'notifier', 'system-state'];

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;

const read = (collection: CollectionSlug, user?: StaffUser) => () =>
  payload.find({
    collection,
    limit: 1,
    depth: 0,
    overrideAccess: false,
    ...(user ? { user } : {}),
  });

describe('access matrix', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
  });

  it('AC1 anonymous reads are denied on every collection and global (the site uses the Local API)', async () => {
    for (const collection of COLLECTIONS)
      expect(await allowed(read(collection)), collection).toBe(false);
    for (const slug of GLOBALS) {
      expect(await allowed(() => payload.findGlobal({ slug, overrideAccess: false })), slug).toBe(
        false,
      );
    }
  });

  it('AC2 editors read their collections, the pickers and pages; never redirects or system logs', async () => {
    for (const collection of COLLECTIONS) {
      expect(await allowed(read(collection, editor)), collection).toBe(
        EDITOR_READS.includes(collection),
      );
    }
    const users = await payload.find({
      collection: 'users',
      overrideAccess: false,
      user: editor,
      depth: 0,
    });
    expect(users.docs.map((u) => u.id)).toEqual([editor.id]);
  });

  it('AC3 editors cannot reach any global; admins can', async () => {
    for (const slug of GLOBALS) {
      expect(
        await allowed(() => payload.findGlobal({ slug, overrideAccess: false, user: editor })),
        slug,
      ).toBe(false);
      expect(
        await allowed(() => payload.findGlobal({ slug, overrideAccess: false, user: admin })),
        slug,
      ).toBe(true);
    }
    expect(
      await allowed(() =>
        payload.updateGlobal({ slug: 'features', data: {}, overrideAccess: false, user: editor }),
      ),
    ).toBe(false);
  });

  it('AC4 editors write editorial content and tags, not taxonomy or redirects', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    expect(
      await allowed(() =>
        payload.create({
          collection: 'articles',
          data: { title: `مقالهٔ آزمون ${unique()}` },
          draft: true,
          ...asEditor,
        }),
      ),
    ).toBe(true);
    expect(
      await allowed(() =>
        // Hook-filled and default fields (slug, statusCode) are left out on purpose.
        payload.create({
          collection: 'tags',
          data: { title: `برچسب ${unique()}` } as never,
          ...asEditor,
        }),
      ),
    ).toBe(true);
    expect(
      await allowed(() =>
        payload.create({
          collection: 'service-categories',
          data: { key: `k-${unique()}`, title: 'x' },
          draft: true,
          ...asEditor,
        }),
      ),
    ).toBe(false);
    expect(
      await allowed(() =>
        payload.create({
          collection: 'redirects',
          data: { from: `/t-${unique()}`, to: '/' } as never,
          ...asEditor,
        }),
      ),
    ).toBe(false);
  });

  it('AC5 editors move articles to the trash but never delete them; admins do', async () => {
    const article = await payload.create({
      collection: 'articles',
      data: { title: `مقاله ${unique()}` },
      draft: true,
    });
    const asEditor = { overrideAccess: false, user: editor } as const;
    expect(
      await allowed(() => payload.delete({ collection: 'articles', id: article.id, ...asEditor })),
    ).toBe(false);
    expect(
      await allowed(() =>
        payload.update({
          collection: 'articles',
          id: article.id,
          data: { deletedAt: new Date().toISOString() },
          ...asEditor,
        }),
      ),
    ).toBe(true);
    expect(
      await allowed(() =>
        payload.delete({
          collection: 'articles',
          id: article.id,
          trash: true,
          overrideAccess: false,
          user: admin,
        }),
      ),
    ).toBe(true);
  });

  it('AC6 a role change needs an admin; an editor cannot promote itself', async () => {
    const updated = await payload.update({
      collection: 'users',
      id: editor.id,
      data: { role: 'admin' },
      overrideAccess: false,
      user: editor,
    });
    expect(updated.role).toBe('editor');
  });

  it('AC7 editors read pages but never create, change or delete one (H7)', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    const page = (await payload.find({ collection: 'pages', limit: 1, depth: 0, ...asEditor }))
      .docs[0];
    expect(
      await allowed(() =>
        payload.create({
          collection: 'pages',
          data: { key: 'privacy', title: 'x' } as never,
          draft: true,
          ...asEditor,
        }),
      ),
    ).toBe(false);
    if (page) {
      expect(
        await allowed(() =>
          payload.update({
            collection: 'pages',
            id: page.id,
            data: { title: 'تغییر ویراستار' },
            draft: true,
            ...asEditor,
          }),
        ),
      ).toBe(false);
      expect(
        await allowed(() => payload.delete({ collection: 'pages', id: page.id, ...asEditor })),
      ).toBe(false);
    }
  });
});
