import { describe, expect, it } from 'vitest';

import { Articles } from './Articles';
import { Doctors } from './Doctors';
import { needsMedicalReview, Pages } from './Pages';
import { Services } from './Services';

describe('pages medical review (V-REVIEWER, V-SOURCES, EM-S1)', () => {
  it('PG-MR1 guides always need it; the emergency page only once it has self-care blocks', () => {
    expect(needsMedicalReview({ key: 'guide-first-visit' })).toBe(true);
    expect(needsMedicalReview({ key: 'emergency', blocks: [] })).toBe(false);
    expect(needsMedicalReview({ key: 'emergency', blocks: [{ blockType: 'content' }] })).toBe(true);
    expect(needsMedicalReview({ key: 'about', blocks: [{ blockType: 'content' }] })).toBe(false);
  });
});

describe('live preview (H10)', () => {
  it('PG-LP1 four collections open the server-side draft route of the document', () => {
    for (const config of [Articles, Pages, Services, Doctors]) {
      const url = config.admin?.livePreview?.url;
      expect(typeof url, config.slug).toBe('function');
      const make = url as unknown as (args: { data: { id: number } }) => string;
      expect(make({ data: { id: 42 } })).toBe(`/api/preview?collection=${config.slug}&id=42`);
    }
  });
});
