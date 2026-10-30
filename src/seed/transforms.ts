import { createHash } from 'node:crypto';

import { zonedWallTimeToInstant, type DateKey } from '@/lib/jalali';
import { buildPath, normalizePath, type PathCollection } from '@/lib/paths';
import { persianSlug } from '@/lib/persianSlug';
import { normalizeLetters, normalizePersian, normalizeZwnj } from '@/lib/persianText';

import type { ArticlesYaml, ClinicYaml, InsurancesYaml, PagesYaml, ServicesYaml } from './schemas';

/**
 * Pure yaml-to-document mappers (spec-data 8.3-8.5). Seeders only fix letters and ZWNJ (freeze
 * decision 34); the collection hooks normalize the rest on save.
 */

export const fixText = (value: string): string => normalizeZwnj(normalizeLetters(value)).trim();
const opt = (value: string | null | undefined): string | null => (value ? fixText(value) : null);

/** services.yaml accents to the design token names (spec-data conflict 2). */
export const ACCENT_MAP = {
  warm: 'cosmetic',
  brand: 'surgery',
  green: 'restorative',
  sky: 'ortho',
  yellow: 'kids',
} as const;

export class SeedDataError extends Error {}

type Category = ServicesYaml['categories'][number];
type Service = ServicesYaml['services'][number];
type Article = ArticlesYaml['articles'][number];
type Faq = { question: string; answer: string };
type SourceYaml = NonNullable<Service['sources']>[number];
type BlockYaml =
  NonNullable<Service['body']>[number] | NonNullable<PagesYaml['pages'][number]['blocks']>[number];
type Id = number | string;

/** The collections the rich-text link drawer offers (src/fields/richText.ts LinkFeature). */
export type LinkCollection = Extract<PathCollection, 'services' | 'pages' | 'articles' | 'doctors'>;
export type LinkDoc = { relationTo: LinkCollection; value: Id };
/** A seed link's target document, or null while it does not exist yet. */
export type LinkResolver = (path: string) => LinkDoc | null;

/** `[text](/path)`: a site path only; a query, fragment or other URL is not link syntax. */
const LINK = /\[([^\]\n]+)\]\((\/[^)\s#?]*)\)/g;

export const linkPaths = (text: string): string[] => [...text.matchAll(LINK)].map((m) => m[2]!);

/** Stops the run on a link to a path no seeded document has (`where` is `file:line`). */
export function assertLinks(text: string, known: { has(path: string): boolean }, where: string) {
  const unknown = linkPaths(text).find((target) => !known.has(normalizePath(target)));
  if (unknown !== undefined) throw new SeedDataError(`${where}: unknown link path "${unknown}".`);
}

/** Every public path a seed file gives a document, with the document's natural key. */
export function seedPaths(files: {
  services: readonly { key: string; slug: string }[];
  pages: readonly { key: string; slug: string }[];
  articles: readonly { slug: string }[];
  doctors: readonly { slug: string }[];
}): Map<string, { relationTo: LinkCollection; key: string }> {
  const paths = new Map<string, { relationTo: LinkCollection; key: string }>();
  const add = (relationTo: LinkCollection, key: string, path: string | null) => {
    if (path) paths.set(normalizePath(path), { relationTo, key });
  };
  for (const s of files.services) add('services', s.key, buildPath('services', s));
  for (const p of files.pages)
    add('pages', p.key, buildPath('pages', { ...p, slug: p.slug || null }));
  for (const a of files.articles) add('articles', a.slug, buildPath('articles', a));
  for (const d of files.doctors) add('doctors', d.slug, buildPath('doctors', d));
  return paths;
}

// Stable 24-hex ids (the Lexical node id format), so the same yaml gives the same JSON.
const nodeId = (seed: string): string => createHash('sha1').update(seed).digest('hex').slice(0, 24);

const textNode = (text: string, fix: (value: string) => string = fixText) => ({
  type: 'text',
  text: fix(text),
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
});
type LexicalNode = { type: string; version: number; [key: string]: unknown };
const element = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}) => ({
  type,
  children,
  direction: 'rtl' as const,
  format: '' as const,
  indent: 0,
  version: 1,
  ...extra,
});

