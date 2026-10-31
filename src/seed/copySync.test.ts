import { describe, expect, it } from 'vitest';

import { fieldStatus, isCopy } from './copySync';

describe('copy-sync field rules', () => {
  it('CSU1 three-way: unchanged, updated over the baseline, edited by hand otherwise', () => {
    expect(fieldStatus('new', 'old', 'new')).toBe('unchanged');
    expect(fieldStatus('old', 'old', 'new')).toBe('updated');
    expect(fieldStatus('hand', 'old', 'new')).toBe('edited-by-hand');
    // A field the baseline did not set: an empty value is untouched, any other is a hand edit.
    expect(fieldStatus(null, undefined, 'new')).toBe('updated');
    expect(fieldStatus('hand', undefined, 'new')).toBe('edited-by-hand');
    // Stored rows carry ids the seed does not set.
    expect(fieldStatus([{ id: 'a', q: 'old' }], [{ q: 'old' }], [{ q: 'new' }])).toBe('updated');
  });

  it('CSU2 only copy fields are written: never a slug, price, order, relation or noindex', () => {
    for (const field of ['body', 'faqs', 'facts.recovery', 'seo.title', 'seo.description'])
      expect(isCopy(field), field).toBe(true);
    for (const field of [
      'slug',
      'key',
      'priceFrom',
      'order',
      'category',
      'relatedServices',
      'service',
      'to',
      'seo.noindex',
      'scopeVerified',
    ])
      expect(isCopy(field), field).toBe(false);
  });
});
