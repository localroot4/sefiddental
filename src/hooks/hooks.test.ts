import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

const { changedFields, updateAction } = await import('./audit');
const { rewritePhoneSearch, STATUS_TRANSITIONS, transitionRule, urgencyRank } =
  await import('./booking');
const { articleComputed, pagePath } = await import('./computed');
const { hashedName, MEDIA_MESSAGES, mediaProblem } = await import('./media');
const { normalizeData } = await import('./normalize');
const { normalizeRedirect, normalizeTarget } = await import('./redirects');
const { revalidateTags } = await import('./revalidate');
const { revalidateTag } = await import('next/cache');

const MiB = 1024 * 1024;

describe('H-NORM (spec-data 6.2)', () => {
  it('HN1 prose gets typography, names only the defaults, other fields untouched', () => {
    const data = {
      title: 'كامپوزيت  دندان(ونير)',
      name: 'علي  رضايي',
      slug: 'كامپوزيت',
      faqs: [{ question: 'چرا ؟', answer: 'پاسخ' }],
      degrees: ['دكترا', 'كارشناسي'],
    };
    const out = normalizeData(data, {
      prose: ['title', 'faqs.*.question', 'degrees'],
      names: ['name'],
    });
    expect(out.title).toBe('کامپوزیت دندان (ونیر)');
    expect(out.name).toBe('علی رضایی');
    expect(out.slug).toBe('كامپوزيت');
    expect(out.faqs[0]?.question).toBe('چرا؟');
    expect(out.degrees).toEqual(['دکترا', 'کارشناسی']);
  });

  it('HN2 idempotent and tolerant of missing paths', () => {
    const spec = { prose: ['title', 'facts.sessions', 'faqs.*.answer'] };
    const once = normalizeData({ title: 'الف  ،ب', facts: null }, spec);
    expect(normalizeData(once, spec)).toEqual(once);
    expect(normalizeData({}, spec)).toEqual({});
  });
});

describe('H-AUDIT helpers (spec-data 6.5)', () => {
  it('AU1 changed field paths without values; timestamps and populated depth ignored', () => {
    const before = {
      id: 1,
      title: 'الف',
      updatedAt: 'a',
      category: 3,
      facts: { sessions: '۲' },
      faqs: [{ id: 'x', q: 'a' }],
    };
    const after = {
      id: 1,
      title: 'ب',
      updatedAt: 'b',
      category: { id: 3, createdAt: 'c', title: 'cat' },
      facts: { sessions: '۳' },
      faqs: [
        { id: 'x', q: 'a' },
        { id: 'y', q: 'b' },
      ],
    };
    expect(changedFields(before, after)).toEqual(['facts.sessions', 'faqs.1.q', 'title']);
    expect(changedFields({ sessions: [1], name: 'a' }, { sessions: [2], name: 'a' })).toEqual([]);
  });

  it('AU2 actions from the states before and after', () => {
    expect(updateAction({ _status: 'draft' }, { _status: 'published' })).toBe('publish');
    expect(updateAction({ _status: 'published' }, { _status: 'draft' }, 'draft')).toBe('unpublish');
    // A draft save of a published document leaves the main row published.
    expect(updateAction({ _status: 'published' }, { _status: 'draft' }, 'published')).toBe(
      'update',
    );
    expect(updateAction({}, { deletedAt: 'now' })).toBe('trash');
    expect(updateAction({ deletedAt: 'then' }, {})).toBe('restore');
    expect(updateAction({ _status: 'published' }, { _status: 'published' })).toBe('update');
  });
});

describe('H-BOOKING (spec-data 6.9)', () => {
  it('BK1 every cell of the transition table', () => {
    const all = Object.keys(STATUS_TRANSITIONS) as (keyof typeof STATUS_TRANSITIONS)[];
    for (const from of all) {
      for (const to of all) {
        const allowed = from === to || STATUS_TRANSITIONS[from].includes(to);
        expect(transitionRule(from, to) === true, `${from} -> ${to}`).toBe(allowed);
      }
    }
    expect(transitionRule('done', 'new')).toBe('تغییر وضعیت از «انجام شد» به «جدید» مجاز نیست.');
  });

  it('BK2 urgency rank: emergencies first unless priority was removed', () => {
    expect(urgencyRank({ kind: 'emergency', status: 'new', priorityRemoved: false })).toBe(0);
    expect(urgencyRank({ kind: 'emergency', status: 'contacted', priorityRemoved: false })).toBe(0);
    expect(urgencyRank({ kind: 'emergency', status: 'new', priorityRemoved: true })).toBe(1);
    expect(urgencyRank({ kind: 'regular', status: 'contacted', priorityRemoved: false })).toBe(2);
    expect(urgencyRank({ kind: 'regular', status: 'scheduled', priorityRemoved: false })).toBe(3);
    expect(urgencyRank({ kind: 'regular', status: 'suspicious', priorityRemoved: false })).toBe(4);
    expect(urgencyRank({ kind: 'emergency', status: 'done', priorityRemoved: false })).toBe(9);
  });

  it.each([
    ['PS1', '۰۹۱۲ ۳۴۵ ۶۷۸۹', '9123456789'],
    ['PS2', '+98 912 345 6789', '9123456789'],
    ['PS3', '00989123456789', '9123456789'],
    ['PS4', '9123456789', '9123456789'],
    ['PS5', '۹۱۲', '912'],
  ])('%s H-PHONESEARCH rewrites «%s»', (_id, query, fragment) => {
    expect(
      rewritePhoneSearch({ or: [{ phoneNational: { like: query } }, { name: { like: query } }] }),
    ).toEqual({
      or: [{ phoneNational: { contains: fragment } }, { name: { like: query } }],
    });
  });

  it('PS6 exact matches and names: equals stays, names get Persian letters', () => {
    expect(rewritePhoneSearch({ phone: { equals: '+989123456789' } })).toEqual({
      phone: { equals: '+989123456789' },
    });
    expect(rewritePhoneSearch({ name: { like: 'علي' } })).toEqual({ name: { like: 'علی' } });
    expect(rewritePhoneSearch({ phone: { like: 'علی' } })).toEqual({ phone: { like: 'علی' } });
  });
});

