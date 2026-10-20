import { afterEach, describe, expect, it, vi } from 'vitest';

// The readers import the Payload config; these tests cover their pure parts only.
vi.mock('./payload', () => ({ getPayloadClient: vi.fn() }));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));

const { toClinicHours, hoursOptionsFrom } = await import('./clinicHours');
const { populatedCollections } = await import('./published');
const { colTag, docTag, globTag } = await import('./tags');

describe('tags (freeze section 5)', () => {
  it('T1 tag names', () => {
    expect(colTag('services')).toBe('col:services');
    expect(docTag('services', 7)).toBe('doc:services:7');
    expect(globTag('clinic')).toBe('glob:clinic');
  });
});

describe('toClinicHours and hoursOptionsFrom (freeze 3.6)', () => {
  const clinic = {
    hours: {
      note: 'همه‌روزه',
      weekly: [{ id: 'a', days: ['sat', 'sun'], open: '10:00', close: '20:00' }],
      holidays: [
        {
          id: 'h1',
          dateJalali: '۱۴۰۵/۰۱/۰۱',
          date: '2026-03-21',
          labelFa: 'نوروز',
          open: null,
          close: null,
        },
        {
          id: 'h2',
          dateJalali: '1405/01/14',
          date: '2026-04-03',
          labelFa: 'ساعت ویژه',
          open: '10:00',
          close: '14:00',
        },
        { id: 'h3', dateJalali: 'bad', date: null, labelFa: 'خطا' },
      ],
    },
    reception: { callbackMinutes: 15 },
  } as never;

  it('CH1 weekly rules, holidays with and without hours, the note', () => {
    expect(toClinicHours(clinic)).toEqual({
      timezone: 'Asia/Tehran',
      weekly: [{ days: ['sat', 'sun'], open: '10:00', close: '20:00' }],
      holidays: [
        { date: '2026-03-21', labelFa: 'نوروز' },
        { date: '2026-04-03', labelFa: 'ساعت ویژه', open: '10:00', close: '14:00' },
      ],
      noteFa: 'همه‌روزه',
    });
  });

  it('CH2 an empty global gives an empty schedule and the default callback', () => {
    expect(toClinicHours({} as never)).toEqual({
      timezone: 'Asia/Tehran',
      weekly: [],
      holidays: [],
      noteFa: '',
    });
    expect(hoursOptionsFrom({} as never)).toEqual({ callbackMinutes: 10 });
    expect(hoursOptionsFrom(clinic)).toEqual({ callbackMinutes: 15 });
  });
});

describe('populatedCollections', () => {
  const fields = {
    services: [
      { type: 'relationship', relationTo: 'service-categories' },
      { type: 'upload', relationTo: 'media' },
      { type: 'group', fields: [{ type: 'relationship', relationTo: 'doctors' }] },
      { type: 'join', collection: 'service-tiers' },
      {
        type: 'blocks',
        blocks: [{ fields: [{ type: 'relationship', relationTo: ['pages', 'articles'] }] }],
      },
    ],
    doctors: [
      { type: 'upload', relationTo: 'media' },
      { type: 'relationship', relationTo: 'cases' },
    ],
  } as const;
  const fieldsOf = (slug: string) => (fields as unknown as Record<string, never>)[slug];

  it('PC1 depth 0 populates nothing', () => {
    expect(populatedCollections(fields.services, 0, fieldsOf)).toEqual([]);
  });

  it('PC2 depth 1 lists direct relations, nested groups, joins and blocks', () => {
    expect(populatedCollections(fields.services, 1, fieldsOf)).toEqual([
      'articles',
      'doctors',
      'media',
      'pages',
      'service-categories',
      'service-tiers',
    ]);
  });

  it('PC3 depth 2 follows into the related collections', () => {
    expect(populatedCollections(fields.services, 2, fieldsOf)).toContain('cases');
  });

  it('PC4 rich text populates its link and upload targets at depth 1, not at depth 0', () => {
    const body = [{ type: 'richText' }];
    expect(populatedCollections(body, 1, fieldsOf)).toEqual([
      'articles',
      'doctors',
      'media',
      'pages',
      'services',
    ]);
    expect(populatedCollections(body, 0, fieldsOf)).toEqual([]);
  });
});

describe('mediaPath (PAY 7.2)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load(origin?: string) {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('DATABASE_URL', 'file:./.data/test.db');
    vi.stubEnv('PAYLOAD_SECRET', 'p'.repeat(43));
    vi.stubEnv('MEDIA_PUBLIC_ORIGIN', origin ?? '');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    return (await import('./mediaPath')).mediaPath;
  }

  it('MP1 absolute URLs of this site become relative paths', async () => {
    const mediaPath = await load();
    expect(mediaPath('http://localhost:3000/api/media/file/a-1.webp?x=1')).toBe(
      '/api/media/file/a-1.webp?x=1',
    );
    expect(mediaPath('/api/media/file/a.webp')).toBe('/api/media/file/a.webp');
    expect(mediaPath(null)).toBeNull();
    expect(mediaPath('not a url')).toBeNull();
  });

  it('MP2 a file on the media origin keeps its absolute URL', async () => {
    const mediaPath = await load('https://cdn.example.com');
    expect(mediaPath('https://cdn.example.com/media/a.webp')).toBe(
      'https://cdn.example.com/media/a.webp',
    );
    expect(mediaPath('https://other.example.com/media/a.webp')).toBe('/media/a.webp');
  });
});
