import type { Payload } from 'payload';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { withScheduleBlockMessages } from '@/admin/schedulePublish';
import {
  altRule,
  approvalRule,
  authorRule,
  headingsRule,
  lexicalNodeRule,
  primaryServiceRule,
  publishedDoctorRule,
  slugRule,
  tableCellsRule,
  tableRowsRule,
} from '@/fields/validators';
import { APPROVE_ADMIN_ONLY } from '@/hooks/review';
import type { Page } from '@/payload-types';

import {
  getTestPayload,
  refusal,
  type StaffUser,
  staffUsers,
  unique,
  uniqueKey,
  uniqueSlug,
} from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
let admin: StaffUser;
let editor: StaffUser;
const ids: Record<string, number> = {};
let restoreGuide: () => Promise<void> = async () => {};

// Lexical JSON as the admin saves it.
const textNode = (text: string) => ({
  type: 'text',
  text,
  version: 1,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
});
const element = (type: string, children: unknown[], extra: object = {}) => ({
  type,
  children,
  direction: 'rtl',
  format: '',
  indent: 0,
  version: 1,
  ...extra,
});
const h2 = (text: string) => element('heading', [textNode(text)], { tag: 'h2' });
const docLink = (relationTo: string, value: number, text: string) =>
  element('link', [textNode(text)], {
    version: 3,
    fields: { linkType: 'internal', newTab: false, doc: { relationTo, value } },
  });
const paragraph = (...children: unknown[]) =>
  element('paragraph', children, { textFormat: 0, textStyle: '' });
const body = (...children: unknown[]) => ({
  root: element('root', children),
});
// A BlocksFeature node as the admin saves it; Lexical keys block and row state by these ids.
const nodeId = () => `${unique()}${unique()}${unique()}`;
const blockNode = (fields: Record<string, unknown>) => ({
  type: 'block',
  version: 2,
  format: '',
  fields: { id: nodeId(), blockName: '', ...fields },
});
const table = (head: string[], ...rows: string[][]) =>
  blockNode({
    blockType: 'table',
    caption: 'مقایسهٔ دو روش',
    head,
    rows: rows.map((cells) => ({ id: nodeId(), cells })),
  });
const twoLinks = () =>
  paragraph(
    textNode('برای جزئیات درمان '),
    docLink('services', ids.service!, 'صفحهٔ خدمت'),
    textNode(' و برای مراقبت '),
    docLink('pages', ids.guide!, 'راهنمای مراقبت'),
    textNode(' را بخوانید.'),
  );

/** A JPEG media document; a random colour keeps its content hash unique. */
async function photo(width: number, height: number) {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: Math.floor(Math.random() * 255), g: 90, b: 60 },
    },
  })
    .jpeg({ quality: 70 })
    .toBuffer();
  return payload.create({
    collection: 'media',
    data: { alt: 'لبخند بیمار در کلینیک' },
    file: { data, name: `ed-${unique()}.jpg`, mimetype: 'image/jpeg', size: data.length },
  });
}

async function dentist(published: boolean) {
  const portrait = await photo(640, 800);
  const doc = await payload.create({
    collection: 'doctors',
    data: {
      name: `آزمون ${unique()}`,
      specialty: 'دندانپزشک عمومی',
      councilNumber: String(Math.floor(Math.random() * 1e9)),
      photo: portrait.id,
      _status: published ? 'published' : 'draft',
    } as never,
    draft: !published,
  });
  return doc.id as number;
}

