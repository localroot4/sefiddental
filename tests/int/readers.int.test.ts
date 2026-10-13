import { unstable_cache } from 'next/cache';
import type { Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { getRedirectsSnapshot, recordRedirectHit } from '@/lib/data/redirects';
import { getServiceKeys } from '@/lib/events/increment';

import { getTestPayload, publishedService, unique } from './helpers';

// unstable_cache runs the loader directly and records its key and tags.
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

let payload: Payload;

const lastTags = () => {
  const calls = vi.mocked(unstable_cache).mock.calls;
  return (calls.at(-1)?.[2] as { tags?: string[] } | undefined)?.tags;
};

describe('data readers (freeze 3.10)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
  });

  it('RR1 getPublished returns published documents only and tags every populated collection', async () => {
    const { service } = await publishedService(payload);
    const draft = await payload.create({
      collection: 'services',
      data: { key: `draft-${unique()}`, navLabel: `پیش‌نویس ${unique()}` },
      draft: true,
    });
    const docs = await getPublished('services', {
      where: { id: { in: [service.id, draft.id] } },
      depth: 1,
    });
    expect(docs.map((d) => d.id)).toEqual([service.id]);
    expect(lastTags()).toEqual(
      expect.arrayContaining(['col:services', 'col:service-categories', 'col:media']),
    );
    await getPublished('services', { where: { id: { equals: service.id } } });
    expect(lastTags()).toEqual(['col:services']);
  });

  it('RR2 the redirects snapshot holds active rows as tuples; a hit is one SQL update', async () => {
    const from = `/hit-${unique()}`;
    const row = await payload.create({
      collection: 'redirects',
      data: { from, to: '/خدمات', statusCode: '302' } as never,
    });
    await payload.create({
      collection: 'redirects',
      data: { from: `/off-${unique()}`, to: '/', active: false } as never,
    });
    const snapshot = await getRedirectsSnapshot();
    expect(snapshot.rows).toContainEqual([from, '/خدمات', 302]);
    expect(snapshot.rows.every(([path]) => !path.startsWith('/off-'))).toBe(true);
    expect(lastTags()).toEqual(['col:redirects']);

    const versionsBefore = await payload.countVersions({
      collection: 'redirects',
      where: { parent: { equals: row.id } },
    });
    await recordRedirectHit(from);
    await recordRedirectHit(from);
    const after = await payload.findByID({ collection: 'redirects', id: row.id, depth: 0 });
    expect(after.hits).toBe(2);
    expect(after.lastHitAt).toBeTruthy();
    const versionsAfter = await payload.countVersions({
      collection: 'redirects',
      where: { parent: { equals: row.id } },
    });
    expect(versionsAfter.totalDocs).toBe(versionsBefore.totalDocs);
  });

  it('RR3 globals and service keys', async () => {
    const clinic = await getClinic();
    expect(lastTags()).toEqual(['glob:clinic', 'col:media']);
    expect(clinic).toHaveProperty('hours');
    const features = await getFeatures();
    expect(features.qualityTierOverride).toBe('auto');
    expect(lastTags()).toEqual(['glob:features']);
    const { service } = await publishedService(payload);
    expect((await getServiceKeys()).has(service.key)).toBe(true);
  });
});
