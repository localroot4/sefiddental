import { revalidateTag } from 'next/cache';
import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getTestPayload, publishedService, refusal, unique, uniqueSlug } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;

const rows = async (from: string) =>
  (
    await payload.find({
      collection: 'redirects',
      where: { from: { equals: from } },
      depth: 0,
      pagination: false,
    })
  ).docs;
const path = (slug: string) => `/خدمات/${slug}`;

describe('slug-change and removal redirects (spec-data 6.4)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('R1-R5 rename, draft save, chain, shadow, unpublish and republish', async () => {
    const a = uniqueSlug('الف');
    const b = uniqueSlug('ب');
    const c = uniqueSlug('ج');
    const { service } = await publishedService(payload, a);

    // R1 a slug change of a published service: one 301 from the old path.
    await payload.update({ collection: 'services', id: service.id, data: { slug: b } });
    const [first, ...more] = await rows(path(a));
    expect(more).toHaveLength(0);
    expect(first).toMatchObject({
      to: path(b),
      statusCode: '301',
      source: 'slug_change',
      active: true,
    });

    // R2 a draft save leaves the main row (and the redirects) alone.
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { slug: c },
      draft: true,
    });
    expect(await rows(path(b))).toHaveLength(0);

    // R3 publishing the new slug: B -> C, and A -> B is flattened to A -> C.
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { slug: c, _status: 'published' },
    });
    expect((await rows(path(b)))[0]).toMatchObject({ to: path(c), active: true });
    expect((await rows(path(a)))[0]).toMatchObject({ to: path(c), active: true });

    // R4 back to A: the redirect from A would shadow the live page, so it is switched off.
    await payload.update({ collection: 'services', id: service.id, data: { slug: a } });
    expect((await rows(path(a)))[0]?.active).toBe(false);
    expect((await rows(path(c)))[0]).toMatchObject({ to: path(a), active: true });
    expect((await rows(path(b)))[0]).toMatchObject({ to: path(a), active: true });

    // R5 unpublish sends the path to the hub; republishing switches that redirect off again.
    await payload.update({ collection: 'services', id: service.id, data: { _status: 'draft' } });
    expect((await rows(path(a)))[0]).toMatchObject({
      to: '/خدمات',
      source: 'auto_removed',
      active: true,
    });
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { _status: 'published' },
    });
    expect((await rows(path(a)))[0]?.active).toBe(false);
  });

  it('R6 trash and permanent delete redirect to the hub', async () => {
    const slug = uniqueSlug('حذف');
    const { service } = await publishedService(payload, slug);
    await payload.update({
      collection: 'services',
      id: service.id,
      data: { deletedAt: new Date().toISOString() },
    });
    expect((await rows(path(slug)))[0]).toMatchObject({
      to: '/خدمات',
      source: 'auto_removed',
      active: true,
    });

    const other = uniqueSlug('حذف-کامل');
    const second = await publishedService(payload, other);
    await payload.delete({ collection: 'services', id: second.service.id });
    expect((await rows(path(other)))[0]).toMatchObject({ to: '/خدمات', source: 'auto_removed' });
  });

  it('R7 a category and a service cannot share a slug (H-NS)', async () => {
    const slug = uniqueSlug('مشترک');
    await publishedService(payload, slug);
    expect(
      await refusal(
        payload.create({
          collection: 'service-categories',
          data: {
            key: `k-${unique()}`,
            title: 'دسته',
            navLabel: 'دسته',
            slug,
            accent: 'kids',
            _status: 'published',
          },
        }),
      ),
    ).toEqual(['این نشانی برای یک خدمت دیگر استفاده شده است.']);
  });

  it('R8 manual redirects: normalized, chains flattened, loops refused', async () => {
    const x = `/old-${unique()}`;
    const y = `/mid-${unique()}`;
    const z = `/خدمات/${uniqueSlug('مقصد')}`;
    await payload.create({
      collection: 'redirects',
      data: { from: `${y.toUpperCase()}/`, to: z } as never,
    });
    const created = await payload.create({
      collection: 'redirects',
      data: { from: x, to: y } as never,
    });
    expect(created).toMatchObject({ to: z });
    expect((await rows(y))[0]).toMatchObject({ from: y, to: z });
    expect(
      await refusal(payload.create({ collection: 'redirects', data: { from: z, to: x } as never })),
    ).toEqual(['این انتقال به خودش برمی‌گردد. مقصد دیگری انتخاب کنید.']);
  });

  it('R9 revalidation: content tags with max, redirects and globals expire at once', async () => {
    const mock = vi.mocked(revalidateTag);
    mock.mockClear();
    const { service } = await publishedService(payload);
    expect(mock).toHaveBeenCalledWith('col:services', 'max');
    expect(mock).toHaveBeenCalledWith(`doc:services:${service.id}`, 'max');
    mock.mockClear();
    await payload.create({
      collection: 'redirects',
      data: { from: `/r-${unique()}`, to: '/' } as never,
    });
    expect(mock).toHaveBeenCalledWith('col:redirects', { expire: 0 });
    mock.mockClear();
    await payload.updateGlobal({ slug: 'features', data: { introEnabled: true } });
    expect(mock).toHaveBeenCalledWith('glob:features', { expire: 0 });
    mock.mockClear();
    // A draft save of a draft is invisible to the site: no revalidation.
    const draft = await payload.create({
      collection: 'articles',
      data: { title: `پیش‌نویس ${unique()}` },
      draft: true,
    });
    await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { title: 'دیگر' },
      draft: true,
    });
    expect(mock.mock.calls.filter(([tag]) => String(tag).startsWith('col:articles'))).toHaveLength(
      0,
    );
  });
});
