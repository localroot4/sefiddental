import { describe, expect, it } from 'vitest';

import { clinicVcardHref } from './vcard';

const text = (href: string) =>
  decodeURIComponent(href.slice('data:text/vcard;charset=utf-8,'.length));

describe('save-contact vCard (conversion.md 5.4 item 4)', () => {
  it('VC1 name, unique phones (caller first), escaped address and site, CRLF lines', () => {
    const card = text(
      clinicVcardHref({
        name: 'کلینیک دندانپزشکی سفید',
        phones: ['+982155101054', '+982155101054', '+989205451054', ''],
        street: 'خیابان میعاد شمالی; پلاک 2, طبقه 1',
        city: 'تهران',
        site: 'https://sefiddental.ir',
      }),
    );
    expect(card.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:کلینیک دندانپزشکی سفید',
      'ORG:کلینیک دندانپزشکی سفید',
      'TEL;TYPE=WORK,VOICE:+982155101054',
      'TEL;TYPE=WORK,VOICE:+989205451054',
      'ADR;TYPE=WORK:;;خیابان میعاد شمالی\\; پلاک 2\\, طبقه 1;تهران;;;IR',
      'URL:https://sefiddental.ir',
      'END:VCARD',
      '',
    ]);
  });
});
