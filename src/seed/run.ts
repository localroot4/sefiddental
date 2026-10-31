import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CollectionSlug, GlobalSlug, Payload, Where } from 'payload';
import { ValidationError } from 'payload';

import { hashedName } from '@/hooks/media';
import { buildPath, isGuideKey, normalizePath, PAGE_KEYS, type PathDoc } from '@/lib/paths';

import {
  articlesYaml,
  caseYaml,
  clinicYaml,
  doctorsYaml,
  insurancesYaml,
  pagesYaml,
  servicesYaml,
  testimonialsYaml,
} from './schemas';
import { readYaml, type YamlMarker } from './sources';
import {
  aliasRedirect,
  articleData,
  assertLinks,
  categoryData,
  checkedSlug,
  financingData,
  fixText,
  globalsData,
  insurancesData,
  insurerDifference,
  insurerKey,
  isSeedableTestimonial,
  isTemplateDoctor,
  type LinkCollection,
  type LinkDoc,
  type LinkResolver,
  pageData,
  SeedDataError,
  seedPaths,
  serviceData,
  taxonomyData,
  tierData,
} from './transforms';

/**
 * The seeder (spec-data 8.1). create-only (default) creates what is missing and never updates;
 * globals get only their empty fields. sync updates seeded fields that differ (refused in
 * production). fill (H43, C8) creates what is missing and fills empty fields, never a filled one
 * and never on a document with a medical reviewer (C1).
 * dry-run writes nothing. Records are matched by natural keys, so a second run changes nothing.
 * copy-sync (./copySync.ts, allowed in production) writes changed copy over untouched fields only.
 */

export type SeedMode = 'create-only' | 'sync' | 'fill' | 'dry-run';

export const SEED_FILES = {
  services: 'docs/content/services.yaml',
  clinic: 'docs/content/clinic.yaml',
  insurances: 'content/data/insurances.yaml',
  doctors: 'content/data/doctors.yaml',
  testimonials: 'content/data/testimonials.yaml',
  cases: 'content/before-after',
  pages: 'src/seed/data/pages.yaml',
  articles: 'src/seed/data/articles.yaml',
} as const;

export interface SeedReport {
  mode: SeedMode;
  created: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
  /** Template or incomplete entries left out, as `file:line reason`. */
  templates: string[];
  warnings: string[];
  markers: YamlMarker[];
}

export const SEED_CONTEXT = { seeding: true, skipRevalidate: true, skipRedirects: true } as const;

type Id = number | string;
type Data = Record<string, unknown>;

/** One upsert: `existing` is the stored latest version, `written` the fields this run wrote. */
interface Upserted {
  id: Id;
  created: boolean;
  existing?: Data;
  written: string[];
  /** Whether the write was a draft save (a version only), so a follow-up write does the same. */
  draft: boolean;
  /** The collection and natural key, for the report. */
  label: string;
}

// The Local API is generic over generated types; the seeder builds data from yaml at run time.
export interface LooseApi {
  find(args: Data): Promise<{ docs: Data[] }>;
  create(args: Data): Promise<Data>;
  update(args: Data): Promise<Data>;
  findGlobal(args: Data): Promise<Data>;
  updateGlobal(args: Data): Promise<Data>;
}

const isEmpty = (value: unknown): boolean =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

// A group recurses; an array or a Lexical value (`{ root }`) is one field.
export const isGroup = (value: unknown): value is Data =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !('root' in value);

/** The seed values whose current value is empty, recursing into groups (create-only, fill). */
export function emptyFieldsPatch(current: unknown, seed: Data): Data {
  const patch: Data = {};
  const now = (current ?? {}) as Data;
  for (const [key, value] of Object.entries(seed)) {
    if (isGroup(value)) {
      const inner = emptyFieldsPatch(now[key], value as Data);
      if (Object.keys(inner).length > 0) patch[key] = inner;
    } else if (isEmpty(now[key]) && !isEmpty(value)) {
      patch[key] = value;
    } else if (now[key] === undefined && typeof value === 'boolean') {
      patch[key] = value;
    }
  }
  return patch;
}

