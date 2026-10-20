import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { approvalRule, headingsRule } from '@/fields/validators';

import { ArticleChecklist } from './ArticleChecklist';
import { SerpPreview } from './SerpPreview';

const h = vi.hoisted(() => ({
  fields: {} as Record<string, { value: unknown }>,
  collectionSlug: 'articles',
}));

vi.mock('@payloadcms/ui', () => ({
  useAllFormFields: () => [h.fields, () => {}],
  useDocumentInfo: () => ({ collectionSlug: h.collectionSlug, id: 12 }),
}));

const text = (value: string) => ({ type: 'text', text: value });
const h2 = (value: string) => ({ type: 'heading', tag: 'h2', children: [text(value)] });
const docLink = (relationTo: string, value: number) => ({
  type: 'link',
  fields: { linkType: 'internal', doc: { relationTo, value } },
  children: [text('پیوند')],
});
const state = (...children: unknown[]) => ({ root: { type: 'root', children } });
const form = (values: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(values).map(([path, value]) => [path, { value }]));

const ARTICLE = {
  title: 'ایمپلنت یا بریج برای دندان',
  slug: 'ایمپلنت-یا-بریج',
  excerpt: 'خلاصهٔ کوتاه',
  cover: 7,
  authorDoctor: 2,
  isMedical: true,
  primaryService: 4,
  body: state(h2('یک'), h2('دو'), {
    type: 'paragraph',
    children: [docLink('services', 4), docLink('pages', 9)],
  }),
  'sources.0.title': 'ADA',
  'sources.0.url': 'https://www.ada.org/x',
  reviewer: 2,
  reviewedAt: '2026-10-10T08:30:00.000Z',
  reviewState: 'approved',
  'seo.title': '',
  'seo.description': 'ب'.repeat(130),
};

/** REST answers of the checklist lookups, by URL prefix. */
function mockApi(overrides: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {
    '/api/media/7': { id: 7, alt: 'لبخند بیمار' },
    '/api/doctors/2': { id: 2, _status: 'published' },
    '/api/services?': { docs: [{ id: 4, navLabel: 'ایمپلنت دندان', _status: 'published' }] },
    '/api/services/4': { id: 4, navLabel: 'ایمپلنت دندان' },
    '/api/pages?': {
      docs: [{ id: 9, title: 'راهنما', key: 'guide-aftercare', _status: 'published' }],
    },
    ...overrides,
  };
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = decodeURIComponent(String(input));
    const key = Object.keys(answers).find((prefix) => url.startsWith(prefix));
    return new Response(JSON.stringify(key ? answers[key] : {}), { status: key ? 200 : 404 });
  });
}

describe('ArticleChecklist (H11, C26)', () => {
  beforeEach(() => {
    h.collectionSlug = 'articles';
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('EC1 a complete article: every line passes after the lookups, with the manual steps', async () => {
    h.fields = form(ARTICLE);
    const fetch = mockApi();
    render(<ArticleChecklist />);
    const list = screen.getByRole('list', { name: 'پیش از انتشار' });
    await waitFor(() => expect(within(list).getAllByText('انجام شد')).toHaveLength(13));
    expect(screen.getByText('۱۳ از ۱۳ مورد انجام شده است.')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'برای نوشتن' }).children).toHaveLength(6);
    expect(fetch.mock.calls.map(([url]) => decodeURIComponent(String(url)))).toContain(
      '/api/media/7?depth=0&select[alt]=true',
    );
  });

  it('EC2 a failing line shows the publish message; the count drops', async () => {
    h.fields = form({ ...ARTICLE, body: state(h2('یک')), reviewState: 'in_review' });
    mockApi({ '/api/services?': { docs: [] }, '/api/pages?': { docs: [] } });
    render(<ArticleChecklist />);
    await waitFor(() => expect(screen.getByText(approvalRule('in_review') as string)).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('در حال بررسی')).toBeNull());
    expect(screen.getByText(headingsRule(state(h2('یک'))) as string)).toBeTruthy();
    // The two links were removed with the body: the link line asks for the primary service.
    expect(
      screen.getByText('در متن به خدمت اصلی مقاله («ایمپلنت دندان») پیوند بدهید.'),
    ).toBeTruthy();
    expect(screen.getByText('۱۰ از ۱۳ مورد انجام شده است.')).toBeTruthy();
  });

  it('EC3 a draft guide link and a missing cover alt name their fix', async () => {
    h.fields = form(ARTICLE);
    mockApi({
      '/api/media/7': { id: 7, alt: 'IMG_1234' },
      '/api/pages?': {
        docs: [{ id: 9, title: 'راهنما', key: 'guide-aftercare', _status: 'draft' }],
      },
    });
    render(<ArticleChecklist />);
    await waitFor(() =>
      expect(
        screen.getByText(
          'پیوند «راهنما» به صفحه‌ای منتشرنشده می‌رود و در سایت کار نمی‌کند. آن را بردارید یا صفحه‌ای منتشرشده را پیوند دهید.',
        ),
      ).toBeTruthy(),
    );
    expect(
      screen.getByText('متن جایگزین نام فایل است. آنچه در تصویر دیده می‌شود را به فارسی بنویسید.'),
    ).toBeTruthy();
  });
});

describe('SerpPreview (H11, C24)', () => {
  it('SP1 effective title with the suffix, the Persian path, counts in Persian digits', () => {
    h.collectionSlug = 'articles';
    h.fields = form({
      title: 'ایمپلنت یا بریج برای دندان',
      slug: 'ایمپلنت-یا-بریج',
      'seo.title': '',
      'seo.description': 'ب'.repeat(130),
    });
    render(<SerpPreview topic={['{title}']} suffix="titleSuffix" />);
    expect(screen.getByText('ایمپلنت یا بریج برای دندان | کلینیک دندانپزشکی سفید')).toBeTruthy();
    expect(screen.getByText('/مقالات/ایمپلنت-یا-بریج')).toBeTruthy();
    expect(screen.getByText(/عنوان: ۵۱ نویسه/)).toBeTruthy();
    expect(screen.getByText(/توضیح: ۱۳۰ نویسه/)).toBeTruthy();
    expect(screen.getByText('اندازهٔ عنوان مناسب است.')).toBeTruthy();
  });

  it('SP2 truncation and short warnings; an empty description says what Google does', () => {
    h.collectionSlug = 'services';
    h.fields = form({ h1: 'ا'.repeat(40), slug: 'خدمت', 'seo.title': '', 'seo.description': '' });
    const { unmount } = render(<SerpPreview topic={['{h1}']} suffix="titleSuffix" />);
    expect(
      screen.getByText('بلندتر از ۶۰ نویسه؛ در گوگل بریده می‌شود و انتشار ممکن نیست.'),
    ).toBeTruthy();
    expect(
      screen.getByText('توضیح سئو خالی است؛ گوگل خودش تکه‌ای از متن صفحه را نشان می‌دهد.'),
    ).toBeTruthy();
    unmount();
    h.fields = form({ h1: 'لمینت', slug: 'لمینت', 'seo.title': '', 'seo.description': 'کوتاه' });
    render(<SerpPreview topic={['{h1}']} suffix="titleSuffix" />);
    expect(
      screen.getByText('کوتاه‌تر از ۵۰ نویسه؛ ۵۰ تا ۶۰ نویسه جای بیشتری در گوگل می‌گیرد.'),
    ).toBeTruthy();
    expect(screen.getByText('توضیح سئو باید بین ۱۲۰ تا ۱۶۰ نویسه باشد.')).toBeTruthy();
  });
});
