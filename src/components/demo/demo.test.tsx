import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DentistsHub } from '@/components/pages/DentistsHub';
import { t } from '@/i18n/fa';
import { getDoctors } from '@/lib/data/content';
import { getClinic } from '@/lib/data/globals';
import { DEMO_COPY, DEMO_DOCTORS, DEMO_VOICES, demoCopy } from '@/lib/demoContent';
import { stubSiteEnv } from '@/lib/http/testEnv';
import { readYaml } from '@/seed/sources';
import { pagesYaml } from '@/seed/schemas';
import { pageData } from '@/seed/transforms';
import type { Media, Page } from '@/payload-types';

import { DemoCasesSection, DemoDentistsSection, DemoVoicesSection } from './DemoSections';

// The preview's parsed environment (stubbed below) with each test's DEMO_CONTENT.
const env = vi.hoisted(() => ({ demoContent: true }));
vi.mock('@/lib/env', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/env')>();
  return { ...real, readEnv: () => ({ ...real.readEnv(), demoContent: env.demoContent }) };
});
vi.mock('@/lib/data/content', () => ({ getDoctors: vi.fn() }));
vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn() }));
vi.mock('@/components/booking/BookingForm', () => ({
  BookingForm: (props: { dentist?: string }) => (
    <form data-booking-form="block" data-dentist={props.dentist ?? 'none'} />
  ),
}));

const seeded = readYaml(process.cwd(), 'src/seed/data/pages.yaml', pagesYaml).data.pages.find(
  (p) => p.key === 'dentists-hub',
)!;
const page = { id: 3, ...pageData(seeded) } as unknown as Page;

const PHOTO = {
  id: 1,
  alt: 'پرترهٔ دکتر رضایی',
  sizes: { p640: { url: '/api/media/file/r-640.webp', width: 640, height: 800 } },
} as unknown as Media;
const REAL = {
  id: 9,
  name: 'رضایی',
  slug: 'رضایی',
  specialty: 'دندانپزشک عمومی',
  councilNumber: '123456',
  photo: PHOTO,
  services: [],
};

const graphText = (markup: string) =>
  [...markup.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)]
    .map((m) => m[1])
    .join('\n');

const hub = async () => renderToStaticMarkup(await DentistsHub({ page }));

/** The visible demo label, written out here so a change of the module's copy cannot hide it. */
const LABEL = 'طرح نمایشی';

/** One card per demo dentist: the name, the «طرح نمایشی» specialty line, the photo placeholder. */
function expectDemoCards(markup: string) {
  const cards = markup.split('<article').slice(1);
  expect(cards).toHaveLength(DEMO_DOCTORS.length);
  DEMO_DOCTORS.forEach((doctor, i) => {
    for (const part of [`دکتر ${doctor.name}`, LABEL, t('pages.photo.dentist')]) {
      expect(cards[i], part).toContain(part);
    }
  });
}

beforeEach(() => {
  stubSiteEnv({ SITE_URL: 'https://new.sefiddental.ir' });
  env.demoContent = true;
  vi.mocked(getDoctors).mockResolvedValue([]);
  vi.mocked(getClinic).mockResolvedValue({
    phones: { landline: '+982155101054' },
    address: { fullFa: 'تهران، خانی‌آباد نو' },
    maps: {},
    hours: { weekly: [], holidays: [] },
  } as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('demo content of the client preview (DEMO_CONTENT)', () => {
  it('DM1 hub, flag on, none published: demo cards without link, council line, lead, JSON-LD or binding', async () => {
    const markup = await hub();
    expectDemoCards(markup);
    expect(markup).not.toContain('href="/پزشکان/'); // no profile link
    expect(markup).not.toContain(t('ui.dentist.council'));
    expect(markup).not.toContain(t('pages.dentist.degree'));
    expect(markup).not.toContain(seeded.lead!);
    expect(markup).not.toContain(t('pages.dentists.empty'));
    const graph = graphText(markup);
    expect(graph).toContain('"BreadcrumbList"');
    expect(graph).not.toContain('"ItemList"');
    expect(graph).not.toContain('فرضی');
    expect(markup).toContain('data-dentist="none"');
  });

  it('DM2 hub, flag on with a published dentist: the real one only, with lead and JSON-LD', async () => {
    vi.mocked(getDoctors).mockResolvedValue([REAL] as never);
    const markup = await hub();
    expect(markup.match(/<article/g)).toHaveLength(1);
    expect(markup).toContain('href="/پزشکان/رضایی"');
    expect(markup).toContain(seeded.lead!);
    expect(graphText(markup)).toContain('"name":"دکتر رضایی"');
    expect(markup).not.toContain('فرضی');
  });

  it('DM3 hub, flag off: the empty state names no one', async () => {
    env.demoContent = false;
    const markup = await hub();
    expect(markup).toContain(t('pages.dentists.empty'));
    expect(markup).not.toContain('<article');
    expect(markup).not.toContain('فرضی');
  });

  it('DM4 home demo sections: labelled; no intro, scene id, consent line, slider or item link', () => {
    const consent = t('home.voices.consent');
    const intro = 'پیش از نوبت، دندانپزشک خود را بشناسید.';
    const markup = renderToStaticMarkup(
      <>
        <DemoCasesSection copy={{ heading: 'قبل و بعد درمان', intro: consent }} />
        <DemoDentistsSection copy={{ heading: 'دندانپزشکان کلینیک', intro }} />
        <DemoVoicesSection copy={{ heading: 'تجربهٔ بیماران', intro: consent }} />
      </>,
    );
    for (const section of ['compare', 'dentists', 'voices']) {
      expect(markup).toContain(`data-home-section="${section}"`);
    }
    // No scene_view or case_slider_use event for a demo item.
    expect(markup).not.toContain('data-scene');
    expect(markup).not.toContain('type="range"');
    // The case badge, each dentist's specialty line and each voice card; image text aside.
    const visible = markup.replace(/ alt="[^"]*"/g, '');
    expect(visible.split(LABEL).length - 1).toBe(1 + DEMO_DOCTORS.length + DEMO_VOICES.length);
    expectDemoCards(markup);
    for (const line of [...DEMO_VOICES, DEMO_COPY.beforePhoto, DEMO_COPY.afterPhoto]) {
      expect(markup).toContain(line);
    }
    expect(markup).not.toContain(intro);
    expect(markup).not.toContain(consent);
    expect(markup).not.toContain(t('ui.compare.consent'));
    expect(markup).not.toContain(t('ui.dentist.council'));
    // The one link is «همهٔ پزشکان», to the hub.
    const links = [...markup.matchAll(/<a\b[^>]*\shref="([^"]*)"/g)].map((m) => m[1]);
    expect(links).toEqual(['/پزشکان']);
  });

  it('DM5 the copy says «فرضی» or «طرح نمایشی», never «نمونه»', () => {
    for (const line of demoCopy()) expect(line).not.toContain('نمونه');
  });
});
