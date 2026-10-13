import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  GlobalAfterChangeHook,
  PayloadRequest,
} from 'payload';
import { revalidateTag } from 'next/cache';

import { colTag, docTag, globTag } from '@/lib/data/tags';
import { logFor } from '@/lib/log/logger';

import { ctx, requestIdOf } from './context';

/**
 * H-REVAL (freeze decision 46, section 5): tags only, never revalidatePath. Content uses the
 * 'max' profile (stale while revalidating); redirects and globals expire at once, so a phone,
 * hours or redirect change shows on the next request. Never throws: outside a Next.js request
 * revalidateTag throws, and the save must still succeed.
 */
type Profile = 'max' | { expire: 0 };

export const EXPIRE_NOW: Profile = { expire: 0 };

export function revalidateTags(req: PayloadRequest, tags: string[], profile: Profile): void {
  if (ctx(req).skipRevalidate) return;
  for (const tag of tags) {
    try {
      revalidateTag(tag, profile);
    } catch (err) {
      logFor(requestIdOf(req), 'hook:revalidate').warn(
        { tag, err: err instanceof Error ? err.message : String(err) },
        'revalidate skipped: no Next.js request scope',
      );
    }
  }
}

/**
 * Collection hooks. With drafts, a save matters to the public site when the document is
 * published now or the previous state was published (unpublish); a draft save of a draft does
 * not. `docTags: false` (redirects) revalidates the collection tag only.
 */
export function revalidateCollection(slug: string, profile: Profile = 'max', docTags = true) {
  const tagsFor = (id: number | string) =>
    docTags ? [colTag(slug), docTag(slug, id)] : [colTag(slug)];
  const afterChange: CollectionAfterChangeHook = ({ doc, previousDoc, req, collection }) => {
    const drafts = Boolean(collection.versions?.drafts);
    const visible = !drafts || doc?._status === 'published' || previousDoc?._status === 'published';
    if (visible) revalidateTags(req, tagsFor(doc.id), profile);
    return doc;
  };
  const afterDelete: CollectionAfterDeleteHook = ({ doc, req }) => {
    revalidateTags(req, tagsFor(doc.id), profile);
    return doc;
  };
  return { afterChange, afterDelete };
}

export function revalidateGlobal(slug: string): GlobalAfterChangeHook {
  return ({ doc, req }) => {
    revalidateTags(req, [globTag(slug)], EXPIRE_NOW);
    return doc;
  };
}