/** A complete article that passes every rule (H5 with C1, H6, H7 with C2, C3). */
const valid = (): Record<string, unknown> => ({
  title: 'ایمپلنت یا بریج برای دندان',
  slug: uniqueSlug('مقاله-ویراستاری'),
  excerpt:
    'وقتی یک دندان از دست می‌رود، دو راه رایج ایمپلنت و بریج است. این نوشته تفاوت این دو را به زبان ساده می‌گوید.',
  cover: ids.cover,
  body: body(h2('ایمپلنت چیست'), twoLinks(), h2('بریج چیست'), paragraph(textNode('متن کوتاه.'))),
  category: ids.category,
  primaryService: ids.service,
  authorDoctor: ids.dentist,
  isMedical: true,
  reviewer: ids.dentist,
  reviewedAt: '2026-10-10T08:30:00.000Z',
  sources: [{ title: 'Dental implants', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
  reviewState: 'approved',
  seo: { description: 'ب'.repeat(130) },
  _status: 'published',
});

const publish = (data: Record<string, unknown>) =>
  refusal(payload.create({ collection: 'articles', data: data as never }));

describe('editorial publish gate (ED)', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    ({ admin, editor } = await staffUsers(payload));
    ids.cover = (await photo(1600, 900)).id as number;
    ids.dentist = await dentist(true);
    ids.draftDentist = await dentist(false);
    const category = await payload.create({
      collection: 'service-categories',
      data: {
        key: uniqueKey('edcat'),
        title: 'دستهٔ ویراستاری',
        navLabel: 'دستهٔ ویراستاری',
        slug: uniqueSlug('دسته-ویراستاری'),
        accent: 'restorative',
        _status: 'published',
      },
    });
    const service = await payload.create({
      collection: 'services',
      data: {
        key: uniqueKey('edsvc'),
        category: category.id,
        navLabel: 'ایمپلنت آزمون',
        h1: 'ایمپلنت آزمون',
        slug: uniqueSlug('ایمپلنت-آزمون'),
        bookingGroup: 'implant',
        priority: 1,
        sources: [{ title: 'Implants', url: 'https://www.ada.org/resources', publisher: 'ADA' }],
        _status: 'published',
      },
    });
    ids.service = service.id as number;
    ids.category = (
      await payload.create({
        collection: 'article-categories',
        data: { title: `جایگزینی دندان ${unique()}` } as never,
      })
    ).id as number;
    // The guide link target: a published guide page, restored afterwards (other files seed it).
    const key = 'guide-aftercare';
    const existing = (
      await payload.find({ collection: 'pages', where: { key: { equals: key } }, depth: 0 })
    ).docs[0] as Page | undefined;
    const guide =
      existing ??
      (await payload.create({
        collection: 'pages',
        data: { key, title: 'مراقبت بعد از درمان', slug: 'مراقبت-بعد-از-درمان' } as never,
        draft: true,
      }));
    await payload.update({
      collection: 'pages',
      id: guide.id,
      data: {
        reviewer: ids.dentist,
        reviewedAt: '2026-10-01T00:00:00.000Z',
        sources: [{ title: 'Aftercare', url: 'https://www.nhs.uk/conditions' }],
        _status: 'published',
      },
    });
    ids.guide = guide.id as number;
    restoreGuide = async () => {
      if (!existing) {
        await payload.delete({ collection: 'pages', id: guide.id });
        return;
      }
      const saved = {
        reviewer: existing.reviewer ?? null,
        reviewedAt: existing.reviewedAt ?? null,
        sources: existing.sources ?? [],
        _status: existing._status,
      };
      await payload.update({ collection: 'pages', id: guide.id, data: saved, draft: true });
      await payload.db.updateOne({ collection: 'pages', id: guide.id, data: saved });
    };
  }, 120_000);

  afterAll(async () => {
    await restoreGuide();
  });

  it('ED1 a complete article publishes; its slug from a long title is cut within 60 (H2)', async () => {
    expect(await publish(valid()).catch((e: Error) => e.message)).toBe(
      'refusal: the write was accepted',
    );
    const long = await payload.create({
      collection: 'articles',
      data: { title: `${'واژه '.repeat(17)}پایان` },
      draft: true,
    });
    expect([...(long.slug ?? '')].length).toBeLessThanOrEqual(60);
    expect(long.slug).not.toMatch(/-$/);
  });

  it('ED2 title, description and slug messages (H2, H6)', async () => {
    expect(await publish({ ...valid(), title: 'ا'.repeat(40) })).toContain(
      'عنوان صفحه با پسوند ۶۵ نویسه است و در گوگل بریده می‌شود. «عنوان سئو» را کوتاه‌تر بنویسید: با پسوند حداکثر ۶۰ نویسه.',
    );
    expect(await publish({ ...valid(), seo: {} })).toContain(
      'توضیح سئو را بنویسید (۱۲۰ تا ۱۶۰ نویسه).',
    );
    expect(await publish({ ...valid(), slug: 'دسته' })).toContain(
      slugRule('دسته', 60, ['دسته']) as string,
    );
    expect(await publish({ ...valid(), slug: `implant-${unique()}` })).toContain(
      'نشانی دست‌کم یک حرف فارسی لازم دارد.',
    );
  });

  it('ED3 cover alt, author, primary service (H6, H21)', async () => {
    const legacy = await photo(1600, 900);
    // Media saved before V-ALT: the adapter writes the old alt as it was.
    await payload.db.updateOne({ collection: 'media', id: legacy.id, data: { alt: 'IMG_1234' } });
    expect(await publish({ ...valid(), cover: legacy.id })).toContain(altRule('IMG_1234'));
    expect(await publish({ ...valid(), staffAuthorName: 'مریم' })).toContain(authorRule(1, 'مریم'));
    expect(await publish({ ...valid(), primaryService: null })).toContain(
      primaryServiceRule(true, null),
    );
  });

  it('ED4 reviewer, review date, sources and approval on every article, medical or not (C1)', async () => {
    for (const isMedical of [true, false]) {
      const messages = await publish({
        ...valid(),
        isMedical,
        reviewer: null,
        reviewedAt: null,
        sources: [],
        reviewState: 'in_review',
      });
      expect(messages).toEqual(
        expect.arrayContaining([
          'بازبین پزشکی را انتخاب کنید.',
          'تاریخ بازبینی را وارد کنید.',
          'دست‌کم یک منبع علمی اضافه کنید.',
          approvalRule('in_review'),
        ]),
      );
    }
  });

  it('ED5 the reviewer and the author must be published dentists (H23)', async () => {
    expect(await publish({ ...valid(), reviewer: ids.draftDentist })).toContain(
      publishedDoctorRule('reviewer', false),
    );
    expect(await publish({ ...valid(), authorDoctor: ids.draftDentist })).toContain(
      publishedDoctorRule('author', false),
    );
  });

  it('ED6 links: a live service link (the primary one) and a live guide link (C2)', async () => {
    const onlyGuide = paragraph(docLink('pages', ids.guide!, 'راهنما'));
    expect(await publish({ ...valid(), body: body(h2('یک'), onlyGuide, h2('دو')) })).toContain(
      'در متن به خدمت اصلی مقاله («ایمپلنت آزمون») پیوند بدهید.',
    );
    const onlyService = paragraph(docLink('services', ids.service!, 'خدمت'));
    expect(await publish({ ...valid(), body: body(h2('یک'), onlyService, h2('دو')) })).toContain(
      'در متن به یکی از راهنماهای بیمار پیوند بدهید.',
    );
    // A custom URL to the own site does not count.
    const custom = element('link', [textNode('راهنما')], {
      version: 3,
      fields: { linkType: 'custom', url: '/راهنمای-بیمار/مراقبت-بعد-از-درمان', newTab: false },
    });
    expect(
      await publish({ ...valid(), body: body(h2('یک'), paragraph(onlyService, custom), h2('دو')) }),
    ).toContain('در متن به یکی از راهنماهای بیمار پیوند بدهید.');
    // A link to an unpublished page: the message names it (RichBody drops such a link).
    const hidden = await payload.create({
      collection: 'services',
      data: {
        key: uniqueKey('edhidden'),
        category: (await payload.findByID({ collection: 'services', id: ids.service!, depth: 0 }))
          .category as number,
        navLabel: 'خدمت پنهان',
        h1: 'خدمت پنهان',
        slug: uniqueSlug('خدمت-پنهان'),
        bookingGroup: 'other',
        priority: 3,
        _status: 'draft',
      },
      draft: true,
    });
    const deadLink = paragraph(docLink('services', hidden.id as number, 'خدمت پنهان'));
    expect(
      await publish({ ...valid(), body: body(h2('یک'), twoLinks(), deadLink, h2('دو')) }),
    ).toContain(
      'پیوند «خدمت پنهان» به صفحه‌ای منتشرنشده می‌رود و در سایت کار نمی‌کند. آن را بردارید یا صفحه‌ای منتشرشده را پیوند دهید.',
    );
  });

  it('ED7 at least two H2 headings (C3)', async () => {
    const one = body(h2('یک'), twoLinks());
    expect(await publish({ ...valid(), body: one })).toContain(headingsRule(one));
  });

  it('ED8 editors: reviewer and review date are admin-only; «تأییدشده» too; isMedical is theirs (H5, C1)', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    const draft = await payload.create({
      collection: 'articles',
      data: {
        title: `پیش‌نویس ${unique()}`,
        reviewer: ids.dentist,
        reviewedAt: '2026-10-10T08:30:00.000Z',
        isMedical: false,
      },
      draft: true,
      ...asEditor,
    });
    expect(draft).toMatchObject({ reviewer: null, isMedical: false });
    expect(draft.reviewedAt ?? null).toBeNull();
    expect(
      await refusal(
        payload.update({
          collection: 'articles',
          id: draft.id,
          data: { reviewState: 'approved' },
          draft: true,
          ...asEditor,
        }),
      ),
    ).toEqual([APPROVE_ADMIN_ONLY]);
    const sent = await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { reviewState: 'in_review', isMedical: true },
      draft: true,
      ...asEditor,
    });
    expect(sent).toMatchObject({ reviewState: 'in_review', isMedical: true });
  });

  it('ED9 approval flow: the admin approves, the editor publishes; an editor text change re-opens review (H5)', async () => {
    const asEditor = { overrideAccess: false, user: editor } as const;
    const asAdmin = { overrideAccess: false, user: admin } as const;
    const { reviewer, reviewedAt, reviewState, _status, ...rest } = valid();
    const draft = await payload.create({
      collection: 'articles',
      data: { ...rest, reviewState: 'in_review' } as never,
      draft: true,
      ...asEditor,
    });
    await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { reviewer, reviewedAt, reviewState } as never,
      draft: true,
      ...asAdmin,
    });
    const live = await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { _status } as never,
      ...asEditor,
    });
    expect(live).toMatchObject({ _status: 'published', reviewState: 'approved' });
    const changed = body(
      h2('ایمپلنت چیست'),
      twoLinks(),
      h2('بریج چیست'),
      paragraph(textNode('متن تازه.')),
    );
    expect(
      await refusal(
        payload.update({
          collection: 'articles',
          id: draft.id,
          data: { body: changed, _status: 'published' } as never,
          ...asEditor,
        }),
      ),
    ).toContain(approvalRule('in_review'));
    const saved = await payload.update({
      collection: 'articles',
      id: draft.id,
      data: { body: changed } as never,
      draft: true,
      ...asEditor,
    });
    expect(saved.reviewState).toBe('in_review');
    // An admin text fix keeps the approval.
    const fixed = await payload.update({
      collection: 'articles',
      id: draft.id,
      data: {
        reviewState: 'approved',
        excerpt: `${String(valid().excerpt)} اصلاح.`,
        _status: 'published',
      },
      ...asAdmin,
    });
    expect(fixed.reviewState).toBe('approved');
  });

  it('ED10 a scheduled publish of an invalid article fails and the job keeps the block message (H12)', async () => {
    withScheduleBlockMessages(payload.config);
    const draft = await payload.create({
      collection: 'articles',
      data: { ...valid(), reviewState: 'in_review', _status: 'draft' } as never,
      draft: true,
    });
    await payload.jobs.queue({
      task: 'schedulePublish',
      input: { type: 'publish', doc: { relationTo: 'articles', value: String(draft.id) } } as never,
      waitUntil: new Date(Date.now() - 1000),
    });
    await payload.jobs.run({ allQueues: true, limit: 50 });
    const { docs } = await payload.find({
      collection: 'payload-jobs',
      where: { taskSlug: { equals: 'schedulePublish' } },
      limit: 0,
      depth: 0,
    });
    const job = docs.find(
      (j) => String((j.input as { doc?: { value?: unknown } }).doc?.value) === String(draft.id),
    );
    expect(job?.hasError).toBe(true);
    expect((job?.error as { message?: string } | null)?.message).toContain(
      approvalRule('in_review') as string,
    );
    const after = await payload.findByID({ collection: 'articles', id: draft.id, depth: 0 });
    expect(after._status).toBe('draft');
  });

  it('ED11 the save normalizer writes Persian letters and digits in the article body (H9)', async () => {
    const doc = await payload.create({
      collection: 'articles',
      data: {
        title: `علي ${unique()}`,
        body: body(paragraph(textNode('درمان در 2 جلسه، '), textNode('كامپوزيت'))),
      } as never,
      draft: true,
    });
    expect(doc.title.startsWith('علی ')).toBe(true);
    const texts = JSON.stringify(doc.body);
    expect(texts).toContain('درمان در ۲ جلسه، ');
    expect(texts).toContain('کامپوزیت');
  });

  it('ED12 article blocks: a broken block blocks publishing in Persian; complete blocks publish (H8, H6, H34)', async () => {
    const withBlock = (block: unknown) =>
      body(h2('ایمپلنت چیست'), twoLinks(), block, h2('بریج چیست'), paragraph(textNode('متن.')));
    const BLOCK = lexicalNodeRule('block node failed to validate: x') as string;
    const cases: [string, unknown, string[]][] = [
      [
        'short row',
        table(['روش', 'دوام'], ['ایمپلنت', 'بلند'], ['بریج']),
        [BLOCK, tableRowsRule([{ cells: ['', ''] }, { cells: [''] }], ['', '']) as string],
      ],
      [
        'empty cell',
        table(['روش', 'دوام'], ['ایمپلنت', '']),
        [BLOCK, tableCellsRule(['']) as string],
      ],
      ['one header (min 2)', table(['روش'], ['ایمپلنت']), [BLOCK]],
      ['empty callout', blockNode({ blockType: 'callout', tone: 'info', text: '' }), [BLOCK]],
      // Payload's upload check refuses an image as the video (the admin drawer offers videos only).
      [
        'image as video',
        blockNode({ blockType: 'video', video: ids.cover, poster: ids.cover, summary: 'خلاصه' }),
        [],
      ],
    ];
    for (const [name, block, expected] of cases) {
      const messages = await publish({ ...valid(), body: withBlock(block) });
      expect(messages, name).toEqual(expect.arrayContaining(expected));
      expect(messages.length, name).toBeGreaterThan(0);
      // H34: Lexical's «block node failed to validate: …» never reaches the editor.
      for (const message of messages) expect(message, name).not.toMatch(/[A-Za-z]/);
    }
    for (const block of [
      table(['روش', 'دوام'], ['ایمپلنت', 'بلند'], ['بریج', 'کوتاه']),
      blockNode({ blockType: 'callout', tone: 'warning', text: 'پیش از درمان بپرسید.' }),
    ]) {
      expect(
        await publish({ ...valid(), body: withBlock(block) }).catch((e: Error) => e.message),
      ).toBe('refusal: the write was accepted');
    }
  });
});
