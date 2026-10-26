import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Field } from 'payload';
import { afterAll, describe, expect, it } from 'vitest';

import { ARTICLE_BLOCKS } from '@/blocks/articleBlocks';
import { Articles } from '@/collections/Articles';
import { Pages } from '@/collections/Pages';
import { ServiceCategories } from '@/collections/ServiceCategories';
import { Services } from '@/collections/Services';
import { ServiceTiers } from '@/collections/ServiceTiers';
import { ArticleCategories, Tags } from '@/collections/Taxonomies';
import { ICONS } from '@/components/ui/icons';
import { sourcesArray } from '@/fields/factories';
import {
  ARTICLE_RESERVED_SLUGS,
  BANNED_WORDS,
  categoryTermRule,
  codePoints,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
  headingsRule,
  internalLinks,
  linksRule,
  proseRule,
  richProseRule,
  slugRule,
  subtextRule,
  titleRule,
} from '@/fields/validators';
import { t } from '@/i18n/fa';
import { isGuideKey, normalizePath } from '@/lib/paths';

import { contains, emptyFieldsPatch } from './run';
import {
  articlesYaml,
  clinicYaml,
  doctorsYaml,
  pagesYaml,
  PUBLISHER_VALUES,
  servicesYaml,
} from './schemas';
import { readYaml, SeedSourceError } from './sources';
import {
  ACCENT_MAP,
  aliasRedirect,
  articleBody,
  articleData,
  assertLinks,
  blockData,
  categoryData,
  checkedSlug,
  dayOnly,
  financingData,
  globalsData,
  isSeedableTestimonial,
  isTemplateDoctor,
  lexicalFrom,
  linkPaths,
  pageData,
  SeedDataError,
  seedPaths,
  serviceData,
  taxonomyData,
  tierData,
} from './transforms';

const ROOT = process.cwd();
const tmp = mkdtempSync(path.join(os.tmpdir(), 'sefid-seed-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('seed sources (spec-data 8.1, 9.1)', () => {
  it('SS1 the repository yaml files validate; services.yaml has the acceptance counts', () => {
    const services = readYaml(ROOT, 'docs/content/services.yaml', servicesYaml);
    expect(services.data.categories).toHaveLength(5);
    expect(services.data.services).toHaveLength(18);
    expect(services.data.services.flatMap((s) => s.tiers ?? [])).toHaveLength(3);
    const clinic = readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml);
    expect(clinic.data.financing).toHaveLength(2);
  });

  it('SS2 the ten NEEDS_CLIENT paths and the verify comments of clinic.yaml', () => {
    const { markers } = readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml);
    const needs = markers.filter((m) => m.kind === 'needs_client').map((m) => m.path);
    expect(needs).toEqual([
      'address.postal_code',
      'address.lat',
      'address.lng',
      'address.access_notes_fa',
      'social.instagram',
      'financing.0.provider',
      'financing.1.provider',
      'legal.license_number',
      'legal.technical_supervisor',
      'market.secondary_areas_fa',
    ]);
    const verify = markers
      .filter((m) => m.kind === 'needs_verification')
      .map((m) => `${m.path}:${m.line}`);
    expect(verify).toEqual(['phones.whatsapp:21', 'phones.telegram:22', 'stats:35']);
  });

  it('SS3 a bad value stops the run with file:line', () => {
    writeFileSync(
      path.join(tmp, 'bad.yaml'),
      'doctors:\n  - slug: x\n    name_fa: y\n    specialty_fa: z\n    council_number: 1\n    years_experience: 99\n',
    );
    expect(() => readYaml(tmp, 'bad.yaml', doctorsYaml)).toThrow(SeedSourceError);
    expect(() => readYaml(tmp, 'bad.yaml', doctorsYaml)).toThrow(
      /^bad\.yaml:6: doctors\.0\.years_experience/,
    );
  });
});

