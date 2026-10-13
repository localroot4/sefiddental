import { describe, expect, it } from 'vitest';

import { allMessages, getLocale, SYSTEM_LINKS } from '@/i18n/fa';
import { STATIC_PAGE_COPY } from '@/lib/system-pages/staticPage';
import { TOO_MANY_ATTEMPTS_FA } from '@/lib/http/systemResponses';

/** Every Persian string a visitor or an admin sees from this lane. */
function visibleCopy(): string[] {
  const staticCopy = [
    STATIC_PAGE_COPY.siteName,
    STATIC_PAGE_COPY.callLabel,
    STATIC_PAGE_COPY.hoursLine,
    STATIC_PAGE_COPY.urgentLabel,
    STATIC_PAGE_COPY.linksHeading,
    ...STATIC_PAGE_COPY.links.map((l) => l.label),
    ...Object.values(STATIC_PAGE_COPY.maintenance),
    ...Object.values(STATIC_PAGE_COPY.gone),
  ];
  return [...allMessages(), ...staticCopy, TOO_MANY_ATTEMPTS_FA];
}

// copy-guidelines.md: banned words and claims, plus labels banned by conversion.md 2.
const BANNED = [
  'بهترین',
  'بی‌نظیر',
  'بینظیر',
  'تضمینی',
  'بدون درد',
  'ارزان‌ترین',
  'معجزه',
  'تماس با ما',
];

describe('Persian copy (copy-guidelines.md)', () => {
  it.each(visibleCopy())('CP1 %s', (text) => {
    for (const word of BANNED) expect(text).not.toContain(word);
    expect(text).not.toMatch(/[يكى]/); // Arabic yeh, kaf, alef maksura
    expect(text).not.toMatch(/[—–]/); // em and en dash
    expect(text).not.toMatch(/[0-9]/); // Persian digits only (phone numbers live in E.164 fields)
  });

  it('CP2 one label per intent: the call and emergency labels', () => {
    expect(allMessages()).toContain('تماس با کلینیک');
    expect(allMessages()).toContain('درد شدید دارید؟');
  });

  it('CP3 locale and system links', () => {
    expect(getLocale()).toEqual({ lang: 'fa', dir: 'rtl' });
    expect(SYSTEM_LINKS.map((l) => l.href)).toEqual(STATIC_PAGE_COPY.links.map((l) => l.href));
  });
});