/**
 * sync: true when the stored document already holds every seed value. Keys the seed does not
 * set (ids, computed fields) are ignored; arrays compare by position; null equals a missing value.
 */
export function contains(stored: unknown, seed: unknown): boolean {
  if (seed === null || seed === undefined) return stored === null || stored === undefined;
  if (Array.isArray(seed)) {
    return (
      Array.isArray(stored) &&
      stored.length === seed.length &&
      seed.every((value, i) => contains(stored[i], value))
    );
  }
  if (typeof seed === 'object') {
    if (stored === null || typeof stored !== 'object') return false;
    return Object.entries(seed).every(([key, value]) => contains((stored as Data)[key], value));
  }
  return stored === seed;
}

/** A Payload ValidationError as `path: message` pairs, for a report line. */
export const refusal = (err: ValidationError): string =>
  err.data.errors.map((e) => `${e.path}: ${e.message}`).join(' ');

function deepMerge(base: Data, patch: Data): Data {
  const out: Data = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prev = out[key];
    out[key] =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev &&
      typeof prev === 'object'
        ? deepMerge(prev as Data, value as Data)
        : value;
  }
  return out;
}

/** Link targets by path of the stored services, pages, articles and doctors. */
export async function storedLinkTargets(api: LooseApi): Promise<Map<string, LinkDoc>> {
  const targets = new Map<string, LinkDoc>();
  for (const relationTo of ['services', 'pages', 'articles', 'doctors'] as const) {
    const stored = await api.find({ collection: relationTo, depth: 0, pagination: false });
    for (const doc of stored.docs) {
      const target = buildPath(relationTo, doc as PathDoc);
      if (target) targets.set(normalizePath(target), { relationTo, value: doc.id as Id });
    }
  }
  return targets;
}