describe('seed transforms (spec-data 8.3-8.5)', () => {
  const services = readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).data;

  it('ST1 accent map to token names', () => {
    expect(ACCENT_MAP).toEqual({
      warm: 'cosmetic',
      brand: 'surgery',
      green: 'restorative',
      sky: 'ortho',
      yellow: 'kids',
    });
    const ortho = categoryData(services.categories.find((c) => c.key === 'orthodontics')!);
    expect(ortho).toMatchObject({
      accent: 'ortho',
      standalone: true,
      slug: null,
      navLabel: 'ارتودنسی',
    });
  });

  it('ST2 TODO becomes null; scope_to_verify becomes an internal note and an unverified scope', () => {
    const surgery = serviceData(
      services.services.find((s) => s.key === 'oral-surgery')!,
      2,
      30,
    );
    expect(surgery).toMatchObject({
      facts: { sessions: null, duration: null, anesthesia: null, recovery: null },
      scopeVerified: false,
    });
    expect(surgery.internalNote).toContain('gap 27');
    expect(serviceData(services.services[0]!, 1, 10).scopeVerified).toBe(true);
  });

  it('ST3 financing status parse', () => {
    const clinic = readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml).data;
    const [loan, credit] = clinic.financing.map(financingData);
    expect(loan).toMatchObject({
      approvalStatus: 'approved',
      provider: null,
      enabled: false,
      order: 10,
    });
    expect(loan?.approvedOn).toBe('2026-10-10T08:30:00.000Z');
    expect(credit).toMatchObject({
      approvalStatus: 'pending',
      approvedOn: null,
      whoApplies: null,
      order: 20,
    });
  });

  it('ST4 the /vip alias points at the restoration tiers', () => {
    const restoration = services.services.find((s) => s.key === 'restoration')!;
    expect(aliasRedirect(restoration)).toEqual({
      from: '/vip',
      to: '/خدمات/ترمیم-دندان#سطح-ترمیم',
      statusCode: '301',
      source: 'alias',
      active: true,
    });
    expect(aliasRedirect(services.services[0]!)).toBeNull();
  });

  it('ST5 template entries are skipped; a slug not in final form stops the run', () => {
    expect(isTemplateDoctor({ name_fa: '', slug: '' })).toBe(true);
    expect(isTemplateDoctor({ name_fa: 'نام', slug: 'دکتر-نام' })).toBe(false);
    expect(isSeedableTestimonial({ patient_label_fa: 'م.', consent_confirmed: false })).toBe(false);
    expect(isSeedableTestimonial({ patient_label_fa: 'م.', consent_confirmed: true })).toBe(true);
    expect(() => checkedSlug('لمینت سرامیکی', 'x')).toThrow(SeedDataError);
    expect(checkedSlug('لمینت-سرامیکی', 'x')).toBe('لمینت-سرامیکی');
  });

  it('ST6 create-only globals fill empty fields only', () => {
    const current = {
      nameFa: 'ثبت‌شده',
      address: { city: 'تهران', postalCode: null },
      phones: { whatsappVerified: true },
    };
    const seed = {
      nameFa: 'از yaml',
      address: { city: 'شهر دیگر', postalCode: null, district: 'خانی‌آباد نو' },
      phones: { whatsappVerified: false },
      hours: { weekly: [{ days: ['sat'], open: '10:00', close: '20:00' }] },
    };
    expect(emptyFieldsPatch(current, seed)).toEqual({
      address: { district: 'خانی‌آباد نو' },
      hours: { weekly: seed.hours.weekly },
    });
    expect(
      emptyFieldsPatch(
        { ...current, address: { ...current.address, district: 'x' }, hours: seed.hours },
        seed,
      ),
    ).toEqual({});
  });
});

