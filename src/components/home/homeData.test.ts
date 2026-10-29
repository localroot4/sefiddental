import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getServiceTree } from '@/lib/data/catalog';
import { getCases, getDoctors, getGuides, getTestimonials } from '@/lib/data/content';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';

import { getHomeData } from './homeData';

const env = vi.hoisted(() => ({ demoContent: false }));
vi.mock('@/lib/env', () => ({ readEnv: () => env }));
vi.mock('@/lib/data/catalog', () => ({ getServiceTree: vi.fn() }));
vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getFeatures: vi.fn() }));
vi.mock('@/lib/data/published', () => ({ getPublished: vi.fn() }));
vi.mock('@/lib/data/content', () => ({
  getCases: vi.fn(),
  getDoctors: vi.fn(),
  getGuides: vi.fn(),
  getTestimonials: vi.fn(),
}));

const DOCTOR = { id: 7, name: 'رضایی', slug: 'رضایی', services: [] };
const CASE = { id: 3, title: 'ترمیم دندان' };
const VOICE = { id: 4, patientLabel: 'بیمار ترمیم دندان' };

type Rows = { home?: object[]; off?: object[] };

/**
 * The published rows of each kind: `home` those marked for the home page, `off` the others. The
 * home lists read `home`; a reader without the home filter finds both.
 */
function publish(rows: { doctors?: object[]; cases?: Rows; voices?: Rows }) {
  const reader =
    ({ home = [], off = [] }: Rows = {}) =>
    async (filter: { home?: boolean } = {}) =>
      (filter.home ? home : [...home, ...off]) as never;
  vi.mocked(getDoctors).mockResolvedValue((rows.doctors ?? []) as never);
  vi.mocked(getCases).mockImplementation(reader(rows.cases));
  vi.mocked(getTestimonials).mockImplementation(reader(rows.voices));
}

beforeEach(() => {
  vi.clearAllMocks();
  env.demoContent = false;
  vi.mocked(getServiceTree).mockResolvedValue([]);
  vi.mocked(getClinic).mockResolvedValue({ hours: { weekly: [], holidays: [] } } as never);
  vi.mocked(getFeatures).mockResolvedValue({} as never);
  vi.mocked(getPublished).mockResolvedValue([]);
  vi.mocked(getGuides).mockResolvedValue([]);
});

describe('getHomeData: demo content of the client preview', () => {
  it('HD1 flag off: empty lists stay empty, no demo kind, no extra read', async () => {
    publish({});
    const data = await getHomeData();
    expect(data.doctors).toEqual([]);
    expect(data.demo).toEqual({ dentists: false, cases: false, voices: false });
    expect(vi.mocked(getCases).mock.calls).toEqual([[{ home: true, limit: 3 }]]);
  });

  it('HD2 flag on, nothing published: the demo dentists, cases and voices', async () => {
    env.demoContent = true;
    publish({});
    const data = await getHomeData();
    expect(data.demo).toEqual({ dentists: true, cases: true, voices: true });
    // The demo sections hold the demo items; the real lists stay empty.
    expect([data.doctors, data.cases, data.testimonials]).toEqual([[], [], []]);
  });

  it('HD3 flag on with real items: real only, even when none is marked for the home page', async () => {
    env.demoContent = true;
    publish({ doctors: [DOCTOR], cases: { home: [CASE] }, voices: { home: [VOICE] } });
    const shown = await getHomeData();
    expect(shown.doctors).toEqual([DOCTOR]);
    expect(shown.demo).toEqual({ dentists: false, cases: false, voices: false });
    // Published, but none on the home page: the sections hide and no demo stands in.
    publish({ doctors: [DOCTOR], cases: { off: [CASE] }, voices: { off: [VOICE] } });
    const hidden = await getHomeData();
    expect(hidden.demo).toEqual({ dentists: false, cases: false, voices: false });
    expect([hidden.cases, hidden.testimonials]).toEqual([[], []]);
  });

  it('HD4 flag on: each kind follows its own published rows', async () => {
    env.demoContent = true;
    publish({ doctors: [DOCTOR] });
    expect((await getHomeData()).demo).toEqual({ dentists: false, cases: true, voices: true });
    publish({ cases: { off: [CASE] } });
    expect((await getHomeData()).demo).toEqual({ dentists: true, cases: false, voices: true });
  });
});
