/*
 * Internal linking of the articles (H24, docs/ia.md section 5): which articles a post, a service
 * page and a dentist page list. The readers query the candidates; these pure rules pick.
 */

// docs/ia.md section 5: two related articles on a post and a service page.
export const RELATED_MAX = 2;
// docs/ia.md T-dentist: a list of the dentist's articles, not an archive.
export const DOCTOR_ARTICLES_MAX = 6;

/**
 * A post's related articles: the editor's published picks in their order, then the candidates
 * of each rule (same primary service, same category, shared tags; each list newest first), never
 * the post itself, each once, at most `max`. `lists[0]` holds the published manual picks: an
 * unpublished pick is absent from every list, so it is skipped.
 */
export function pickRelated<C extends { id: number }>(
  self: number,
  manual: readonly number[],
  lists: ReadonlyArray<readonly C[]>,
  max = RELATED_MAX,
): C[] {
  const all = lists.flat();
  const byId = new Map(all.map((item) => [item.id, item]));
  const picked: C[] = [];
  for (const item of [...manual.flatMap((id) => byId.get(id) ?? []), ...all]) {
    if (picked.length === max) break;
    if (item.id !== self && !picked.some((p) => p.id === item.id)) picked.push(item);
  }
  return picked;
}

export type ArticleRole = 'author' | 'reviewer' | 'both';

/** A dentist's articles: authored and reviewed merged, each once with its role, newest first. */
export function doctorArticles<C extends { id: number; publishedAt?: string | null }>(
  authored: readonly C[],
  reviewed: readonly C[],
  max = DOCTOR_ARTICLES_MAX,
): Array<C & { role: ArticleRole }> {
  const reviewedIds = new Set(reviewed.map((item) => item.id));
  const authoredIds = new Set(authored.map((item) => item.id));
  const merged = [
    ...authored.map((item) => ({
      ...item,
      role: (reviewedIds.has(item.id) ? 'both' : 'author') as ArticleRole,
    })),
    ...reviewed
      .filter((item) => !authoredIds.has(item.id))
      .map((item) => ({ ...item, role: 'reviewer' as ArticleRole })),
  ];
  return merged
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || b.id - a.id)
    .slice(0, max);
}
