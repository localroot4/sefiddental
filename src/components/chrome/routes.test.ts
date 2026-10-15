import { describe, expect, it } from 'vitest';

import { currentOf, showsStickyBar } from './routes';

describe('chrome routes (nav spec 1.1, 1.7)', () => {
  it('NR1 aria-current: page on the page itself, true under it, none elsewhere', () => {
    expect(currentOf('/پزشکان', '/پزشکان')).toBe('page');
    expect(currentOf(encodeURI('/پزشکان'), '/پزشکان')).toBe('page');
    expect(currentOf('/پزشکان/دکتر-نمونه', '/پزشکان')).toBe('true');
    expect(currentOf('/پزشکان-دیگر', '/پزشکان')).toBeUndefined();
    expect(currentOf('/آدرس', '/پزشکان')).toBeUndefined();
    expect(currentOf(null, '/پزشکان')).toBeUndefined();
    // Home is no section: every path starts with "/".
    expect(currentOf('/خدمات', '/')).toBeUndefined();
    // A malformed escape compares as written instead of throwing.
    expect(currentOf('/%E0%A4%A', '/پزشکان')).toBeUndefined();
  });

  it('NR2 the sticky bar is left out only on the listed templates, encoded or not', () => {
    const hiddenOn = ['/رزرو-نوبت', '/رزرو-نوبت/ثبت-شد', '/اورژانس'];
    expect(showsStickyBar('/رزرو-نوبت', hiddenOn)).toBe(false);
    expect(showsStickyBar(encodeURI('/اورژانس'), hiddenOn)).toBe(false);
    expect(showsStickyBar('/رزرو-نوبت/ثبت-شد', hiddenOn)).toBe(false);
    expect(showsStickyBar('/خدمات/رزرو-نوبت', hiddenOn)).toBe(true);
    expect(showsStickyBar('/', hiddenOn)).toBe(true);
    expect(showsStickyBar(null, hiddenOn)).toBe(true);
  });
});