export async function runSeed(
  payload: Payload,
  options: { mode: SeedMode; root: string; nodeEnv?: string },
): Promise<SeedReport> {
  const { mode, root } = options;
  if (mode === 'sync' && options.nodeEnv === 'production') {
    throw new SeedDataError(
      'seed: sync mode is refused when NODE_ENV=production; use create-only.',
    );
  }
  const api = payload as unknown as LooseApi;
  const dry = mode === 'dry-run';
  const report: SeedReport = {
    mode,
    created: {},
    updated: {},
    skipped: {},
    templates: [],
    warnings: [],
    markers: [],
  };
  const bump = (bucket: Record<string, number>, slug: string) => {
    bucket[slug] = (bucket[slug] ?? 0) + 1;
  };
  let fakeId = 0;

  // Every file is read and validated before the first write.
  const services = readYaml(root, SEED_FILES.services, servicesYaml);
  const clinic = readYaml(root, SEED_FILES.clinic, clinicYaml);
  const insurers = readYaml(root, SEED_FILES.insurances, insurancesYaml);
  const doctors = readYaml(root, SEED_FILES.doctors, doctorsYaml);
  const testimonials = readYaml(root, SEED_FILES.testimonials, testimonialsYaml);
  const pages = readYaml(root, SEED_FILES.pages, pagesYaml);
  const articles = readYaml(root, SEED_FILES.articles, articlesYaml);
  const caseDir = path.join(root, SEED_FILES.cases);
  const cases = existsSync(caseDir)
    ? readdirSync(caseDir, { withFileTypes: true })
        .filter(
          (entry) => entry.isDirectory() && existsSync(path.join(caseDir, entry.name, 'case.yaml')),
        )
        .map((entry) => ({
          folder: entry.name,
          source: readYaml(root, `${SEED_FILES.cases}/${entry.name}/case.yaml`, caseYaml),
        }))
    : [];
  for (const source of [services, clinic, insurers, doctors, testimonials, pages, articles]) {
    report.markers.push(...source.markers);
  }
  // Every `[text](/path)` names a document the seed files give a path (H29).
  const known = seedPaths({
    services: services.data.services,
    pages: pages.data.pages,
    articles: articles.data.articles,
    doctors: doctors.data.doctors.filter((row) => !isTemplateDoctor(row)),
  });
  const checkLinks = (
    source: { file: string; lineOf(p: (string | number)[]): number },
    list: string,
    rows: { body?: unknown; blocks?: unknown }[],
    field: 'body' | 'blocks',
  ) =>
    rows.forEach((row, i) =>
      ((row[field] ?? []) as { type: string; text?: string }[]).forEach((block, j) => {
        if (block.type !== 'content' || !block.text) return;
        const where = `${source.file}:${source.lineOf([list, i, field, j, 'text'])}`;
        assertLinks(block.text, known, where);
      }),
    );
  checkLinks(services, 'services', services.data.services, 'body');
  checkLinks(pages, 'pages', pages.data.pages, 'blocks');
  checkLinks(articles, 'articles', articles.data.articles, 'body');
  const unknownPage = pages.data.pages.find((p) => !(PAGE_KEYS as string[]).includes(p.key));
  if (unknownPage)
    throw new SeedDataError(`${SEED_FILES.pages}: unknown page key "${unknownPage.key}".`);
  const insurerWarning = insurerDifference(clinic.data, insurers.data);
  if (insurerWarning) report.warnings.push(insurerWarning);

  /** What this mode writes over a stored document: the changed seed (sync), its empty fields (fill). */
  const patchFor = (existing: Data, seed: Data): Data => {
    if (mode === 'sync') return contains(existing, seed) ? {} : seed;
    return mode === 'fill' ? emptyFieldsPatch(existing, seed) : {};
  };

  /**
   * One write over a stored document; false when nothing was written. fill leaves a document with
   * a medical reviewer as it is (C1). A refused save is reported and the run goes on (H43), except
   * one that publishes a draft: it throws, so upsertGated keeps a draft.
   */
  async function save(
    collection: CollectionSlug,
    stored: Data,
    data: Data,
    draft: boolean,
    label: string,
  ): Promise<boolean> {
    if (mode === 'fill' && (stored.reviewer || stored.reviewedBy)) {
      report.warnings.push(
        `${label}: has a medical reviewer, left unchanged; empty: ${Object.keys(data).join(', ')}`,
      );
      return false;
    }
    if (dry) return true;
    try {
      await api.update({ collection, id: stored.id, data, draft, context: SEED_CONTEXT });
      return true;
    } catch (err) {
      const publishes = data._status === 'published' && stored._status !== 'published';
      if (!(err instanceof ValidationError) || publishes) throw err;
      report.warnings.push(`${label}: not saved (${refusal(err)})`);
      return false;
    }
  }

  /**
   * Find by natural key (the latest version, drafts included); create when missing; else write
   * what `patchFor` returns.
   */
  async function upsert(
    collection: CollectionSlug,
    where: Where,
    data: Data,
    state: { publish: boolean } = { publish: true },
  ): Promise<Upserted> {
    const drafts = Boolean(payload.collections[collection]?.config.versions?.drafts);
    const statusOf = (publish: boolean) =>
      drafts ? { _status: publish ? 'published' : 'draft' } : {};
    const found = await api.find({
      collection,
      where,
      limit: 1,
      depth: 0,
      trash: true,
      pagination: false,
      draft: drafts,
    });
    const existing = found.docs[0];
    const label = `${collection} ${JSON.stringify(where)}`;
    if (existing) {
      // The seeder never unpublishes: `publish: false` holds for a new document or a draft. fill
      // never changes a status at all, so an editor's draft is not published either.
      const publish = state.publish || existing._status === 'published';
      const patch =
        mode === 'fill'
          ? patchFor(existing, data)
          : patchFor(existing, { ...data, ...statusOf(publish) });
      const draft = drafts && (mode === 'fill' ? existing._status !== 'published' : !publish);
      const result = { id: existing.id as Id, created: false, existing, draft, label };
      if (
        Object.keys(patch).length === 0 ||
        !(await save(collection, existing, patch, draft, label))
      ) {
        bump(report.skipped, collection);
        return { ...result, written: [] };
      }
      bump(report.updated, collection);
      return { ...result, written: Object.keys(patch) };
    }
    bump(report.created, collection);
    const draft = drafts && !state.publish;
    const written = Object.keys(data);
    if (dry) return { id: `dry-${(fakeId += 1)}`, created: true, written, draft, label };
    const doc = await api.create({
      collection,
      data: { ...data, ...statusOf(state.publish) },
      draft,
      context: SEED_CONTEXT,
    });
    return { id: doc.id as Id, created: true, written, draft, label };
  }

  // Link targets by path: the stored documents first, so a second run builds the same links.
  const targets = await storedLinkTargets(api);
  const register = (relationTo: LinkCollection, doc: PathDoc, id: Id) => {
    const target = buildPath(relationTo, doc);
    if (target) targets.set(normalizePath(target), { relationTo, value: id });
  };
  /** Builds yaml data with its links; `missed` when a link target does not exist yet. */
  const linked = <T>(build: (link: LinkResolver) => T): { data: T; missed: boolean } => {
    let missed = false;
    const data = build((target) => {
      const doc = targets.get(normalizePath(target)) ?? null;
      if (!doc) missed = true;
      return doc;
    });
    return { data, missed };
  };
  /** Rich-text fields written with a link whose target came later: rewritten once all exist. */
  const relinks: {
    collection: CollectionSlug;
    result: Upserted;
    field: string;
    build: (link: LinkResolver) => Data;
  }[] = [];
  /** Upserts yaml data that may hold links and queues the rewrite of `field` when one missed. */
  async function upsertLinked(
    collection: CollectionSlug,
    where: Where,
    field: string,
    build: (link: LinkResolver) => Data,
    state?: { publish: boolean },
  ) {
    const { data, missed } = linked(build);
    const result = await upsert(collection, where, data, state);
    if (missed && result.written.includes(field))
      relinks.push({ collection, result, field, build });
    return result;
  }

  /** Publish when the publish gate passes, else keep a draft and say why. */
  async function upsertGated(collection: CollectionSlug, where: Where, data: Data, label: string) {
    try {
      return await upsert(collection, where, data, { publish: true });
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      report.warnings.push(`${label}: kept as a draft (${refusal(err)})`);
      return upsert(collection, where, data, { publish: false });
    }
  }

  /** A repository file as a media document, matched by `seedSource`. */
  async function media(relPath: string, alt: string): Promise<Id | null> {
    const abs = path.join(root, relPath);
    if (!existsSync(abs)) {
      report.warnings.push(`${relPath}: file not found, upload skipped`);
      return null;
    }
    const found = await api.find({
      collection: 'media',
      where: { seedSource: { equals: relPath } },
      limit: 1,
      depth: 0,
      trash: true,
    });
    const existing = found.docs[0];
    if (existing) {
      const sha = createHash('sha256').update(readFileSync(abs)).digest('hex');
      const changed =
        existing.filename !== hashedName(path.basename(abs), String(existing.mimeType), sha);
      if (mode === 'sync' && changed) {
        await api.update({
          collection: 'media',
          id: existing.id,
          data: { alt },
          filePath: abs,
          context: SEED_CONTEXT,
        });
        bump(report.updated, 'media');
      } else {
        bump(report.skipped, 'media');
      }
      return existing.id as Id;
    }
    bump(report.created, 'media');
    if (dry) return `dry-${(fakeId += 1)}`;
    const doc = await api.create({
      collection: 'media',
      data: { alt: fixText(alt), seedSource: relPath },
      filePath: abs,
      context: SEED_CONTEXT,
    });
    return doc.id as Id;
  }

  // 1. Categories (standalone ones wait for their service before they publish).
  const categoryIds = new Map<string, Id>();
  const standalone: { key: string; result: Upserted }[] = [];
  for (const category of services.data.categories) {
    const data = categoryData(category);
    const result = await upsert('service-categories', { key: { equals: category.key } }, data, {
      publish: !data.standalone,
    });
    categoryIds.set(category.key, result.id);
    if (data.standalone) standalone.push({ key: category.key, result });
  }

  // 2. Services, their tiers and aliases.
  const serviceIds = new Map<string, Id>();
  const position = new Map<string, number>();
  const withRelated: {
    service: (typeof services.data.services)[number];
    result: Upserted;
  }[] = [];
  for (const service of services.data.services) {
    const categoryId = categoryIds.get(service.category);
    if (categoryId === undefined) {
      throw new SeedDataError(
        `${SEED_FILES.services}:${services.lineOf(['services', services.data.services.indexOf(service), 'category'])}: unknown category "${service.category}".`,
      );
    }
    const index = position.get(service.category) ?? 0;
    position.set(service.category, index + 1);
    const result = await upsertLinked(
      'services',
      { key: { equals: service.key } },
      'body',
      (link) => serviceData(service, categoryId, (index + 1) * 10, link),
    ).catch((err: unknown) => {
      // A service the yaml cannot publish (H25: no source) names its line and stops the run.
      if (!(err instanceof ValidationError)) throw err;
      throw new SeedDataError(
        `${SEED_FILES.services}:${services.lineOf(['services', services.data.services.indexOf(service)])}: ${service.key}: ${refusal(err)}`,
      );
    });
    serviceIds.set(service.key, result.id);
    register('services', service, result.id);
    if (service.related?.length) withRelated.push({ service, result });
  }

  /** A second write on a document this run upserted: all of `data` when just created. */
  async function followUp(collection: CollectionSlug, result: Upserted, data: Data) {
    const patch = result.created ? data : patchFor(result.existing ?? {}, data);
    if (Object.keys(patch).length === 0) return;
    const stored = result.existing ?? { id: result.id };
    const saved = await save(collection, stored, patch, result.draft, result.label);
    if (saved && !result.created && result.written.length === 0) bump(report.updated, collection);
  }

  // 2b. Related services point at other services, so they are set once all of them exist.
  for (const { service, result } of withRelated) {
    const related = (service.related ?? []).map((key) => {
      const id = serviceIds.get(key);
      if (id === undefined) {
        throw new SeedDataError(
          `${SEED_FILES.services}:${services.lineOf(['services', services.data.services.indexOf(service), 'related'])}: unknown service "${key}".`,
        );
      }
      return id;
    });
    await followUp('services', result, { relatedServices: related });
  }

  // 3. Standalone categories point at the service with their key, then publish.
  for (const { key, result } of standalone) {
    const serviceId = serviceIds.get(key);
    if (serviceId === undefined) {
      report.warnings.push(
        `service-categories ${key}: no service with the same key; left as a draft`,
      );
      continue;
    }
    await followUp('service-categories', result, {
      standaloneService: serviceId,
      _status: 'published',
    });
  }

  // 4. Tiers (natural key: service and key). A dry-run service id is a placeholder: nothing to find.
  for (const service of services.data.services) {
    const serviceId = serviceIds.get(service.key) as Id;
    for (const [index, tier] of (service.tiers ?? []).entries()) {
      if (dry && String(serviceId).startsWith('dry-')) {
        bump(report.created, 'service-tiers');
        continue;
      }
      await upsert(
        'service-tiers',
        { and: [{ service: { equals: serviceId } }, { key: { equals: tier.key } }] },
        tierData(tier, serviceId, index),
      );
    }
  }

  // 5. Redirects from aliases (/vip).
  for (const service of services.data.services) {
    const row = aliasRedirect(service);
    if (row) await upsert('redirects', { from: { equals: normalizePath(row.from) } }, row);
  }

  // 6. Insurers.
  for (const insurer of insurancesData(insurers.data)) {
    const logo = insurer.logo ? await media(`content/${insurer.logo}`, insurer.name) : null;
    await upsert(
      'insurances',
      { name: { equals: insurerKey(insurer.name) } },
      { ...insurer, logo },
    );
  }

  // 7. Financing options.
  for (const [index, row] of clinic.data.financing.entries()) {
    await upsert('financing-options', { key: { equals: row.key } }, financingData(row, index));
  }

  // 8. The four content globals.
  for (const [slug, seed] of Object.entries(globalsData(clinic.data)) as [GlobalSlug, Data][]) {
    const current = await api.findGlobal({ slug, depth: 0 });
    const patch = mode === 'sync' ? patchFor(current, seed) : emptyFieldsPatch(current, seed);
    if (Object.keys(patch).length === 0) {
      bump(report.skipped, `global:${slug}`);
      continue;
    }
    bump(report.updated, `global:${slug}`);
    if (!dry) {
      const { id: _id, createdAt: _c, updatedAt: _u, globalType: _g, ...rest } = current;
      await api.updateGlobal({ slug, data: deepMerge(rest, patch), context: SEED_CONTEXT });
    }
  }

  // 9. Pages. Guides need a reviewer dentist before they publish (V-REVIEWER), so they stay drafts.
  for (const page of pages.data.pages) {
    const result = await upsertLinked(
      'pages',
      { key: { equals: page.key } },
      'blocks',
      (link) => pageData(page, link),
      { publish: !isGuideKey(page.key) },
    );
    register('pages', { key: page.key, slug: page.slug || null }, result.id);
  }

  // 10. Doctors: the yaml template entry is skipped; publish only with the full gate.
  for (const [index, row] of doctors.data.doctors.entries()) {
    if (isTemplateDoctor(row)) {
      report.templates.push(
        `${SEED_FILES.doctors}:${doctors.lineOf(['doctors', index])} template entry (empty name or slug)`,
      );
      continue;
    }
    const serviceRefs = (row.services ?? []).map((key) => {
      const id = serviceIds.get(key);
      if (id === undefined) {
        throw new SeedDataError(
          `${SEED_FILES.doctors}:${doctors.lineOf(['doctors', index, 'services'])}: unknown service "${key}".`,
        );
      }
      return id;
    });
    const name = fixText(row.name_fa);
    const photo = row.photo
      ? await media(`content/photos/doctors/${row.photo}`, `دکتر ${name}`)
      : null;
    const doctor = await upsertGated(
      'doctors',
      { slug: { equals: row.slug } },
      {
        slug: checkedSlug(row.slug, `${SEED_FILES.doctors} ${row.slug}`),
        name,
        specialty: fixText(row.specialty_fa),
        specialtyConfirmed: false,
        councilNumber: row.council_number,
        degrees: (row.degrees_fa ?? []).map(fixText),
        yearsExperience: row.years_experience ?? null,
        bio: row.bio_fa ? fixText(row.bio_fa) : null,
        services: serviceRefs,
        photo,
        order: row.order ?? (index + 1) * 10,
      },
      `doctors ${row.slug}`,
    );
    register('doctors', row, doctor.id);
  }

  // 11. Before and after cases with consent.
  for (const { folder, source } of cases) {
    const row = source.data;
    if (!row.consent_confirmed) {
      report.templates.push(`${source.file}:1 no written consent`);
      continue;
    }
    const serviceId = serviceIds.get(row.service);
    if (serviceId === undefined)
      throw new SeedDataError(
        `${source.file}:${source.lineOf(['service'])}: unknown service "${row.service}".`,
      );
    const title = fixText(row.title_fa);
    const before = await media(
      `${SEED_FILES.cases}/${folder}/before.jpg`,
      `${title}، پیش از درمان`,
    );
    const after = await media(`${SEED_FILES.cases}/${folder}/after.jpg`, `${title}، پس از درمان`);
    await upsertGated(
      'cases',
      { sourceFolder: { equals: folder } },
      {
        title,
        service: serviceId,
        notes: row.notes_fa ? fixText(row.notes_fa) : null,
        consentConfirmed: true,
        before,
        after,
        sourceFolder: folder,
      },
      `cases ${folder}`,
    );
  }

  // 12. Testimonials: real patients with consent only; no third-party embeds.
  for (const [index, row] of testimonials.data.testimonials.entries()) {
    if (!isSeedableTestimonial(row)) {
      report.templates.push(
        `${SEED_FILES.testimonials}:${testimonials.lineOf(['testimonials', index])} template entry or no consent`,
      );
      continue;
    }
    if (row.media && /^https?:\/\//.test(row.media)) {
      report.warnings.push(
        `${SEED_FILES.testimonials}:${testimonials.lineOf(['testimonials', index, 'media'])} external media URL skipped`,
      );
    }
    const local = row.media && !/^https?:\/\//.test(row.media) ? row.media : null;
    const label = fixText(row.patient_label_fa);
    const video = local ? await media(`content/photos/testimonials/${local}`, label) : null;
    const poster = row.poster
      ? await media(`content/photos/testimonials/${row.poster}`, label)
      : null;
    const seedKey = createHash('sha1')
      .update(`${row.patient_label_fa}|${row.service ?? ''}|${row.media ?? ''}`)
      .digest('hex');
    await upsertGated(
      'testimonials',
      { seedKey: { equals: seedKey } },
      {
        patientLabel: label,
        service: row.service ? (serviceIds.get(row.service) ?? null) : null,
        type: row.type,
        video,
        poster,
        quote: row.quote_fa ? fixText(row.quote_fa) : null,
        consentConfirmed: true,
        seedKey,
      },
      `testimonials ${label}`,
    );
  }

  // 13. Article categories and tags (natural key: the slug; no drafts).
  const taxonomyIds = { 'article-categories': new Map<string, Id>(), tags: new Map<string, Id>() };
  for (const [collection, rows] of [
    ['article-categories', articles.data.categories],
    ['tags', articles.data.tags],
  ] as const) {
    for (const row of rows) {
      const { id } = await upsert(collection, { slug: { equals: row.slug } }, taxonomyData(row));
      taxonomyIds[collection].set(row.slug, id);
    }
  }

  // 14. Articles: drafts until a dentist reviews them and the admin approves (H5, gap 42).
  for (const [index, article] of articles.data.articles.entries()) {
    const ref = (field: string, map: Map<string, Id>, value: string): Id => {
      const id = map.get(value);
      if (id === undefined) {
        throw new SeedDataError(
          `${SEED_FILES.articles}:${articles.lineOf(['articles', index, field])}: unknown ${field} "${value}".`,
        );
      }
      return id;
    };
    const refs = {
      category: ref('category', taxonomyIds['article-categories'], article.category),
      tags: (article.tags ?? []).map((tag) => ref('tags', taxonomyIds.tags, tag)),
      primaryService: article.primary_service
        ? ref('primary_service', serviceIds, article.primary_service)
        : null,
    };
    const result = await upsertLinked(
      'articles',
      { slug: { equals: article.slug } },
      'body',
      (link) => articleData(article, refs, link),
      { publish: false },
    );
    register('articles', article, result.id);
  }

  // 15. Every link target exists now: rewrite the fields written with a link left as text.
  for (const { collection, result, field, build } of relinks) {
    if (dry) break;
    const stored = result.existing ?? { id: result.id };
    const data = { [field]: linked(build).data[field] };
    await save(collection, stored, data, result.draft, result.label);
  }

  // One audit row per run (spec-data 4.1): the summary, never document values.
  if (!dry) {
    await api.create({
      collection: 'audit-log',
      data: {
        action: 'seed',
        entityType: 'system',
        entitySlug: 'seed',
        actorLabel: 'system:seed',
        note: summary(report),
      },
      context: SEED_CONTEXT,
    });
  }
  return report;
}

const counts = (bucket: Record<string, number>): string =>
  Object.entries(bucket)
    .map(([slug, n]) => `${slug} ${n}`)
    .join(', ') || 'none';

export function summary(report: SeedReport): string {
  return [
    `mode: ${report.mode}`,
    `created: ${counts(report.created)}`,
    `updated: ${counts(report.updated)}`,
    `skipped: ${counts(report.skipped)}`,
    `left out: ${report.templates.length}`,
    `warnings: ${report.warnings.length}`,
    `markers: ${report.markers.length}`,
  ].join('; ');
}
