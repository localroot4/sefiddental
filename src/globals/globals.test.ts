import type { Field } from 'payload';
import { describe, expect, it, vi } from 'vitest';

// Settings reads the environment while its module loads (the Notifier checks).
vi.stubEnv('DATABASE_URL', 'file:./.data/test.db');
vi.stubEnv('PAYLOAD_SECRET', 'p'.repeat(43));
const { Clinic } = await import('./Clinic');
const { Notifier } = await import('./Settings');

type Named = Field & {
  name?: string;
  fields?: Field[];
  tabs?: Array<{ name?: string; label?: unknown; fields: Field[] }>;
  hooks?: { beforeValidate?: Array<(args: { value: unknown }) => unknown> };
  admin?: { description?: unknown };
};

const find = (fields: readonly Field[], ...path: string[]): Named | undefined => {
  const [head, ...rest] = path;
  const field = (fields as Named[]).find((f) => f.name === head);
  return rest.length ? find(field?.fields ?? [], ...rest) : field;
};
const beforeValidate = (field: Named | undefined, value: unknown) =>
  field?.hooks?.beforeValidate?.reduce<unknown>((v, hook) => hook({ value: v }), value);

describe('settings globals (H32, phase 6 admin polish)', () => {
  it('SG1 notifier numbers accept Persian digits and any mobile form', () => {
    const phone = find(Notifier.fields, 'sms', 'adminRecipients', 'phone');
    expect(beforeValidate(phone, '۰۹۱۲ ۳۴۵ ۶۷۸۹')).toBe('+989123456789');
    expect(beforeValidate(phone, '00989123456789')).toBe('+989123456789');
    // Not a mobile: left as typed, so the validator names the problem.
    expect(beforeValidate(phone, '۰۲۱۱۲۳۴۵۶۷۸')).toBe('۰۲۱۱۲۳۴۵۶۷۸');
    expect(beforeValidate(find(Notifier.fields, 'sms', 'senderNumber'), ' ۳۰۰۰۱۲۳ ')).toBe(
      '3000123',
    );
  });

  it('SG2 the clinic form is in unnamed tabs: the stored fields stay at the top level', () => {
    const [tabs] = Clinic.fields as Named[];
    expect(tabs?.type).toBe('tabs');
    expect(tabs?.tabs?.map((tab) => [tab.name, tab.label])).toEqual([
      [undefined, 'هویت'],
      [undefined, 'تماس و نشانی'],
      [undefined, 'ساعات و تعطیلات'],
      [undefined, 'اورژانس'],
      [undefined, 'قانونی و آمار'],
    ]);
    const names = (tabs?.tabs ?? []).flatMap((tab) => (tab.fields as Named[]).map((f) => f.name));
    expect(names.sort()).toEqual(
      [
        'nameFa',
        'nameShortFa',
        'nameEn',
        'tagline',
        'taglineApproved',
        'contactHeadline',
        'footerLine',
        'domain',
        'address',
        'phones',
        'reception',
        'hours',
        'social',
        'maps',
        'stats',
        'legal',
        'emergency',
      ].sort(),
    );
  });

  it('SG3 no help text promises a channel «later»', () => {
    const descriptions = JSON.stringify(Notifier.fields);
    expect(descriptions).not.toContain('بعداً');
  });
});
