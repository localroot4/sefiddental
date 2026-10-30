import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload';

import { BOOKING_STATUS_LABELS, type BookingStatus, PRIORITY_REMOVED } from '@/hooks/booking';
import { adminText } from '@/i18n/fa-admin';
import { invalid } from '@/hooks/errors';

/** Moving into these ends the follow-up, so the handler writes what happened first. */
const CLOSING_STATUSES: readonly BookingStatus[] = ['done', 'cancelled'];

type Row = Record<string, unknown>;

/**
 * G15 status workflow, after bookingRules (which checked the move and stamped new notes): a
 * staff status change appends a history note with the handler and the time, since editors cannot
 * read the audit log, and closing a request needs a note of the handler's own in the same save.
 * A request staff create (a phone call) is marked «ثبت دستی» from «ثبت در پنل» (4.11). Writes
 * without a user (the public form, seeding) are left alone.
 */
export const bookingWorkflow: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!req.user) return data;
  if (operation === 'create') {
    const flags = Array.isArray(data.flags) ? (data.flags as string[]) : [];
    return { ...data, formLocation: 'admin', flags: [...new Set([...flags, 'manual'])] };
  }
  if (operation !== 'update') return data;
  const before = (originalDoc ?? {}) as Row;
  const from = (before.status ?? 'new') as BookingStatus;
  const to = (data.status ?? from) as BookingStatus;
  if (from === to) return data;

  const earlier = (before.adminNotes ?? []) as Row[];
  const notes = (Array.isArray(data.adminNotes) ? data.adminNotes : earlier) as Row[];
  const earlierIds = new Set(earlier.map((row) => row.id));
  const wroteNote = notes.some(
    (row) => !earlierIds.has(row.id) && typeof row.text === 'string' && row.text.trim() !== '',
  );
  if (CLOSING_STATUSES.includes(to) && !wroteNote) {
    throw invalid(
      'bookings',
      [
        {
          path: 'status',
          message: adminText('admin.workflow.closeNote', { to: BOOKING_STATUS_LABELS[to] }),
        },
      ],
      req.t,
    );
  }
  const history = {
    text: adminText('admin.workflow.history', {
      from: BOOKING_STATUS_LABELS[from],
      to: BOOKING_STATUS_LABELS[to],
    }),
    author: req.user.id,
    at: new Date().toISOString(),
  };
  return { ...data, adminNotes: [...notes, history] };
};

const flagged = (doc: unknown) =>
  ((doc as Row | undefined)?.flags as string[] | undefined)?.includes(PRIORITY_REMOVED) ?? false;

/**
 * 4.10: «اولویت فوری برداشته شد» on any request of a phone ranks all its emergencies as regular,
 * but bookingRules ranks a row only when it is saved, and it counts this row's flag as stored
 * before the save. So when the flag changes, the phone's open emergencies (this one too) are
 * saved again, in the same transaction, without audit rows.
 */
export const rerankPhone: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  if (flagged(doc) === flagged(previousDoc) || typeof doc.phone !== 'string') return doc;
  const open = await req.payload.find({
    collection: 'bookings',
    where: {
      and: [
        { phone: { equals: doc.phone } },
        { kind: { equals: 'emergency' } },
        { status: { in: ['new', 'contacted'] } },
      ],
    },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  });
  // A nested call writes its context into this req (createLocalReq): keep the caller's audit.
  const context = req.context;
  try {
    for (const row of open.docs) {
      await req.payload.update({
        collection: 'bookings',
        id: row.id,
        data: {},
        depth: 0,
        overrideAccess: true,
        context: { skipAudit: true },
        req,
      });
    }
  } finally {
    req.context = context;
  }
  return doc;
};
