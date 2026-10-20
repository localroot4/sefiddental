import { describe, expect, it } from 'vitest';

import { APPROVE_ADMIN_ONLY, reviewGate } from './review';

type Data = Record<string, unknown>;
const editor = { id: 2, role: 'editor' };
const admin = { id: 1, role: 'admin' };
const paragraph = (...children: unknown[]) => ({ type: 'paragraph', children });
const tree = (...children: unknown[]) => ({ root: { type: 'root', children } });
const lexical = (text: string) => tree(paragraph({ type: 'text', text }));
const serviceLink = (value: unknown) => ({
  type: 'link',
  fields: { linkType: 'internal', doc: { relationTo: 'services', value } },
  children: [{ type: 'text', text: 'خدمت' }],
});
const image = (value: unknown) => ({ type: 'upload', relationTo: 'media', value });
const video = (file: unknown, poster: unknown) => ({
  type: 'block',
  fields: { blockType: 'video', video: file, poster, summary: 'خلاصهٔ ویدیو' },
});
// The approved body: text, a service link, an inline image and a video block.
const reviewedBody = (
  link: unknown = 3,
  img: unknown = 7,
  file: unknown = 8,
  poster: unknown = 9,
) =>
  tree(
    paragraph({ type: 'text', text: 'متن تأییدشده' }, serviceLink(link)),
    image(img),
    video(file, poster),
  );
const approved: Data = {
  title: 'ایمپلنت یا بریج',
  excerpt: 'خلاصه',
  body: reviewedBody(),
  faqs: [{ id: 'f1', question: 'پرسش', answer: 'پاسخ' }],
  sources: [{ id: 's1', title: 'ADA', url: 'https://www.ada.org/x', publisher: 'ADA' }],
  tags: [3],
  reviewState: 'approved',
};

const run = (user: object | null, data: Data, originalDoc?: Data) =>
  (reviewGate as unknown as (args: object) => Data)({
    data,
    originalDoc,
    operation: originalDoc ? 'update' : 'create',
    req: { user, t: undefined },
  });

describe('H5 review gate (C1: every article)', () => {
  it('RV1 an editor cannot set «تأییدشده»; an admin can', () => {
    let error: unknown;
    try {
      run(
        editor,
        { ...approved, reviewState: 'approved' },
        { ...approved, reviewState: 'in_review' },
      );
    } catch (err) {
      error = err;
    }
    expect(error).toMatchObject({
      data: { errors: [{ path: 'reviewState', message: APPROVE_ADMIN_ONLY }] },
    });
    expect(() => run(editor, { title: 'تازه', reviewState: 'approved' })).toThrow();
    expect(
      run(admin, { reviewState: 'approved' }, { ...approved, reviewState: 'in_review' }),
    ).toMatchObject({ reviewState: 'approved' });
    expect(
      run(editor, { reviewState: 'in_review' }, { ...approved, reviewState: 'writing' }),
    ).toMatchObject({ reviewState: 'in_review' });
  });

  it('RV2 an editor change of reviewed content (text, link target, image, video, poster) re-opens review', () => {
    const edits: Data[] = [
      { title: 'ایمپلنت یا بریج؛ نسخهٔ تازه' },
      { excerpt: 'خلاصهٔ تازه' },
      { body: lexical('متن تازه') },
      { body: reviewedBody(4) },
      { body: reviewedBody(3, 70) },
      { body: reviewedBody(3, 7, 80) },
      { body: reviewedBody(3, 7, 8, 90) },
      { faqs: [{ id: 'f1', question: 'پرسش', answer: 'پاسخ تازه' }] },
      { sources: [] },
    ];
    for (const edit of edits) {
      expect(run(editor, { ...approved, ...edit }, approved).reviewState).toBe('in_review');
    }
  });

  it('RV3 other edits, a bare publish and new row ids keep the approval', () => {
    expect(run(editor, { ...approved, tags: [3, 4] }, approved).reviewState).toBe('approved');
    expect(run(editor, { _status: 'published' }, approved)).toEqual({ _status: 'published' });
    const sameRows = {
      ...approved,
      faqs: [{ id: 'other', question: 'پرسش', answer: 'پاسخ' }],
      body: structuredClone(approved.body),
    };
    expect(run(editor, sameRows, approved).reviewState).toBe('approved');
    // The same media and link targets, populated by the admin form, keep it too.
    const populated = reviewedBody({ id: 3 }, { id: 7, url: '/media/x.jpg' }, { id: 8 }, '9');
    expect(run(editor, { ...approved, body: populated }, approved).reviewState).toBe('approved');
  });

  it('RV4 an admin edit or a server write (no user) does not reset', () => {
    expect(run(admin, { ...approved, body: lexical('اصلاح مدیر') }, approved).reviewState).toBe(
      'approved',
    );
    expect(run(null, { ...approved, title: 'از سرور' }, approved).reviewState).toBe('approved');
  });
});