describe('phase 4 seed copy (freeze F6, F7, F15, F17, F28)', () => {
  const services = readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).data;
  const pages = readYaml(ROOT, 'src/seed/data/pages.yaml', pagesYaml).data.pages;
  const clinic = readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml).data;
  const articles = readYaml(ROOT, 'src/seed/data/articles.yaml', articlesYaml).data;
  const home = pages.find((p) => p.key === 'home')!;

  it('SC1 home H1 is the F6 fallback; the slogan stays in a yaml comment only', () => {
    expect(home.title).toBe('کلینیک دندانپزشکی سفید در جنوب تهران');
    const raw = readFileSync(path.join(ROOT, 'src/seed/data/pages.yaml'), 'utf8');
    expect(raw).toMatch(/^\s*#.*«اولین کلینیک دندانپزشکی دیجیتال جنوب تهران»/m);
    expect(JSON.stringify(pages)).not.toContain('اولین کلینیک');
  });

  it('SC2 home subtext plus the free-consultation sentence is at most 19 words (F7)', () => {
    expect(home.subtext).toBeTruthy();
    expect(subtextRule(home.subtext, true)).toBe(true);
    // The same-session plan and cost claim waits for the client (gaps.md row 50).
    expect(home.subtext).not.toContain('همان جلسه');
  });

  /** Every visible string the seed writes from the yaml (keys, slugs and search terms excluded). */
  function seededCopy(): string[] {
    const skip = new Set([
      'key',
      'slug',
      'category',
      'booking_group',
      'accent',
      'icon',
      'alias',
      'search_terms',
      'scope_to_verify',
      'type',
      'tone',
      'related',
      // Phase 6: source titles and URLs are stored as published (H9); the rest are references.
      'sources',
      'reviewed_by',
      'primary_service',
      'tags',
    ]);
    const out: string[] = [];
    const walk = (value: unknown): void => {
      if (typeof value === 'string') out.push(value);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') {
        for (const [k, v] of Object.entries(value)) if (!skip.has(k)) walk(v);
      }
    };
    walk(services);
    walk(pages);
    // Top-level `tags` hold titles; an article's `tags` are slugs (skipped by key).
    walk([articles.categories, articles.tags, articles.articles]);
    walk([clinic.footer_line_fa, clinic.seo?.default_description_fa, clinic.hours.note_fa]);
    return out.filter((text) => text !== 'TODO');
  }

  const LABELS = [
    'تماس با ما',
    'بیشتر بدانید',
    'کلیک کنید',
    'همین حالا تماس بگیرید',
    'انتخاب این سطح',
  ];

  it.each(seededCopy())('SC3 copy rules: %s', (text) => {
    expect(proseRule(text)).toBe(true); // the admin's own check, so a publish never stops on it
    for (const word of [...BANNED_WORDS, ...LABELS, 'بدون درد', 'متخصص']) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toContain('اولین کلینیک'); // the ranking claim (gap 28); ordinals are fine
    expect(text).not.toMatch(/طرف قرارداد|سایر بیمه/); // unconfirmed insurer claims (F31, gap 51)
    expect(text).not.toMatch(/[يكى]/);
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/[0-9]/);
    expect(text).not.toMatch(/\([^)]*[A-Za-z][^)]*\)/); // an English gloss in brackets (screens 42)
    expect(text).not.toMatch(/\[\[NEEDS_CLIENT/);
    expect(text).not.toMatch(/(^|[\s«])ن?می [آ-ی]/); // missing ZWNJ after می
    expect(text).not.toMatch(/ (ها|های|هایی|تر|ترین)([\s.،؟»]|$)/); // missing ZWNJ before a suffix
  });

  it('SC13 every [text](/path) names a seeded page; link syntax only in content text', () => {
    const doctors = readYaml(ROOT, 'content/data/doctors.yaml', doctorsYaml).data.doctors;
    const known = seedPaths({
      services: services.services,
      pages,
      articles: articles.articles,
      doctors,
    });
    const content = [
      ...services.services.flatMap((s) => s.body ?? []),
      ...pages.flatMap((p) => p.blocks ?? []),
      ...articles.articles.flatMap((a) => a.body),
    ].flatMap((block) => (block.type === 'content' ? [block.text] : []));
    for (const text of content) {
      expect(() => assertLinks(text, known, 'yaml')).not.toThrow();
      // `[x](https://…)` or `[x](/path#part)` is not link syntax and would show as typed.
      expect((text.match(/\]\(/g) ?? []).length, text).toBe(linkPaths(text).length);
    }
    for (const text of seededCopy().filter((t) => !content.includes(t))) {
      expect(text).not.toMatch(/\]\(/);
    }
  });

  it('SC4 the restoration page fills every section the seed can (p04 acceptance)', () => {
    const restoration = services.services.find((s) => s.key === 'restoration')!;
    const data = serviceData(restoration, 3, 10);
    expect(data.summary).toBeTruthy();
    expect(Object.values(data.facts).filter(Boolean).length).toBeGreaterThanOrEqual(3);
    expect(data.body.map((b) => b.blockType)).toEqual(['content', 'callout', 'steps', 'content']);
    expect(data.faqs.length).toBeGreaterThanOrEqual(5);
    expect(data.faqs.length).toBeLessThanOrEqual(8);
    expect(restoration.related).toHaveLength(3);
    const keys = new Set(services.services.map((s) => s.key));
    expect(restoration.related!.every((key) => keys.has(key) && key !== 'restoration')).toBe(true);
    expect(descriptionRule(data.seo.description, true)).toBe(true);
    for (const block of data.body) {
      if (block.blockType === 'content') expect(richProseRule(block.body)).toBe(true);
    }
  });

  it('SC5 every service has a summary; categories have an icon; category pages have intro, faqs and a title topic', () => {
    for (const service of services.services) {
      expect(serviceData(service, 1, 10).summary, service.key).toBeTruthy();
      expect([...(service.summary ?? '')].length, service.key).toBeLessThanOrEqual(220);
    }
    for (const category of services.categories) {
      // CategoryIcon takes the Phosphor name; the sprite holds it as `duo-<name>`.
      expect(Object.keys(ICONS), category.key).toContain(`duo-${categoryData(category).icon}`);
    }
    for (const category of services.categories.filter((c) => !c.standalone)) {
      const data = categoryData(category);
      expect(data.intro?.split('\n\n').length, category.key).toBeGreaterThanOrEqual(2);
      expect(data.faqs.length, category.key).toBeGreaterThanOrEqual(3);
      expect(titleRule(data.seo.title, DEFAULT_TITLE_SUFFIX), category.key).toBe(true);
    }
  });

  it('SC-EM1 the emergency page seeds its search description within the length rule (EM-SEO3)', () => {
    const data = pageData(pages.find((p) => p.key === 'emergency')!);
    expect(data.seo.description).toMatch(/^درد شدید دندان دارید؟/);
    expect(descriptionRule(data.seo.description, true)).toBe(true);
  });

  it('SC6 home blocks: four journey steps and the six FAQ topics; sections are unique', () => {
    const data = pageData(home);
    const steps = data.blocks.find((b) => b.blockType === 'steps');
    const faq = data.blocks.find((b) => b.blockType === 'faq');
    expect(steps && 'items' in steps ? steps.items : []).toHaveLength(4);
    expect(faq && 'items' in faq ? faq.items : []).toHaveLength(6);
    const keys = data.sections.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    // The consent line is fixed UI copy under the compare slider, never an editable intro.
    expect(data.sections.map((s) => s.intro)).not.toContain(t('ui.compare.consent'));
    expect(data.hero?.subtext).toBe(home.subtext);
  });

  it('SC7 the default description (gap 41) and the footer line are seeded; hours wording F14', () => {
    const globals = globalsData(clinic);
    expect(descriptionRule(globals['seo-defaults'].defaultDescription, true)).toBe(true);
    expect(globals.clinic.footerLine).toBeTruthy();
    expect(globals.clinic.hours.note).toBe('هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.');
  });
});

