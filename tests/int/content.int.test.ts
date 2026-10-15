import { createLocalReq, type Payload } from 'payload';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { runSeed } from '@/seed/run';
import { lexicalFrom } from '@/seed/transforms';

import { getTestPayload, uniqueKey, uniqueSlug } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
const ROOT = process.cwd();

/** Publishing a new service with this body; resolves to the Payload error message or 'ok'. */
async function publishService(categoryId: number, text: string): Promise<string> {
  const key = uniqueKey('gate');
  try {
    await payload.create({
      collection: 'services',
      data: {
        key,
        category: categoryId,
        navLabel: key,
        h1: 'خدمت آزمایشی',
        slug: uniqueSlug('خدمت-آزمایشی'),
        bookingGroup: 'other',
        priority: 3,
        body: [{ blockType: 'content', body: lexicalFrom(text) }],
        _status: 'published',
      },
    });
    return 'ok';
  } catch (err) {
    return (err as { data?: { errors?: { message: string }[] } }).data?.errors?.[0]?.message ?? '';
  }
}

describe('phase 4 content model (freeze F7, F17; the seeded restoration page)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    await runSeed(payload, { mode: 'create-only', root: ROOT });
  }, 120_000);

  it('CT1 the seeded restoration page fills hero, facts, body, steps, FAQ and related', async () => {
    const { docs } = await payload.find({
      collection: 'services',
      where: { key: { equals: 'restoration' } },
      depth: 1,
      limit: 1,
    });
    const restoration = docs[0]!;
    expect(restoration._status).toBe('published');
    expect(restoration.summary).toBeTruthy();
    expect(restoration.facts).toMatchObject({ sessions: expect.any(String) });
    expect(restoration.body?.map((b) => b.blockType)).toEqual([
      'content',
      'callout',
      'steps',
      'content',
    ]);
    expect(restoration.faqs?.length).toBeGreaterThanOrEqual(5);
    expect(
      (restoration.relatedServices ?? []).map((s) => (typeof s === 'object' ? s.key : s)),
    ).toEqual(['crown', 'inlay-onlay', 'root-canal']);
    expect(restoration.seo?.description).toBeTruthy();
  });

  it('CT2 home sections, journey steps and FAQ; category intro and FAQ', async () => {
    const home = (
      await payload.find({ collection: 'pages', where: { key: { equals: 'home' } }, limit: 1 })
    ).docs[0]!;
    expect(home.title).toBe('کلینیک دندانپزشکی سفید در جنوب تهران');
    expect(home.hero?.subtext).toBeTruthy();
    expect(home.sections?.map((s) => s.key)).toContain('journey');
    expect(home.blocks?.map((b) => b.blockType)).toEqual(['steps', 'faq']);
    const cosmetic = (
      await payload.find({
        collection: 'service-categories',
        where: { key: { equals: 'cosmetic' } },
        limit: 1,
      })
    ).docs[0]!;
    expect(cosmetic.intro).toBeTruthy();
    expect(cosmetic.faqs?.length).toBeGreaterThanOrEqual(3);
    expect(cosmetic.seo?.title).toBe('دندانپزشکی زیبایی');
  });

  it('CT3 rich text with a marker or a banned word cannot publish; a draft can hold it', async () => {
    const category = (
      await payload.find({
        collection: 'service-categories',
        where: { key: { equals: 'restorative' } },
        limit: 1,
      })
    ).docs[0]!;
    expect(await publishService(category.id, '## مراحل\nپارکینگ: [[NEEDS_CLIENT: پارکینگ]]')).toBe(
      'متن هنوز علامت «[[NEEDS_CLIENT]]» دارد. پیش از انتشار، اطلاعات واقعی را جایگزین کنید.',
    );
    expect(await publishService(category.id, 'نتیجهٔ تضمینی')).toBe(
      'واژهٔ «تضمینی» در متن مجاز نیست. یک واقعیت قابل‌بررسی جایش بنویسید.',
    );
    expect(await publishService(category.id, 'ترمیم دندان در یک جلسه')).toBe('ok');
    const key = uniqueKey('draft');
    const draft = await payload.create({
      collection: 'services',
      draft: true,
      data: {
        key,
        category: category.id,
        navLabel: key,
        h1: 'پیش‌نویس',
        slug: uniqueSlug('پیش-نویس'),
        bookingGroup: 'other',
        priority: 3,
        body: [{ blockType: 'content', body: lexicalFrom('[[NEEDS_CLIENT: متن]]') }],
        _status: 'draft',
      },
    });
    expect(draft._status).toBe('draft');
  });

  it('CT4 the home subtext counts the free-consultation sentence while the flag is on, in the admin too', async () => {
    const home = (
      await payload.find({ collection: 'pages', where: { key: { equals: 'home' } }, limit: 1 })
    ).docs[0]!;
    const sixteen = Array.from({ length: 16 }, () => 'واژه').join(' ');
    const save = (subtext: string) =>
      payload
        .update({ collection: 'pages', id: home.id, data: { hero: { subtext } } })
        .then(() => 'ok')
        .catch(
          (err: { data?: { errors?: { message: string }[] } }) => err.data?.errors?.[0]?.message,
        );
    // The admin form state runs the same validate with event 'onChange' and blocks the save on it.
    const hero = payload.collections.pages.config.flattenedFields.find((f) => f.name === 'hero');
    const subtext =
      hero && 'flattenedFields' in hero
        ? hero.flattenedFields.find((f) => f.name === 'subtext')
        : undefined;
    const req = await createLocalReq({}, payload);
    const adminCheck = (value: string) =>
      (subtext as { validate: (v: string, o: unknown) => unknown }).validate(value, {
        req,
        event: 'onChange',
      });
    const tooLong =
      'متن زیر تیتر با جملهٔ «مشاورهٔ اول رایگان است.» ۲۰ واژه است. حداکثر ۱۹ واژه مجاز است.';
    const features = await payload.findGlobal({ slug: 'features', depth: 0 });
    try {
      await payload.updateGlobal({ slug: 'features', data: { freeConsultation: true } });
      expect(await save(sixteen)).toBe(tooLong);
      expect(await adminCheck(sixteen)).toBe(tooLong);
      await payload.updateGlobal({ slug: 'features', data: { freeConsultation: false } });
      expect(await save(sixteen)).toBe('ok');
      expect(await adminCheck(sixteen)).toBe(true);
    } finally {
      await payload.updateGlobal({
        slug: 'features',
        data: { freeConsultation: features.freeConsultation },
      });
      await payload.update({
        collection: 'pages',
        id: home.id,
        data: { hero: { subtext: home.hero?.subtext ?? null } },
      });
    }
  });

  it('CT5 a home section key appears once', async () => {
    const home = (
      await payload.find({ collection: 'pages', where: { key: { equals: 'home' } }, limit: 1 })
    ).docs[0]!;
    await expect(
      payload.update({
        collection: 'pages',
        id: home.id,
        data: {
          sections: [
            { key: 'faq', heading: 'یک' },
            { key: 'faq', heading: 'دو' },
          ],
        },
      }),
    ).rejects.toMatchObject({ data: { errors: [{ message: 'هر بخش فقط یک بار می‌آید.' }] } });
  });
});
