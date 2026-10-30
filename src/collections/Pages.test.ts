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
  it('PG-LP1 no collection opens a live preview tab until the preview route exists', () => {
    for (const config of [Articles, Pages, Services, Doctors]) {
      expect(config.admin?.livePreview, config.slug).toBeUndefined();
    }
  });
});
