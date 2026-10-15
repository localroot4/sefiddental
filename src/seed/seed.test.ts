import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ICONS } from '@/components/ui/icons';
import {
  BANNED_WORDS,
  DEFAULT_TITLE_SUFFIX,
  descriptionRule,
  richProseRule,
  subtextRule,
  titleRule,
} from '@/fields/validators';
import { t } from '@/i18n/fa';

import { emptyFieldsPatch } from './run';
import { clinicYaml, doctorsYaml, pagesYaml, servicesYaml } from './schemas';
import { readYaml, SeedSourceError } from './sources';
import {
  ACCENT_MAP,
  aliasRedirect,
  blockData,
  categoryData,
  checkedSlug,
  financingData,
  globalsData,
  isSeedableTestimonial,
  isTemplateDoctor,
  lexicalFrom,
  pageData,
  SeedDataError,
  serviceData,
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
    for (const word of [...BANNED_WORDS, ...LABELS, 'بدون درد', 'متخصص']) {
      expect(text).not.toContain(word);
    }
    expect(text).not.toContain('اولین کلینیک'); // the ranking claim (gap 28); ordinals are fine
    expect(text).not.toMatch(/طرف قرارداد|سایر بیمه/); // unconfirmed insurer claims (F31, gap 51)
    expect(text).not.toMatch(/[يكى]/);
    expect(text).not.toMatch(/[—–]/);
    expect(text).not.toMatch(/[0-9]/);
    expect(text).not.toMatch(/\[\[NEEDS_CLIENT/);
    expect(text).not.toMatch(/(^|[\s«])ن?می [آ-ی]/); // missing ZWNJ after می
    expect(text).not.toMatch(/ (ها|های|هایی|تر|ترین)([\s.،؟»]|$)/); // missing ZWNJ before a suffix
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