describe('lexicalFrom (seed Markdown subset to Lexical JSON)', () => {
  it('LX1 headings, paragraphs joined per blank line, bullet lists', () => {
    const tree = lexicalFrom('## عنوان\nبند یک\nادامه\n\n- مورد یک\n- مورد دو\nبند دو');
    const nodes = tree.root.children;
    expect(nodes.map((n) => n.type)).toEqual(['heading', 'paragraph', 'list', 'paragraph']);
    expect(nodes[0]).toMatchObject({ tag: 'h2' });
    expect(nodes[1]?.children).toEqual([expect.objectContaining({ text: 'بند یک ادامه' })]);
    expect(nodes[2]?.children).toHaveLength(2);
    expect(blockData({ type: 'content', text: 'متن' })).toMatchObject({ blockType: 'content' });
  });
});

describe('seed links: [text](/path) (H29, C10)', () => {
  const doc = { relationTo: 'services' as const, value: 7 };
  const link = (p: string) => (normalizePath(p) === '/خدمات/ترمیم-دندان' ? doc : null);

  it('LX2 a known path becomes an internal document link; the words around it keep their spaces', () => {
    const tree = lexicalFrom(
      'پیش از [ترمیم دندان](/خدمات/ترمیم-دندان) بخوانید.\n\n- مورد [ترمیم](/خدمات/ترمیم-دندان)',
      link,
    );
    const [paragraph, list] = tree.root.children;
    expect(paragraph?.children).toEqual([
      expect.objectContaining({ type: 'text', text: 'پیش از ' }),
      expect.objectContaining({
        type: 'link',
        version: 3,
        id: expect.stringMatching(/^[0-9a-f]{24}$/),
        fields: { linkType: 'internal', newTab: false, doc },
        children: [expect.objectContaining({ type: 'text', text: 'ترمیم دندان' })],
      }),
      expect.objectContaining({ type: 'text', text: ' بخوانید.' }),
    ]);
    const item = (list?.children as { children: { type: string }[] }[])[0];
    expect(item?.children.map((n) => n.type)).toEqual(['text', 'link']);
    expect(linkPaths('[الف](/a) و [ب](/b) و [ج](https://x.ir) و [د](/c#d)')).toEqual(['/a', '/b']);
  });

  it('LX3 without a resolver, or before the target exists, only the link text stays', () => {
    const plain = lexicalFrom('پیش از [ترمیم دندان](/خدمات/ترمیم-دندان) بخوانید.');
    expect(plain.root.children[0]?.children).toEqual([
      expect.objectContaining({ type: 'text', text: 'پیش از ترمیم دندان بخوانید.' }),
    ]);
    expect(lexicalFrom('[ب](/ناشناخته)', link).root.children[0]?.children).toEqual([
      expect.objectContaining({ type: 'text', text: 'ب' }),
    ]);
    // Same input, same JSON (link ids included): a second run has nothing to write.
    const twice = '[ترمیم](/خدمات/ترمیم-دندان) و [ترمیم](/خدمات/ترمیم-دندان)';
    expect(lexicalFrom(twice, link)).toEqual(lexicalFrom(twice, link));
    const [a, , b] = lexicalFrom(twice, link).root.children[0]!.children as { id?: string }[];
    expect(a?.id).not.toBe(b?.id);
  });

  it('LX4 an unknown path stops the run with file:line', () => {
    const known = new Set(['/خدمات/ترمیم-دندان']);
    expect(() => assertLinks('[الف](/خدمات/ترمیم-دندان/)', known, 'f.yaml:3')).not.toThrow();
    expect(() => assertLinks('[الف](/خدمات/نیست)', known, 'f.yaml:3')).toThrow(SeedDataError);
    expect(() => assertLinks('[الف](/خدمات/نیست)', known, 'f.yaml:3')).toThrow(
      /^f\.yaml:3: unknown link path "\/خدمات\/نیست"/,
    );
  });
});

const SOURCE = {
  title: 'Tooth decay',
  publisher: 'NHS' as const,
  url: 'https://www.nhs.uk/conditions/tooth-decay/',
  accessed_on: '2026-10-18',
};

