import { type CollectionBeforeValidateHook, ValidationError } from 'payload';

import { hasRole } from '@/access/roles';
import { lexicalRefs, lexicalText } from '@/fields/validators';

export const APPROVE_ADMIN_ONLY =
  'فقط مدیر می‌تواند مقاله را «تأییدشده» کند. مرحله را «منتظر بازبینی» بگذارید.';

type Row = {
  question?: unknown;
  answer?: unknown;
  title?: unknown;
  url?: unknown;
  publisher?: unknown;
};
const rows = (value: unknown): Row[] => (Array.isArray(value) ? (value as Row[]) : []);

/**
 * What the reviewing dentist approved: title, excerpt, the text of the body (blocks included),
 * what it links and shows (link targets, images, video files), FAQs and sources. Row ids and
 * formatting are left out, so a re-save of the same content keeps the approval.
 */
function reviewedContent(doc: Record<string, unknown>): string {
  return JSON.stringify([
    doc.title ?? '',
    doc.excerpt ?? '',
    lexicalText(doc.body),
    lexicalRefs(doc.body),
    rows(doc.faqs).map((f) => [f.question ?? '', f.answer ?? '']),
    rows(doc.sources).map((s) => [s.title ?? '', s.url ?? '', s.publisher ?? '']),
  ]);
}

/**
 * H5 with C1: only an admin sets «تأییدشده»; an editor's change of reviewed content returns an
 * approved article to «منتظر بازبینی». Runs before validation, so the publish gate (V-APPROVAL)
 * sees the reset in the same save. Server writes without a user (seeder, jobs as system) pass.
 */
export const reviewGate: CollectionBeforeValidateHook = ({ data, originalDoc, req }) => {
  if (!data || !req.user || hasRole(req.user, 'admin')) return data;
  const before = (originalDoc?.reviewState as string | undefined) ?? 'writing';
  const wanted = (data.reviewState as string | undefined) ?? before;
  if (wanted === 'approved' && before !== 'approved') {
    throw new ValidationError(
      { collection: 'articles', errors: [{ path: 'reviewState', message: APPROVE_ADMIN_ONLY }] },
      req.t,
    );
  }
  if (before === 'approved' && originalDoc) {
    const changed = reviewedContent({ ...originalDoc, ...data }) !== reviewedContent(originalDoc);
    if (changed) return { ...data, reviewState: 'in_review' };
  }
  return data;
};
