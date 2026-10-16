import { describe, expect, it } from 'vitest';

import { needsMedicalReview } from './Pages';

describe('pages medical review (V-REVIEWER, V-SOURCES, EM-S1)', () => {
  it('PG-MR1 guides always need it; the emergency page only once it has self-care blocks', () => {
    expect(needsMedicalReview({ key: 'guide-first-visit' })).toBe(true);
    expect(needsMedicalReview({ key: 'emergency', blocks: [] })).toBe(false);
    expect(needsMedicalReview({ key: 'emergency', blocks: [{ blockType: 'content' }] })).toBe(true);
    expect(needsMedicalReview({ key: 'about', blocks: [{ blockType: 'content' }] })).toBe(false);
  });
});