describe('phase 6 seed sources (H26, H29, C5)', () => {
  const minimal = (service: Record<string, unknown> = {}) => ({
    categories: [{ key: 'c', title: 'دسته', slug: 'دسته', accent: 'warm', order: 1 }],
    services: [
      {
        key: 's',
        category: 'c',
        nav_label: 'خدمت',
        h1: 'خدمت',
        seo_title: 'خدمت',
        slug: 'خدمت',
        booking_group: 'exam',
        priority: 1,
        search_terms: [],
        price_from: null,
        ...service,
      },
    ],
  });

  it('SS4 a source needs https, a listed publisher and a Gregorian day; reviewed_by takes only null', () => {
    expect(servicesYaml.safeParse(minimal({ sources: [SOURCE], reviewed_by: null })).success).toBe(
      true,
    );
    for (const bad of [
      { url: 'http://www.nhs.uk/x' },
      { url: 'www.nhs.uk/x' },
      { publisher: 'WHO' },
      { publisher: undefined },
      { accessed_on: '2026/10/18' },
      { accessed_on: '1405-07-26' },
      { title: '' },
    ]) {
      const parsed = servicesYaml.safeParse(minimal({ sources: [{ ...SOURCE, ...bad }] }));
      expect(parsed.success, JSON.stringify(bad)).toBe(false);
    }
    expect(servicesYaml.safeParse(minimal({ reviewed_by: 'dr-x' })).success).toBe(false);
    const guide = { key: 'guide-aftercare', slug: 'x', title: 'ت', reviewed_by: null };
    expect(pagesYaml.safeParse({ pages: [{ ...guide, sources: [SOURCE] }] }).success).toBe(true);
    expect(
      pagesYaml.safeParse({ pages: [{ ...guide, sources: [{ ...SOURCE, url: 'http://x.ir' }] }] })
        .success,
    ).toBe(false);
    // The yaml publishers are the Payload select values (src/fields/factories.ts sourcesArray).
    const publisher = sourcesArray().fields.find((f) => 'name' in f && f.name === 'publisher');
    expect([...PUBLISHER_VALUES]).toEqual(
      (publisher as { options: { value: string }[] }).options.map((o) => o.value),
    );
  });

  it('SS5 `reviewed_by: null  # NEEDS_CLIENT …` is a marker at services.N.reviewed_by', () => {
    writeFileSync(
      path.join(tmp, 'marker.yaml'),
      [
        'categories:',
        '  - {key: c, title: دسته, slug: دسته, accent: warm, order: 1}',
        'services:',
        '  - key: s',
        '    category: c',
        '    nav_label: خدمت',
        '    h1: خدمت',
        '    seo_title: خدمت',
        '    slug: خدمت',
        '    booking_group: exam',
        '    priority: 1',
        '    search_terms: []',
        '    price_from: null',
        '    reviewed_by: null  # NEEDS_CLIENT: reviewer dentist (gap 42)',
        '',
      ].join('\n'),
    );
    const { markers } = readYaml(tmp, 'marker.yaml', servicesYaml);
    expect(markers).toEqual([
      { file: 'marker.yaml', path: 'services.0.reviewed_by', kind: 'needs_client', line: 14 },
    ]);
  });

  const ARTICLE = {
    slug: 'مقاله-آزمون',
    title: 'عنوان',
    seo_title: 'عنوان',
    seo_description: 'توضیح',
    excerpt: 'خلاصه',
    category: 'دسته',
    primary_service: 'restoration',
    is_medical: true,
    body: [{ type: 'content', text: '## یک' }],
  };
  const file = (article: Record<string, unknown>) => ({
    categories: [],
    tags: [],
    articles: [article],
  });

  it('SS6 articles.yaml: the repo file validates; unknown keys, ragged tables and an implicit service are refused', () => {
    expect(readYaml(ROOT, 'src/seed/data/articles.yaml', articlesYaml).data.articles).toBeDefined();
    expect(articlesYaml.safeParse(file(ARTICLE)).success).toBe(true);
    expect(articlesYaml.safeParse(file({ ...ARTICLE, primary_service: null })).success).toBe(true);
    // A misspelled key would be dropped without a word; strict entries stop the run instead.
    expect(articlesYaml.safeParse(file({ ...ARTICLE, seo_topic: 'x' })).success).toBe(false);
    const { primary_service: _omitted, ...implicit } = ARTICLE;
    expect(articlesYaml.safeParse(file(implicit)).success).toBe(false);
    expect(articlesYaml.safeParse(file({ ...ARTICLE, reviewed_by: 'dr-x' })).success).toBe(false);
    const table = { type: 'table', caption: 'مقایسه', head: ['الف', 'ب'], rows: [['یک', 'دو']] };
    const withTable = (t: Record<string, unknown>) => file({ ...ARTICLE, body: [t] });
    expect(articlesYaml.safeParse(withTable(table)).success).toBe(true);
    expect(articlesYaml.safeParse(withTable({ ...table, rows: [['یک']] })).success).toBe(false);
    expect(
      articlesYaml.safeParse(withTable({ ...table, head: ['تنها'], rows: [['یک']] })).success,
    ).toBe(false);
    expect(
      articlesYaml.safeParse(withTable({ type: 'steps', items: [{ title: 'الف', text: 'ب' }] }))
        .success,
    ).toBe(false);
  });
});

