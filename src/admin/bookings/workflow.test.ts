import type { PayloadRequest } from 'payload';
import { describe, expect, it } from 'vitest';

import { bookingWorkflow } from './workflow';

type Args = Parameters<typeof bookingWorkflow>[0];

const editor = { id: 7, role: 'editor', collection: 'users' };
const earlierNote = {
  id: 'n1',
  text: 'تماس اول؛ پاسخ نداد.',
  author: 7,
  at: '2026-10-15T07:00:00.000Z',
};

function run(
  data: Record<string, unknown>,
  before: Record<string, unknown>,
  user: object | null = editor,
) {
  return bookingWorkflow({
    data,
    originalDoc: before,
    operation: 'update',
    req: { user } as unknown as PayloadRequest,
  } as unknown as Args) as Record<string, unknown>;
}

describe('booking status workflow (freeze G15)', () => {
  it('BK4 a status change appends one history note with the handler and the time', () => {
    const out = run({ status: 'contacted' }, { status: 'new', adminNotes: [earlierNote] });
    const notes = out.adminNotes as Array<Record<string, unknown>>;
    expect(notes).toHaveLength(2);
    expect(notes[0]).toBe(earlierNote);
    expect(notes[1]).toMatchObject({
      text: 'وضعیت از «جدید» به «تماس گرفته شد» تغییر کرد.',
      author: 7,
      at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it('BK4b no note when the status is unchanged or without a user', () => {
    const data = { status: 'new', name: 'نام' };
    expect(run(data, { status: 'new' })).toBe(data);
    expect(run({ status: 'spam' }, { status: 'suspicious' }, null)).toEqual({ status: 'spam' });
  });

  it('BK5 staff create: «ثبت در پنل» and the manual flag; the public form and seeding are left alone', () => {
    const create = (data: Record<string, unknown>, user: object | null) =>
      bookingWorkflow({
        data,
        operation: 'create',
        req: { user } as unknown as PayloadRequest,
      } as unknown as Args);
    expect(create({ phone: '09121234567', flags: ['honeypot'] }, editor)).toEqual({
      phone: '09121234567',
      formLocation: 'admin',
      flags: ['honeypot', 'manual'],
    });
    expect(create({ phone: '09121234567' }, editor)).toMatchObject({ flags: ['manual'] });
    const form = { phone: '09121234567', formLocation: 'dialog' };
    expect(create(form, null)).toBe(form);
  });

  it('BK8 closing needs a new note in the same save; an earlier note does not count', () => {
    for (const status of ['done', 'cancelled']) {
      expect(() => run({ status }, { status: 'contacted', adminNotes: [earlierNote] })).toThrow(
        expect.objectContaining({
          data: expect.objectContaining({
            errors: [expect.objectContaining({ path: 'status' })],
          }),
        }),
      );
    }
    expect(() =>
      run(
        { status: 'done', adminNotes: [earlierNote, { text: '   ' }] },
        { status: 'contacted', adminNotes: [earlierNote] },
      ),
    ).toThrow();
    const out = run(
      { status: 'done', adminNotes: [earlierNote, { text: 'بیمار آمد و درمان انجام شد.' }] },
      { status: 'contacted', adminNotes: [earlierNote] },
    );
    expect((out.adminNotes as unknown[]).length).toBe(3);
    // Spam is not closing: bulk «علامت هرزنامه» needs no note.
    expect(() => run({ status: 'spam' }, { status: 'new' })).not.toThrow();
  });
});