// Inline text keeps its edge spaces: they separate it from a link.
const fixInline = (value: string): string => normalizeZwnj(normalizeLetters(value));

/**
 * Lexical JSON from the Markdown subset of the seed copy: `## ` to `#### ` headings, `- ` bullet
 * lists, and paragraphs separated by a blank line (lines of one paragraph are joined). In a
 * paragraph or a list item, `[text](/path)` is an internal document link when `link` finds the
 * document; without `link`, or before the target exists, only the text stays.
 */
export function lexicalFrom(source: string, link?: LinkResolver) {
  const children: LexicalNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let links = 0;
  const inline = (text: string): LexicalNode[] => {
    const nodes: LexicalNode[] = [];
    let plain = '';
    let last = 0;
    for (const match of text.matchAll(LINK)) {
      plain += text.slice(last, match.index);
      last = match.index + match[0].length;
      const doc = link?.(match[2]!) ?? null;
      if (!doc) {
        plain += match[1];
        continue;
      }
      if (plain) nodes.push(textNode(plain, fixInline));
      plain = '';
      links += 1;
      nodes.push(
        element('link', [textNode(match[1]!)], {
          version: 3,
          id: nodeId(`${links}|${match[2]}|${source}`),
          fields: { linkType: 'internal', newTab: false, doc },
        }),
      );
    }
    plain += text.slice(last);
    if (plain) nodes.push(textNode(plain, fixInline));
    return nodes;
  };
  const flush = () => {
    if (paragraph.length > 0)
      children.push(
        element('paragraph', inline(paragraph.join(' ')), { textFormat: 0, textStyle: '' }),
      );
    if (list.length > 0)
      children.push(
        element(
          'list',
          list.map((item, i) => element('listitem', inline(item), { value: i + 1 })),
          { listType: 'bullet', start: 1, tag: 'ul' },
        ),
      );
    paragraph = [];
    list = [];
  };
  for (const raw of source.split('\n')) {
    const line = raw.trim();
    const heading = /^(#{2,4}) (.+)$/.exec(line);
    const bullet = line.startsWith('- ');
    // A blank line, a heading or a switch between list and paragraph ends the open block.
    if (!line || heading || (bullet && paragraph.length > 0) || (!bullet && list.length > 0))
      flush();
    if (heading) {
      children.push(element('heading', [textNode(heading[2]!)], { tag: `h${heading[1]!.length}` }));
    } else if (bullet) list.push(line.slice(2));
    else if (line) paragraph.push(line);
  }
  flush();
  return { root: element('root', children) };
}

const faqsData = (rows: readonly Faq[] | undefined) =>
  (rows ?? []).map((row) => ({ question: fixText(row.question), answer: fixText(row.answer) }));

/** H27: source titles and URLs are stored as published, never normalized (H9). */
const sourcesData = (rows: readonly SourceYaml[]) =>
  rows.map((row) => ({
    title: row.title.trim(),
    publisher: row.publisher,
    url: row.url,
    accessedOn: dayOnly(row.accessed_on),
  }));
// A missing `sources` key writes no key, so a sync keeps what the admin entered.
const sourcesField = (rows: readonly SourceYaml[] | undefined) =>
  rows ? { sources: sourcesData(rows) } : {};

/** One seed block to its Payload block (src/blocks). */
export function blockData(block: BlockYaml, link?: LinkResolver) {
  switch (block.type) {
    case 'content':
      return { blockType: 'content', body: lexicalFrom(block.text, link) };
    case 'callout':
      return { blockType: 'callout', tone: block.tone ?? 'info', text: fixText(block.text) };
    case 'steps':
      return {
        blockType: 'steps',
        items: block.items.map((item) => ({
          title: fixText(item.title),
          text: fixText(item.text),
        })),
      };
    case 'faq':
      return { blockType: 'faq', items: faqsData(block.items) };
  }
}

export function categoryData(category: Category) {
  return {
    key: category.key,
    title: fixText(category.title),
    navLabel: fixText(category.nav_label ?? category.title),
    slug: category.slug,
    standalone: category.standalone ?? false,
    accent: ACCENT_MAP[category.accent],
    icon: category.icon ?? null,
    order: category.order,
    summary: opt(category.summary),
    intro: opt(category.intro),
    faqs: faqsData(category.faqs),
    seo: {
      ...(category.seo_title ? { title: fixText(category.seo_title) } : {}),
      ...(category.seo_description ? { description: fixText(category.seo_description) } : {}),
    },
  };
}

/** The yaml slug is final: it must already be in persianSlug form, else the run stops. */
export function checkedSlug(slug: string, where: string): string {
  if (persianSlug(slug) !== slug) {
    throw new SeedDataError(
      `${where}: slug "${slug}" is not in its final form (expected "${persianSlug(slug)}").`,
    );
  }
  return slug;
}

export function serviceData(
  service: Service,
  categoryId: number | string,
  order: number,
  link?: LinkResolver,
) {
  return {
    key: service.key,
    category: categoryId,
    navLabel: fixText(service.nav_label),
    h1: fixText(service.h1),
    slug: checkedSlug(service.slug, `services.yaml ${service.key}`),
    bookingGroup: service.booking_group,
    priority: service.priority,
    order,
    emergencyLink: service.emergency_link ?? false,
    summary: opt(service.summary),
    facts: {
      sessions: opt(service.sessions),
      duration: opt(service.duration),
      anesthesia: opt(service.anesthesia),
      recovery: opt(service.recovery),
    },
    priceFrom: service.price_from,
    body: (service.body ?? []).map((block) => blockData(block, link)),
    faqs: faqsData(service.faqs),
    ...sourcesField(service.sources),
    searchTerms: service.search_terms.map(fixText),
    internalNote: service.scope_to_verify ?? null,
    scopeVerified: !service.scope_to_verify,
    seo: {
      title: fixText(service.seo_title),
      ...(service.seo_description ? { description: fixText(service.seo_description) } : {}),
    },
  };
}

export function tierData(
  tier: NonNullable<Service['tiers']>[number],
  serviceId: number | string,
  index: number,
) {
  return {
    service: serviceId,
    key: tier.key,
    name: fixText(tier.name),
    description: fixText(tier.description),
    priceFrom: tier.price_from,
    order: (index + 1) * 10,
  };
}

/** `/vip` and other aliases: one redirect row to the service (with the tier anchor of ia.md). */
export function aliasRedirect(service: Service) {
  if (!service.alias) return null;
  const anchor = service.tiers?.length ? '#سطح-ترمیم' : '';
  return {
    from: service.alias,
    to: `/خدمات/${service.slug}${anchor}`,
    statusCode: '301' as const,
    source: 'alias' as const,
    active: true,
  };
}

/** A day-only date stored at 12:00 Tehran, as the date fields with a time zone expect. */
export const dayOnly = (key: string): string =>
  zonedWallTimeToInstant(key as DateKey, '12:00').toISOString();

export function financingData(row: ClinicYaml['financing'][number], index: number) {
  const approved = /^approved_(\d{4}-\d{2}-\d{2})$/.exec(row.status);
  return {
    key: row.key,
    title: fixText(row.title_fa),
    provider: opt(row.provider),
    maxAmountToman: row.max_amount_toman ?? null,
    whoApplies: opt(row.who_applies_fa),
    surchargeNote: opt(row.surcharge_note_fa),
    approvalStatus: approved ? ('approved' as const) : ('pending' as const),
    approvedOn: approved?.[1] ? dayOnly(approved[1]) : null,
    enabled: row.enabled ?? false,
    order: (index + 1) * 10,
  };
}

const stat = (value: number | null | undefined) => ({ value: value ?? null, verified: false });

/** clinic.yaml to the four content globals (spec-data 8.4). Unverified facts stay unverified. */
export function globalsData(clinic: ClinicYaml) {
  return {
    clinic: {
      nameFa: fixText(clinic.name_fa),
      nameShortFa: opt(clinic.name_short_fa),
      nameEn: clinic.name_en ?? null,
      tagline: opt(clinic.tagline_fa),
      taglineApproved: false,
      contactHeadline: opt(clinic.contact_headline_fa),
      footerLine: opt(clinic.footer_line_fa),
      domain: clinic.domain,
      address: {
        fullFa: fixText(clinic.address.full_fa),
        city: fixText(clinic.address.city),
        district: opt(clinic.address.district),
        postalCode: clinic.address.postal_code ?? null,
        lat: clinic.address.lat ?? null,
        lng: clinic.address.lng ?? null,
        accessNotes: opt(clinic.address.access_notes_fa),
      },
      phones: {
        landline: clinic.phones.landline,
        mobile: clinic.phones.mobile ?? null,
        whatsapp: clinic.phones.whatsapp ?? null,
        whatsappVerified: false,
        telegram: clinic.phones.telegram ?? null,
        telegramVerified: false,
      },
      reception: { callbackMinutes: 10 },
      hours: {
        note: opt(clinic.hours.note_fa),
        weekly: clinic.hours.weekly.map((rule) => ({
          days: rule.days,
          open: rule.open,
          close: rule.close,
        })),
      },
      social: {
        instagram: clinic.social.instagram ?? null,
        telegramChannel: clinic.social.telegram_channel ?? null,
        aparat: clinic.social.aparat ?? null,
      },
      stats: {
        yearsActive: stat(clinic.stats.years_active),
        specialistDentists: stat(clinic.stats.specialist_dentists),
        specialtyClinics: stat(clinic.stats.specialty_clinics),
        insurers: stat(clinic.stats.insurances),
      },
      legal: {
        licenseNumber: clinic.legal.license_number ?? null,
        technicalSupervisor: opt(clinic.legal.technical_supervisor),
      },
      emergency: { policy: opt(clinic.emergency.policy_fa), priorityPromiseConfirmed: false },
    },
    'seo-defaults': {
      siteName: 'کلینیک دندانپزشکی سفید',
      titleSuffix: ' | کلینیک دندانپزشکی سفید',
      shortTitleSuffix: ' | کلینیک سفید',
      defaultDescription: opt(clinic.seo?.default_description_fa),
      areaServed: clinic.market.target_areas_fa.map(fixText),
      secondaryAreas: clinic.market.secondary_areas_fa.map(fixText),
    },
    features: {
      freeConsultation: true,
      emergencyEnabled: clinic.emergency.offered,
      introEnabled: true,
      heroMarkRelief: true,
      ga4Enabled: false,
      qualityTierOverride: 'auto',
    },
    notifier: {
      mail: { enabled: false },
      telegram: { enabled: false },
      sms: { enabled: false, patientConfirmation: false },
      errorDedupMinutes: 60,
    },
  };
}

/** The insurer natural key: the name exactly as the collection hook stores it (H-NORM names). */
export const insurerKey = (name: string): string => normalizePersian(name);

export function insurancesData(file: InsurancesYaml) {
  return [
    ...file.featured.map((row, index) => ({
      name: insurerKey(row.name_fa),
      featured: true,
      order: (index + 1) * 10,
      logo: row.logo || null,
    })),
    ...(file.others ?? []).map((row, index) => ({
      name: insurerKey(row.name_fa),
      featured: false,
      order: 100 + index,
      logo: row.logo || null,
    })),
  ];
}

/** Warning when clinic.yaml's insurer list differs from content/data/insurances.yaml (conflict 4). */
export function insurerDifference(clinic: ClinicYaml, insurers: InsurancesYaml): string | null {
  const a = (clinic.insurances?.featured ?? []).map(insurerKey).sort();
  const b = insurers.featured.map((row) => insurerKey(row.name_fa)).sort();
  return a.join('|') === b.join('|')
    ? null
    : 'docs/content/clinic.yaml insurances.featured differs from content/data/insurances.yaml; the latter is seeded.';
}

export function pageData(page: PagesYaml['pages'][number], link?: LinkResolver) {
  return {
    key: page.key,
    slug: page.slug === '' ? null : page.slug,
    title: fixText(page.title),
    lead: page.lead ? fixText(page.lead) : null,
    ...(page.subtext ? { hero: { subtext: fixText(page.subtext) } } : {}),
    sections: (page.sections ?? []).map((row) => ({
      key: row.key,
      heading: fixText(row.heading),
      intro: opt(row.intro),
    })),
    blocks: (page.blocks ?? []).map((block) => blockData(block, link)),
    ...sourcesField(page.sources),
    seo: {
      ...(page.seo_title ? { title: fixText(page.seo_title) } : {}),
      ...(page.seo_description ? { description: fixText(page.seo_description) } : {}),
      ...(page.noindex ? { noindex: true } : {}),
    },
  };
}

/**
 * An article body (H8, H29): content blocks become Lexical nodes and callouts and tables become
 * Lexical `block` nodes (the article blocks of src/blocks/articleBlocks.ts), in yaml order.
 */
export function articleBody(blocks: Article['body'], link?: LinkResolver) {
  const children = blocks.flatMap((block, index): LexicalNode[] => {
    if (block.type === 'content') return lexicalFrom(block.text, link).root.children;
    const fields =
      block.type === 'callout'
        ? { blockType: 'callout', tone: block.tone ?? 'info', text: fixText(block.text) }
        : {
            blockType: 'table',
            caption: fixText(block.caption),
            head: block.head.map(fixText),
            rows: block.rows.map((cells) => ({ cells: cells.map(fixText) })),
          };
    const id = nodeId(`${index}|${JSON.stringify(fields)}`);
    return [{ type: 'block', version: 2, format: '', fields: { id, blockName: '', ...fields } }];
  });
  return { root: element('root', children) };
}

/** Article categories and tags (natural key: the slug). */
export function taxonomyData(row: { slug: string; title: string; description?: string }) {
  return {
    slug: checkedSlug(row.slug, `articles.yaml ${row.slug}`),
    title: fixText(row.title),
    description: opt(row.description),
  };
}

/**
 * An article draft (H29). Reviewer, review date, cover and author stay empty: they are client
 * answers (gaps 42 and 58) that the admin sets.
 */
export function articleData(
  article: Article,
  refs: { category: Id; tags: Id[]; primaryService: Id | null },
  link?: LinkResolver,
) {
  return {
    title: fixText(article.title),
    slug: checkedSlug(article.slug, `articles.yaml ${article.slug}`),
    excerpt: fixText(article.excerpt),
    body: articleBody(article.body, link),
    category: refs.category,
    tags: refs.tags,
    primaryService: refs.primaryService,
    isMedical: article.is_medical,
    faqs: faqsData(article.faqs),
    ...sourcesField(article.sources),
    seo: { title: fixText(article.seo_title), description: fixText(article.seo_description) },
  };
}

/** A yaml template entry (empty name or slug) is skipped and reported, never seeded. */
export const isTemplateDoctor = (row: { name_fa: string; slug: string }): boolean =>
  row.name_fa.trim() === '' || row.slug.trim() === '';

export const isSeedableTestimonial = (row: {
  patient_label_fa: string;
  consent_confirmed: boolean;
}): boolean => row.patient_label_fa.trim() !== '' && row.consent_confirmed === true;
