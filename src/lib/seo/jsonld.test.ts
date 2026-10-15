import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { stubSiteEnv } from '@/lib/http/testEnv';
import type { ClinicJsonLdInput } from '@/lib/seo/jsonld';

const load = () => import('@/lib/seo/jsonld');
const abs = (path: string) => new URL(path, 'https://sefiddental.ir').href;

// docs/content/clinic.yaml (street = full_fa without the leading «تهران، »).
const CLINIC: ClinicJsonLdInput = {
  name: 'کلینیک دندانپزشکی سفید',
  alternateNames: ['کلینیک سفید', 'Sefid Dental Clinic'],
  telephone: '+982155101054',
  address: {
    street: 'خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲',
    locality: 'تهران',
    region: 'تهران',
    country: 'IR',
    postalCode: null,
  },
  geo: null,
  weekly: [
    { days: ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'], open: '10:00', close: '20:00' },
  ],
  sameAs: [],
  hasMap: null,
};

describe('JSON-LD builders (spec 9.7)', () => {
  beforeEach(() => stubSiteEnv());
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('J1 Dentist node equals the clinic.yaml fixture exactly', async () => {
    const { dentistNode } = await load();
    expect(dentistNode(CLINIC)).toStrictEqual({
      '@type': 'Dentist',
      '@id': 'https://sefiddental.ir/#dentist',
      name: 'کلینیک دندانپزشکی سفید',
      alternateName: ['کلینیک سفید', 'Sefid Dental Clinic'],
      url: 'https://sefiddental.ir/',
      telephone: '+982155101054',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'خانی‌آباد نو، خیابان میعاد شمالی، ابتدای کوچه صابر (۲۸)، پلاک ۲',
        addressLocality: 'تهران',
        addressRegion: 'تهران',
        addressCountry: 'IR',
      },
      openingHoursSpecification: [
        {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: [
            'https://schema.org/Saturday',
            'https://schema.org/Sunday',
            'https://schema.org/Monday',
            'https://schema.org/Tuesday',
            'https://schema.org/Wednesday',
            'https://schema.org/Thursday',
            'https://schema.org/Friday',
          ],
          opens: '10:00',
          closes: '20:00',
        },
      ],
      logo: 'https://sefiddental.ir/brand/favicon-512.png',
      image: 'https://sefiddental.ir/brand/og-preview.png',
    });
  });

  it('J2 geo and sameAs only when they exist', async () => {
    const { dentistNode } = await load();
    const node = dentistNode({
      ...CLINIC,
      geo: { lat: 35.62, lng: 51.39 },
      sameAs: ['https://instagram.com/x'],
    });
    expect(node?.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 35.62, longitude: 51.39 });
    expect(node?.sameAs).toEqual(['https://instagram.com/x']);
  });

  it('J3 breadcrumb خانه / خدمات / زیبایی / لمینت سرامیکی', async () => {
    const { breadcrumbNode } = await load();
    const node = breadcrumbNode([
      { name: 'خانه', path: '/' },
      { name: 'خدمات', path: '/خدمات' },
      { name: 'زیبایی', path: '/خدمات/زیبایی' },
      { name: 'لمینت سرامیکی', path: '/خدمات/لمینت-سرامیکی' },
    ]);
    expect(node).toEqual({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'خانه', item: abs('/') },
        { '@type': 'ListItem', position: 2, name: 'خدمات', item: abs('/خدمات') },
        { '@type': 'ListItem', position: 3, name: 'زیبایی', item: abs('/خدمات/زیبایی') },
        {
          '@type': 'ListItem',
          position: 4,
          name: 'لمینت سرامیکی',
          item: abs('/خدمات/لمینت-سرامیکی'),
        },
      ],
    });
  });

  it('J4 FAQPage with two questions', async () => {
    const { faqPageNode } = await load();
    expect(
      faqPageNode([
        { question: 'آیا لمینت درد دارد؟', answer: 'با بی‌حسی موضعی انجام می‌شود.' },
        { question: 'چند جلسه طول می‌کشد؟', answer: 'معمولاً دو جلسه.' },
      ]),
    ).toEqual({
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'آیا لمینت درد دارد؟',
          acceptedAnswer: { '@type': 'Answer', text: 'با بی‌حسی موضعی انجام می‌شود.' },
        },
        {
          '@type': 'Question',
          name: 'چند جلسه طول می‌کشد؟',
          acceptedAnswer: { '@type': 'Answer', text: 'معمولاً دو جلسه.' },
        },
      ],
    });
    expect(faqPageNode([])).toBeNull();
  });

  it('J5 Physician: memberOf the clinic, identifier only with a council number, never worksFor', async () => {
    const { physicianNode } = await load();
    const without = physicianNode({ name: 'دکتر نمونه', path: '/پزشکان/دکتر-نمونه' });
    expect(without).not.toHaveProperty('identifier');
    expect(without).not.toHaveProperty('worksFor');
    expect(without).toMatchObject({
      '@type': 'Physician',
      '@id': `${abs('/پزشکان/دکتر-نمونه')}#physician`,
      medicalSpecialty: 'https://schema.org/Dentistry',
      memberOf: { '@id': 'https://sefiddental.ir/#dentist' },
    });
    const withNumber = physicianNode({
      name: 'دکتر نمونه',
      path: '/پزشکان/دکتر-نمونه',
      councilNumber: '12345',
    });
    expect(withNumber?.identifier).toEqual({
      '@type': 'PropertyValue',
      propertyID: 'نظام پزشکی',
      value: '12345',
    });
  });

  it('J6 Service node: provider, serviceType, no offers', async () => {
    const { serviceNode } = await load();
    const node = serviceNode({
      name: 'لمینت سرامیکی',
      serviceType: 'لمینت سرامیکی',
      path: '/خدمات/لمینت-سرامیکی',
      areaServed: ['جنوب تهران'],
    });
    expect(node).toEqual({
      '@type': 'Service',
      '@id': `${abs('/خدمات/لمینت-سرامیکی')}#service`,
      name: 'لمینت سرامیکی',
      serviceType: 'لمینت سرامیکی',
      url: abs('/خدمات/لمینت-سرامیکی'),
      provider: { '@id': 'https://sefiddental.ir/#dentist' },
      areaServed: ['جنوب تهران'],
    });
  });

  it('J7 Article: MedicalWebPage carries reviewedBy, Article is its mainEntity', async () => {
    const { articleNodes } = await load();
    const nodes = articleNodes({
      path: '/مقالات/نمونه',
      headline: 'مقالهٔ نمونه',
      datePublished: '2026-10-01',
      author: { name: 'نویسنده' },
      reviewer: { name: 'دکتر بازبین', path: '/پزشکان/دکتر-بازبین' },
      lastReviewed: '2026-10-02',
    });
    const [page, article] = nodes ?? [];
    expect(page).toMatchObject({
      '@type': 'MedicalWebPage',
      reviewedBy: { '@type': 'Person', name: 'دکتر بازبین', url: abs('/پزشکان/دکتر-بازبین') },
      lastReviewed: '2026-10-02',
      mainEntity: { '@id': `${abs('/مقالات/نمونه')}#article` },
    });
    expect(article).toMatchObject({
      '@type': 'Article',
      headline: 'مقالهٔ نمونه',
      dateModified: '2026-10-01',
      publisher: { '@id': 'https://sefiddental.ir/#dentist' },
    });
    expect(article).not.toHaveProperty('reviewedBy');
  });

  it('J8 VideoObject needs all five core fields', async () => {
    const { videoNode } = await load();
    const full = {
      name: 'تجربهٔ بیمار',
      description: 'خلاصه',
      thumbnailUrl: '/api/media/file/t.webp',
      uploadDate: '2026-10-01',
      contentUrl: '/api/media/file/v.mp4',
    };
    expect(videoNode({ ...full, uploadDate: null })).toBeNull();
    expect(videoNode(full)).toMatchObject({
      '@type': 'VideoObject',
      thumbnailUrl: abs('/api/media/file/t.webp'),
      inLanguage: 'fa-IR',
    });
  });

  it('J9 ItemList positions and URLs', async () => {
    const { itemListNode } = await load();
    expect(itemListNode([{ name: 'الف', path: '/خدمات/الف' }])).toEqual({
      '@type': 'ItemList',
      itemListElement: [{ '@type': 'ListItem', position: 1, url: abs('/خدمات/الف'), name: 'الف' }],
    });
    expect(itemListNode([])).toBeNull();
  });

  it('J10 a [[NEEDS_CLIENT]] marker or a missing field throws outside production', async () => {
    const { dentistNode, websiteNode } = await load();
    expect(() => dentistNode({ ...CLINIC, telephone: '[[NEEDS_CLIENT: phone]]' })).toThrow(
      /NEEDS_CLIENT/,
    );
    expect(() => websiteNode({ name: '' })).toThrow(/missing name/);
  });

  it('J11 in production the node is omitted and one jsonld_invalid line is logged', async () => {
    stubSiteEnv({ NODE_ENV: 'production', LOG_LEVEL: 'info' });
    const writes: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
      writes.push(String(chunk));
      return true;
    });
    const { dentistNode, jsonLdGraph, websiteNode } = await load();
    const node = dentistNode({ ...CLINIC, telephone: '[[NEEDS_CLIENT: phone]]' });
    expect(node).toBeNull();
    expect(writes.some((w) => w.includes('jsonld_invalid'))).toBe(true);
    expect(jsonLdGraph(node, websiteNode({ name: 'کلینیک' }))['@graph']).toHaveLength(1);
  });

  it('J12 serialized script text escapes </script>', async () => {
    const { serializeJsonLd } = await load();
    const text = serializeJsonLd({ name: 'a</script><script>alert(1)</script>' });
    expect(text).toContain('\\u003c/script>');
    expect(text).not.toContain('</script>');
    expect(JSON.parse(text)).toEqual({ name: 'a</script><script>alert(1)</script>' });
  });

  it('J13 compact drops null, undefined, empty strings and empty arrays recursively', async () => {
    const { compact } = await load();
    expect(
      compact({
        a: null,
        b: undefined,
        c: '',
        d: [],
        e: { f: null },
        g: 0,
        h: false,
        i: ['', 'x'],
      }),
    ).toEqual({
      g: 0,
      h: false,
      i: ['x'],
    });
  });

  it('J14 one graph with @context; article pairs flattened', async () => {
    const { articleNodes, jsonLdGraph, websiteNode } = await load();
    const graph = jsonLdGraph(
      websiteNode({ name: 'کلینیک' }),
      articleNodes({
        path: '/مقالات/ب',
        headline: 'ب',
        datePublished: '2026-10-01',
        author: { name: 'ن' },
      }),
    );
    expect(graph['@context']).toBe('https://schema.org');
    expect(graph['@graph'].map((n) => n['@type'])).toEqual([
      'WebSite',
      'MedicalWebPage',
      'Article',
    ]);
  });

  it('J15 guide: a MedicalWebPage with the reviewing dentist and the Tehran review day; none with a marker', async () => {
    const { guidePageNode } = await load();
    const node = guidePageNode({
      path: '/راهنمای-بیمار/اولین-مراجعه',
      name: 'اولین مراجعه به کلینیک سفید چگونه است؟',
      description: null,
      reviewer: { name: 'دکتر نام', path: '/پزشکان/دکتر-نام' },
      // 00:30 on 15 October in Tehran is still 14 October in UTC.
      lastReviewed: '2026-10-14T21:00:00.000Z',
      dateModified: '2026-10-15T08:00:00.000Z',
    });
    const url = new URL(encodeURI('/راهنمای-بیمار/اولین-مراجعه'), 'https://sefiddental.ir').href;
    expect(node).toEqual({
      '@type': 'MedicalWebPage',
      '@id': `${url}#webpage`,
      url,
      name: 'اولین مراجعه به کلینیک سفید چگونه است؟',
      inLanguage: 'fa-IR',
      isPartOf: { '@id': 'https://sefiddental.ir/#website' },
      publisher: { '@id': 'https://sefiddental.ir/#dentist' },
      reviewedBy: {
        '@type': 'Person',
        name: 'دکتر نام',
        url: new URL(encodeURI('/پزشکان/دکتر-نام'), 'https://sefiddental.ir').href,
      },
      lastReviewed: '2026-10-15',
      dateModified: '2026-10-15T08:00:00.000Z',
    });
    expect(
      guidePageNode({ path: '/راهنمای-بیمار/x', name: 'متن [[NEEDS_CLIENT: نام]]' }),
    ).toBeNull();
    expect(guidePageNode({ path: '/راهنمای-بیمار/x', name: ' ' })).toBeNull();
  });
});