describe('phase 6 transforms (H29, H43)', () => {
  const services = readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).data.services;
  const blocks = [
    { type: 'content' as const, text: '## مقایسه\nمتن' },
    { type: 'callout' as const, tone: 'warning' as const, text: 'هشدار' },
    { type: 'table' as const, caption: 'جدول', head: ['الف', 'ب'], rows: [['یک', 'دو']] },
  ];

  it('ST7 an article body: content, callout and table blocks in one Lexical tree', () => {
    const body = articleBody(blocks);
    const nodes = body.root.children;
    expect(nodes.map((n) => n.type)).toEqual(['heading', 'paragraph', 'block', 'block']);
    expect(nodes[2]).toMatchObject({
      version: 2,
      format: '',
      fields: { blockType: 'callout', blockName: '', tone: 'warning', text: 'هشدار' },
    });
    expect(nodes[3]).toMatchObject({
      fields: {
        blockType: 'table',
        caption: 'جدول',
        head: ['الف', 'ب'],
        rows: [{ cells: ['یک', 'دو'] }],
      },
    });
    expect((nodes[2]?.fields as { id: string }).id).toMatch(/^[0-9a-f]{24}$/);
    expect(articleBody(blocks)).toEqual(body);
  });

  it('ST8 article, category and tag data; drafts carry no reviewer, review date, cover or author', () => {
    const article = {
      slug: 'لمینت-یا-کامپوزیت',
      title: 'لمینت یا کامپوزیت؟',
      seo_title: 'لمینت یا کامپوزیت',
      seo_description: 'توضیح',
      excerpt: 'خلاصهٔ كوتاه',
      category: 'زیبایی-لبخند',
      tags: ['لمینت'],
      primary_service: 'ceramic-laminate',
      is_medical: true,
      body: blocks,
      faqs: [{ question: 'پرسش؟', answer: 'پاسخ.' }],
      sources: [SOURCE],
      reviewed_by: null,
      cover: null,
      author: null,
    };
    const data = articleData(article, { category: 3, tags: [4], primaryService: 5 });
    expect(data).toMatchObject({
      title: 'لمینت یا کامپوزیت؟',
      slug: 'لمینت-یا-کامپوزیت',
      excerpt: 'خلاصهٔ کوتاه',
      category: 3,
      tags: [4],
      primaryService: 5,
      isMedical: true,
      faqs: [{ question: 'پرسش؟', answer: 'پاسخ.' }],
      sources: [
        {
          title: 'Tooth decay',
          publisher: 'NHS',
          url: SOURCE.url,
          accessedOn: dayOnly('2026-10-18'),
        },
      ],
      seo: { title: 'لمینت یا کامپوزیت', description: 'توضیح' },
    });
    expect(data.body).toEqual(articleBody(blocks));
    for (const key of ['reviewer', 'reviewedAt', 'cover', 'authorDoctor', 'staffAuthorName']) {
      expect(data).not.toHaveProperty(key);
    }
    expect(() =>
      articleData(
        { ...article, slug: 'لمینت یا کامپوزیت' },
        { category: 3, tags: [], primaryService: null },
      ),
    ).toThrow(SeedDataError);
    expect(
      taxonomyData({ slug: 'زیبایی-لبخند', title: 'زیبایی لبخند', description: 'توضيح' }),
    ).toEqual({
      slug: 'زیبایی-لبخند',
      title: 'زیبایی لبخند',
      description: 'توضیح',
    });
    expect(taxonomyData({ slug: 'لمینت', title: 'لمینت' })).toEqual({
      slug: 'لمینت',
      title: 'لمینت',
      description: null,
    });
  });

  it("ST9 services and guides map sources; reviewed_by never becomes a key, so a sync keeps the admin's reviewer", () => {
    const restoration = services.find((s) => s.key === 'restoration')!;
    const data = serviceData({ ...restoration, sources: [SOURCE], reviewed_by: null }, 1, 10);
    expect(data.sources).toEqual([
      {
        title: 'Tooth decay',
        publisher: 'NHS',
        url: SOURCE.url,
        accessedOn: dayOnly('2026-10-18'),
      },
    ]);
    expect(data).not.toHaveProperty('reviewedBy');
    expect(serviceData({ ...restoration, sources: undefined }, 1, 10)).not.toHaveProperty(
      'sources',
    );
    const guide = pageData({
      key: 'guide-aftercare',
      slug: 'مراقبت-بعد-از-درمان',
      title: 'مراقبت',
      sources: [SOURCE],
      reviewed_by: null,
    });
    expect(guide.sources).toHaveLength(1);
    expect(guide).not.toHaveProperty('reviewer');
  });

  it('ST10 fill: a Lexical value is one field; a filled field is never touched', () => {
    const body = lexicalFrom('متن');
    expect(
      emptyFieldsPatch(
        { body: null, seo: { description: 'از مدیر' } },
        { body, seo: { description: 'از yaml', title: 'عنوان' } },
      ),
    ).toEqual({ body, seo: { title: 'عنوان' } });
    expect(emptyFieldsPatch({ body: lexicalFrom('ویرایش مدیر') }, { body })).toEqual({});
  });

  it('ST11 sync writes only a changed document: the stored document contains the seed values', () => {
    const stored = {
      id: 1,
      title: 'الف',
      faqs: [{ id: 'x', question: 'پ', answer: 'ج' }],
      seo: { title: null, noindex: false },
      tags: [1, 2],
    };
    expect(
      contains(stored, {
        title: 'الف',
        faqs: [{ question: 'پ', answer: 'ج' }],
        seo: { title: null },
        note: null,
        tags: [1, 2],
      }),
    ).toBe(true);
    expect(contains(stored, { title: 'ب' })).toBe(false);
    expect(contains(stored, { faqs: [] })).toBe(false);
    expect(contains(stored, { tags: [2, 1] })).toBe(false);
    expect(contains(stored, { seo: { title: 'ع' } })).toBe(false);
    expect(contains(undefined, { title: 'الف' })).toBe(false);
  });
});

