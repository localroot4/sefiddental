import { describe, expect, it } from 'vitest';

import { doctorArticles, pickRelated } from './related';

const card = (
  id: number,
  publishedAt = `2026-09-${String(id).padStart(2, '0')}T08:00:00.000Z`,
) => ({
  id,
  publishedAt,
});

describe('related articles (H24)', () => {
  it('RA1 manual picks come first, in the editor order', () => {
    const manual = [card(4), card(9)];
    const service = [card(7), card(6)];
    expect(pickRelated(1, [9, 4], [manual, service]).map((c) => c.id)).toEqual([9, 4]);
  });

  it('RA2 a manual pick that is not published (absent from the lists) is skipped, the fallbacks fill in', () => {
    const service = [card(7), card(6)];
    expect(pickRelated(1, [3], [[], service]).map((c) => c.id)).toEqual([7, 6]);
  });

  it('RA3 fallbacks in rule order: same service, then same category, then shared tags', () => {
    const service = [card(7)];
    const category = [card(8), card(5)];
    const tags = [card(2)];
    expect(pickRelated(1, [], [[], service, category, tags]).map((c) => c.id)).toEqual([7, 8]);
    expect(pickRelated(1, [], [[], [], [], tags]).map((c) => c.id)).toEqual([2]);
  });

  it('RA4 never the article itself, never twice, at most 2', () => {
    const self = card(1);
    const service = [self, card(7)];
    const category = [card(7), self, card(8), card(5)];
    const picked = pickRelated(1, [1, 7], [[self, card(7)], service, category]);
    expect(picked.map((c) => c.id)).toEqual([7, 8]);
    expect(pickRelated(1, [], [[], [], []])).toEqual([]);
  });

  it('RA5 a dentist page lists authored and reviewed articles once each, newest first, with the role', () => {
    const authored = [card(3), card(8)];
    const reviewed = [card(8), card(5)];
    expect(doctorArticles(authored, reviewed).map((c) => [c.id, c.role])).toEqual([
      [8, 'both'],
      [5, 'reviewer'],
      [3, 'author'],
    ]);
  });

  it('RA6 a dentist page lists at most 6 articles', () => {
    const authored = Array.from({ length: 5 }, (_, i) => card(i + 1));
    const reviewed = Array.from({ length: 5 }, (_, i) => card(i + 11));
    const list = doctorArticles(authored, reviewed);
    expect(list).toHaveLength(6);
    expect(list[0]?.id).toBe(15);
  });
});
