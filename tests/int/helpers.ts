// Shared setup of the data-lane integration tests. Each test file mocks 'next/cache' itself
// (vi.mock is hoisted per file): outside a Next.js request revalidateTag and unstable_cache throw.
import { randomBytes } from 'node:crypto';

import config from '@payload-config';
import { getPayload, type Payload } from 'payload';

export const getTestPayload = (): Promise<Payload> => getPayload({ config });

/** A unique suffix for natural keys and slugs created by one test run. */
export const unique = (): string => randomBytes(4).toString('hex');

/** A latin key or a Persian slug that no other run uses. */
export const uniqueKey = (base: string): string => `${base}-${unique()}`;
export const uniqueSlug = (base: string): string =>
  `${base}-${[...unique()].map((c) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(c, 16) % 10]).join('')}`;

export interface StaffUser {
  id: number | string;
  role: 'admin' | 'editor';
  name: string;
  email: string;
  collection: 'users';
  /** As after a TOTP code in the session: the payload-totp wrapper then applies the inner access. */
  _strategy: 'totp';
}

async function createUser(payload: Payload, role: 'admin' | 'editor'): Promise<StaffUser> {
  const email = `${role}-${unique()}@sefid.test`;
  const name = role === 'admin' ? 'مدیر آزمون' : 'ویراستار آزمون';
  const doc = await payload.create({
    collection: 'users',
    data: { email, password: randomBytes(18).toString('base64url'), name, role },
    context: { skipAudit: true },
  });
  return {
    id: doc.id,
    role: doc.role as StaffUser['role'],
    name,
    email,
    collection: 'users',
    _strategy: 'totp',
  };
}

/** An admin and an editor (the admin first: the first account of an empty database is an admin). */
export async function staffUsers(
  payload: Payload,
): Promise<{ admin: StaffUser; editor: StaffUser }> {
  const admin = await createUser(payload, 'admin');
  const editor = await createUser(payload, 'editor');
  if (editor.role !== 'editor')
    throw new Error('staffUsers: the editor account did not keep its role');
  return { admin, editor };
}

/** true when the call succeeds, false when Payload refuses it for access (403). */
export async function allowed(call: () => Promise<unknown>): Promise<boolean> {
  try {
    await call();
    return true;
  } catch (err) {
    if ((err as { status?: number }).status === 403) return false;
    throw err;
  }
}

/** A published category and service with unique keys and slugs, for path and redirect tests. */
export async function publishedService(payload: Payload, slug = uniqueSlug('خدمت-آزمون')) {
  const category = await payload.create({
    collection: 'service-categories',
    data: {
      key: uniqueKey('cat'),
      title: 'دستهٔ آزمون',
      navLabel: 'دستهٔ آزمون',
      slug: uniqueSlug('دسته-آزمون'),
      accent: 'cosmetic',
      _status: 'published',
    },
  });
  const service = await payload.create({
    collection: 'services',
    data: {
      key: uniqueKey('svc'),
      category: category.id,
      navLabel: 'خدمت آزمون',
      h1: 'خدمت آزمون',
      slug,
      bookingGroup: 'other',
      priority: 3,
      _status: 'published',
    },
  });
  return { category, service };
}

/** The Persian field messages of a refused write (Payload's ValidationError keeps them in data). */
export async function refusal(call: Promise<unknown>): Promise<string[]> {
  try {
    await call;
  } catch (err) {
    const errors = (err as { data?: { errors?: { message: string }[] } }).data?.errors;
    if (errors) return errors.map((e) => e.message);
    return [(err as Error).message];
  }
  throw new Error('refusal: the write was accepted');
}