describe('H-MEDIA (spec-data 7.3, 7.5)', () => {
  it('MD1 limits and messages', () => {
    expect(
      mediaProblem({ mimetype: 'image/jpeg', size: MiB, width: 2000, height: 1500 }),
    ).toBeNull();
    expect(mediaProblem({ mimetype: 'image/svg+xml', size: 10 })).toBe(MEDIA_MESSAGES.type);
    expect(mediaProblem({ mimetype: 'image/jpeg', size: 21 * MiB })).toBe(MEDIA_MESSAGES.imageSize);
    expect(mediaProblem({ mimetype: 'video/mp4', size: 59 * MiB })).toBeNull();
    expect(mediaProblem({ mimetype: 'video/mp4', size: 61 * MiB })).toBe(MEDIA_MESSAGES.videoSize);
    expect(mediaProblem({ mimetype: 'image/png', size: 10, width: 10000, height: 6000 })).toBe(
      MEDIA_MESSAGES.pixels,
    );
    expect(mediaProblem({ mimetype: 'image/png', size: 10, width: 300, height: 200 })).toBe(
      MEDIA_MESSAGES.tooSmall,
    );
  });

  it('MD2 content-hashed names keep the extension and a Persian base', () => {
    const sha = 'a'.repeat(64);
    expect(hashedName('عکس پذیرش.JPG', 'image/jpeg', sha)).toBe('عکس-پذیرش-aaaaaaaaaa.jpg');
    expect(hashedName('IMG_0001.png', 'image/png', sha)).toBe('img-۰۰۰۱-aaaaaaaaaa.png');
    expect(hashedName('---', 'image/webp', sha)).toBe('file-aaaaaaaaaa.webp');
    expect(hashedName('clip', 'video/mp4', sha)).toBe('clip-aaaaaaaaaa.mp4');
  });
});

describe('H-REDIRVALID normalization (spec-data 2.13)', () => {
  it('RD1 from and to are normalized; the fragment is kept; 410 has no target', () => {
    expect(normalizeTarget('/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA/ترمیم-دندان/#سطح-ترمیم')).toBe(
      '/خدمات/ترمیم-دندان#سطح-ترمیم',
    );
    const hook = normalizeRedirect as unknown as (args: {
      data: Record<string, unknown>;
    }) => Record<string, unknown>;
    expect(hook({ data: { from: ' /VIP/ ', to: '/خدمات/', statusCode: '301' } })).toEqual({
      from: '/vip',
      to: '/خدمات',
      statusCode: '301',
    });
    expect(hook({ data: { from: '/old', to: '/x', statusCode: '410' } }).to).toBeNull();
  });
});

describe('H-PATHCOMPUTE and H-READTIME, H-PUBDATE (spec-data 6.8)', () => {
  type Hook = (args: {
    data: Record<string, unknown>;
    originalDoc?: Record<string, unknown>;
  }) => Record<string, unknown>;
  const pages = pagePath as unknown as Hook;
  const articles = articleComputed as unknown as Hook;

  it('PP1 hub slugs are fixed by the key; guides keep their own slug', () => {
    expect(pages({ data: { key: 'pricing', slug: 'دیگر' } })).toMatchObject({
      slug: 'هزینه-و-پرداخت',
      path: '/هزینه-و-پرداخت',
    });
    expect(pages({ data: { key: 'home', slug: 'x' } })).toMatchObject({ slug: null, path: '/' });
    expect(
      pages({ data: { slug: 'ترس' }, originalDoc: { key: 'guide-dental-fear' } }),
    ).toMatchObject({
      path: '/راهنمای-بیمار/ترس',
    });
  });

  it('PD1 publishedAt is set on the first publish only; reading time from the body', () => {
    const first = articles({ data: { _status: 'published', body: null } });
    expect(typeof first.publishedAt).toBe('string');
    expect(first.readingTime).toBe(1);
    expect(
      articles({ data: { _status: 'published' }, originalDoc: { publishedAt: 'x' } }).publishedAt,
    ).toBeUndefined();
    expect(articles({ data: { _status: 'draft' } }).publishedAt).toBeUndefined();
  });
});

describe('H-REVAL (freeze decision 46)', () => {
  it('RV1 tags with the profile; skipped by the flag; a throw is logged, not raised', () => {
    const mock = vi.mocked(revalidateTag);
    const req = { context: {}, headers: new Headers() } as never;
    revalidateTags(req, ['col:services', 'doc:services:1'], 'max');
    expect(mock.mock.calls).toEqual([
      ['col:services', 'max'],
      ['doc:services:1', 'max'],
    ]);
    mock.mockClear();
    revalidateTags({ context: { skipRevalidate: true } } as never, ['glob:clinic'], { expire: 0 });
    expect(mock).not.toHaveBeenCalled();
    mock.mockImplementationOnce(() => {
      throw new Error('Invariant: static generation store missing');
    });
    expect(() => revalidateTags(req, ['glob:clinic'], { expire: 0 })).not.toThrow();
  });
});