describe('phase 6 copy checks (C10): red until the copy lanes write the yaml', () => {
  const servicesFile = readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).data;
  const pages = readYaml(ROOT, 'src/seed/data/pages.yaml', pagesYaml).data.pages;
  const doctors = readYaml(ROOT, 'content/data/doctors.yaml', doctorsYaml).data.doctors;
  const articlesFile = readYaml(ROOT, 'src/seed/data/articles.yaml', articlesYaml).data;
  const known = seedPaths({
    services: servicesFile.services,
    pages,
    articles: articlesFile.articles,
    doctors,
  });

  it.each(servicesFile.services.map((s) => [s.key, s] as const))(
    'SC8 service %s: 5-8 FAQs, a source, a content block, search title and description',
    (_, service) => {
      const data = serviceData(service, 1, 10);
      expect.soft(data.faqs.length, 'faqs').toBeGreaterThanOrEqual(5);
      expect.soft(data.faqs.length, 'faqs').toBeLessThanOrEqual(8);
      expect.soft(service.sources?.length ?? 0, 'sources').toBeGreaterThanOrEqual(1);
      expect
        .soft(
          data.body.some((b) => b.blockType === 'content'),
          'content block',
        )
        .toBe(true);
      expect.soft(titleRule(data.seo.title, DEFAULT_TITLE_SUFFIX), 'seo_title').toBe(true);
      expect.soft(descriptionRule(data.seo.description, true), 'seo_description').toBe(true);
    },
  );

  it.each(pages.filter((p) => isGuideKey(p.key)).map((p) => [p.key, p] as const))(
    'SC9 guide %s: a content block, a source, search title and description',
    (_, page) => {
      const data = pageData(page);
      expect
        .soft(
          data.blocks.some((b) => b.blockType === 'content'),
          'content block',
        )
        .toBe(true);
      expect.soft(page.sources?.length ?? 0, 'sources').toBeGreaterThanOrEqual(1);
      expect.soft(titleRule(data.seo.title, DEFAULT_TITLE_SUFFIX), 'seo_title').toBe(true);
      expect.soft(descriptionRule(data.seo.description, true), 'seo_description').toBe(true);
    },
  );

  it('SC10 articles.yaml holds the six articles of the keyword map', () => {
    expect(articlesFile.articles).toHaveLength(6);
  });

  it.each(articlesFile.articles.map((a) => [a.slug, a] as const))(
    'SC11 article %s: the publish checklist the yaml can meet',
    (_, article) => {
      // Links resolve to the target's natural key, so the rule can name the service and the guide.
      const link = (p: string) => {
        const target = known.get(normalizePath(p));
        return target ? { relationTo: target.relationTo, value: target.key } : null;
      };
      const data = articleData(
        article,
        { category: 1, tags: [], primaryService: article.primary_service },
        link,
      );
      expect.soft(codePoints(data.title), 'title').toBeLessThanOrEqual(90);
      expect.soft(codePoints(data.excerpt), 'excerpt').toBeGreaterThanOrEqual(80);
      expect.soft(codePoints(data.excerpt), 'excerpt').toBeLessThanOrEqual(220);
      expect.soft(titleRule(data.seo.title, DEFAULT_TITLE_SUFFIX), 'seo_title').toBe(true);
      expect.soft(descriptionRule(data.seo.description, true), 'seo_description').toBe(true);
      expect.soft(slugRule(data.slug, 60, ARTICLE_RESERVED_SLUGS), 'slug').toBe(true);
      expect.soft(headingsRule(data.body), 'two H2').toBe(true);
      expect.soft(article.sources?.length ?? 0, 'sources').toBeGreaterThanOrEqual(1);
      const targets = internalLinks(data.body).map((l) => ({
        ...l,
        title: String(l.id),
        published: true,
        guide: l.relationTo === 'pages' && isGuideKey(String(l.id)),
      }));
      const primary = article.primary_service
        ? { id: article.primary_service, title: article.primary_service }
        : null;
      expect.soft(linksRule(targets, primary), 'links').toBe(true);
      expect
        .soft(
          articlesFile.categories.map((c) => c.slug),
          'category',
        )
        .toContain(article.category);
      for (const tag of article.tags ?? []) {
        expect
          .soft(
            articlesFile.tags.map((t) => t.slug),
            'tags',
          )
          .toContain(tag);
      }
      if (article.primary_service) {
        expect
          .soft(
            servicesFile.services.map((s) => s.key),
            'primary_service',
          )
          .toContain(article.primary_service);
      }
    },
  );

  it('SC12 article categories are not named like a service (V-CATTERM); every slug is final', () => {
    const terms = servicesFile.services.flatMap((s) =>
      [s.nav_label, s.h1, s.search_terms[0]].filter((t): t is string => Boolean(t)),
    );
    for (const category of articlesFile.categories) {
      expect(categoryTermRule(category.title, terms), category.slug).toBe(true);
      expect(slugRule(taxonomyData(category).slug, 80), category.slug).toBe(true);
    }
    for (const tag of articlesFile.tags) {
      expect(slugRule(taxonomyData(tag).slug, 80), tag.slug).toBe(true);
    }
  });

  it('SC14 every seeded string fits the length limits of its field, so the seeder never stops on one', () => {
    const ref = { category: 1, tags: [], primaryService: null };
    const problems = [
      ...servicesFile.categories.flatMap((c) =>
        lengthProblems(ServiceCategories.fields, categoryData(c), c.key),
      ),
      ...servicesFile.services.flatMap((s) => [
        ...lengthProblems(Services.fields, serviceData(s, 1, 10), s.key),
        ...(s.tiers ?? []).flatMap((tier, i) =>
          lengthProblems(ServiceTiers.fields, tierData(tier, 1, i), `${s.key}.${tier.key}`),
        ),
      ]),
      ...pages.flatMap((p) => lengthProblems(Pages.fields, pageData(p), p.key)),
      ...articlesFile.articles.flatMap((a) =>
        lengthProblems(Articles.fields, articleData(a, ref), a.slug),
      ),
      ...articlesFile.categories.flatMap((c) =>
        lengthProblems(ArticleCategories.fields, taxonomyData(c), c.slug),
      ),
      ...articlesFile.tags.flatMap((t) => lengthProblems(Tags.fields, taxonomyData(t), t.slug)),
    ];
    expect(problems).toEqual([]);
  });
});

