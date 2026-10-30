import { randomBytes, randomInt } from 'node:crypto';

import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { canRunJobs } from '@/access/jobs';
import { POST } from '@/app/(payload)/api/[...slug]/route';
import { readEnv } from '@/lib/env';

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

  // Phase 9 security audit (docs/qa/audit-security.md, section 3): the cells the rows above left out.
  it('AC8 anonymous callers never create, change or delete anything', async () => {
    const anyRow = { id: { exists: true } };
    for (const collection of COLLECTIONS) {
      // A media create without a file is refused for that first (400, UP-4); MS5 covers uploads.
      if (collection !== 'media') {
        expect(
          await allowed(() =>
            payload.create({ collection, data: {} as never, overrideAccess: false }),
          ),
          `create ${collection}`,
        ).toBe(false);
      }
      expect(
        await allowed(() =>
          payload.update({ collection, where: anyRow, data: {}, overrideAccess: false }),
        ),
        `update ${collection}`,
      ).toBe(false);
      expect(
        await allowed(() => payload.delete({ collection, where: anyRow, overrideAccess: false })),
        `delete ${collection}`,
      ).toBe(false);
    }
    for (const slug of GLOBALS) {
      expect(
        await allowed(() => payload.updateGlobal({ slug, data: {}, overrideAccess: false })),
        slug,
      ).toBe(false);
    }
  });

  it('AC9 system stores: nobody writes through the API; only admins read the logs', async () => {
    const STORES: Array<[CollectionSlug, boolean]> = [
      ['events-daily', true],
      ['sms-throttle', true],
      ['audit-log', true],
      ['payload-jobs', false],
      ['payload-kv', false],
      ['totp-attempts', false],
    ];
    for (const [collection, adminReads] of STORES) {
      for (const user of [editor, admin]) {
        expect(await allowed(read(collection, user)), `${collection} ${user.role}`).toBe(
          user === admin && adminReads,
        );
        expect(
          await allowed(() =>
            payload.create({ collection, data: {} as never, overrideAccess: false, user }),
          ),
          `create ${collection} ${user.role}`,
        ).toBe(false);
        const as = { where: { id: { exists: true } }, overrideAccess: false, user } as const;
        expect(
          await allowed(() => payload.update({ collection, data: {}, ...as })),
          `update ${collection} ${user.role}`,
        ).toBe(false);
        expect(
          await allowed(() => payload.delete({ collection, ...as })),
          `delete ${collection} ${user.role}`,
        ).toBe(false);
      }
    }
    for (const slug of GLOBALS) {
      expect(
        await allowed(() =>
          payload.updateGlobal({ slug, data: {}, overrideAccess: false, user: editor }),
        ),
        slug,
      ).toBe(false);
    }
  });

  it('AC10 editors work bookings but never delete one or change its phone or kind', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    const phone = `0935${String(randomInt(10_000_000)).padStart(7, '0')}`;
    const row = await payload.create({
      collection: 'bookings',
      data: { phone, kind: 'regular' } as never,
    });
    const changed = await payload.update({
      collection: 'bookings',
      id: row.id,
      data: { phone: '09350000000', kind: 'emergency', status: 'contacted' } as never,
      ...asEditor,
    });
    expect(changed).toMatchObject({ phone: row.phone, kind: 'regular', status: 'contacted' });
    expect(
      await allowed(() => payload.delete({ collection: 'bookings', id: row.id, ...asEditor })),
    ).toBe(false);
  });

  it('AC11 accounts: editors never create one, read or delete another; admins never delete their own', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    expect(
      await allowed(() =>
        payload.create({
          collection: 'users',
          data: {
            email: `x-${unique()}@sefid.test`,
            password: `p-${unique()}-${unique()}`,
            name: 'x',
            role: 'editor',
          },
          ...asEditor,
        }),
      ),
    ).toBe(false);
    // A row outside a where-constraint answers 403 or 404; either way nothing is returned.
    const hidden = (call: Promise<unknown>) =>
      expect(call).rejects.toSatisfy((e: { status?: number }) => [403, 404].includes(e.status!));
    await hidden(payload.findByID({ collection: 'users', id: admin.id, ...asEditor }));
    await hidden(payload.delete({ collection: 'users', id: admin.id, ...asEditor }));
    await hidden(
      payload.delete({ collection: 'users', id: admin.id, overrideAccess: false, user: admin }),
    );
    expect(await payload.findByID({ collection: 'users', id: admin.id, depth: 0 })).toBeTruthy();
  });

  it('AC12 Payload job runs: the cron bearer or a TOTP-verified admin, nobody else', async () => {
    const secret = readEnv().cronSecret;
    const call = (user: object | null, authorization?: string) =>
      canRunJobs({
        req: {
          user,
          headers: new Headers(authorization ? { authorization } : {}),
          payload,
        } as unknown as PayloadRequest,
      });
    expect(await call(null)).toBe(false);
    expect(await call(null, 'Bearer wrong')).toBe(false);
    expect(await call(editor)).toBe(false);
    expect(await call({ ...admin, _strategy: 'local-jwt', hasTotp: true })).toBe(false);
    expect(await call(null, `Bearer ${secret}`)).toBe(true);
    expect(await call(admin)).toBe(true);
  });

  it('AC13 only an admin lifts a sign-in or TOTP code lock', async () => {
    const unlock = (user: object) =>
      allowed(() =>
        payload.unlock({
          collection: 'users',
          data: { email: editor.email },
          overrideAccess: false,
          user,
        } as never),
      );
    expect(await unlock(editor)).toBe(false);
    // A password-only admin session must not lift the TOTP code lock it is guessing against.
    expect(await unlock({ ...admin, _strategy: 'local-jwt', hasTotp: true })).toBe(false);
    expect(await unlock(admin)).toBe(true);
  });

  it('AC14 sign-in sets the session cookie but never answers the JWT (SEC-4)', async () => {
    const email = `cookie-${unique()}@sefid.test`;
    const password = randomBytes(18).toString('base64url');
    await payload.create({
      collection: 'users',
      data: { email, password, name: 'آزمون کوکی', role: 'editor' },
      context: { skipAudit: true },
    });
    const call = (handler: (r: Request, a: never) => Promise<Response>, request: Request) =>
      handler(request, {
        params: Promise.resolve({ slug: new URL(request.url).pathname.split('/').slice(2) }),
      } as never);
    const login = await call(
      POST,
      new Request('http://localhost/api/users/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(login.status).toBe(200);
    const body = (await login.json()) as Record<string, unknown>;
    expect(body.user).toMatchObject({ email });
    expect(body).not.toHaveProperty('token');
    const cookie = login.headers.getSetCookie().find((c) => c.startsWith('payload-token='));
    expect(cookie).toMatch(/HttpOnly/i);
    // The Local API answers the same way (the «me» endpoint reads the same switch).
    const local = await payload.login({ collection: 'users', data: { email, password } });
    expect(local.user).toMatchObject({ email });
    expect(local.token).toBeUndefined();
  });
});