const ARTICLE_BLOCK_FIELDS = new Map(ARTICLE_BLOCKS.map((b) => [b.slug, b.fields]));

/**
 * The text limits (maxLength, minLength) a seeded value breaks, walked from the collection config
 * the way Payload validates it: one line per string, with its path.
 */
function lengthProblems(fields: Field[], data: unknown, at: string, out: string[] = []): string[] {
  if (!data || typeof data !== 'object') return out;
  const row = data as Record<string, unknown>;
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        lengthProblems(tab.fields, 'name' in tab ? row[tab.name] : row, at, out);
      }
    } else if (!('name' in field)) {
      if ('fields' in field) lengthProblems(field.fields, row, at, out);
    } else {
      const value = row[field.name];
      const where = `${at}.${field.name}`;
      if (field.type === 'text' || field.type === 'textarea') {
        for (const text of [value].flat()) {
          if (typeof text !== 'string') continue;
          if (field.maxLength && text.length > field.maxLength) {
            out.push(`${where}: ${text.length} > ${field.maxLength}: ${text}`);
          }
          if (field.minLength && text.length < field.minLength) {
            out.push(`${where}: ${text.length} < ${field.minLength}: ${text}`);
          }
        }
      } else if (field.type === 'group') {
        lengthProblems(field.fields, value, where, out);
      } else if (field.type === 'array' && Array.isArray(value)) {
        value.forEach((item, i) => lengthProblems(field.fields, item, `${where}.${i}`, out));
      } else if (field.type === 'blocks' && Array.isArray(value)) {
        value.forEach((item: { blockType?: string }, i) => {
          const block = field.blocks.find((b) => b.slug === item.blockType);
          if (block) lengthProblems(block.fields, item, `${where}.${i}`, out);
        });
      } else if (field.type === 'richText') {
        lexicalBlockProblems(value, where, out);
      }
    }
  }
  return out;
}

/** Lexical `block` nodes (callout, table) carry their own fields. */
function lexicalBlockProblems(node: unknown, at: string, out: string[]) {
  if (!node || typeof node !== 'object') return;
  const { type, fields, children, root } = node as Record<string, unknown>;
  if (type === 'block') {
    const blockFields = ARTICLE_BLOCK_FIELDS.get((fields as { blockType: string }).blockType);
    if (blockFields) lengthProblems(blockFields, fields, at, out);
  }
  for (const child of [root, ...(Array.isArray(children) ? children : [])]) {
    lexicalBlockProblems(child, at, out);
  }
}
