import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CollectionSlug, GlobalSlug, Payload, Where } from 'payload';
import { ValidationError } from 'payload';

import { hashedName } from '@/hooks/media';
import { isGuideKey, normalizePath, PAGE_KEYS } from '@/lib/paths';

import {
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
  pageData,
  SeedDataError,
  serviceData,
  tierData,
} from './transforms';

/**
 * The seeder (spec-data 8.1). create-only (default) creates what is missing and never updates;
 * globals get only their empty fields. sync updates seeded fields (refused in production).
 * dry-run writes nothing. Records are matched by natural keys, so a second run changes nothing.
 */

export type SeedMode = 'create-only' | 'sync' | 'dry-run';

export const SEED_FILES = {
  services: 'docs/content/services.yaml',
  clinic: 'docs/content/clinic.yaml',
  insurances: 'content/data/insurances.yaml',
  doctors: 'content/data/doctors.yaml',
  testimonials: 'content/data/testimonials.yaml',
  cases: 'content/before-after',
  pages: 'src/seed/data/pages.yaml',
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

// The Local API is generic over generated types; the seeder builds data from yaml at run time.
interface LooseApi {
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

/** The seed values whose current value is empty, recursing into groups (create-only globals). */
export function emptyFieldsPatch(current: unknown, seed: Data): Data {
  const patch: Data = {};
  const now = (current ?? {}) as Data;
  for (const [key, value] of Object.entries(seed)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
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
  for (const source of [services, clinic, insurers, doctors, testimonials, pages]) {
    report.markers.push(...source.markers);
  }
  const unknownPage = pages.data.pages.find((p) => !(PAGE_KEYS as string[]).includes(p.key));
  if (unknownPage)
    throw new SeedDataError(`${SEED_FILES.pages}: unknown page key "${unknownPage.key}".`);
  const insurerWarning = insurerDifference(clinic.data, insurers.data);
  if (insurerWarning) report.warnings.push(insurerWarning);

  /** Find by natural key; create when missing; update only in sync mode. Returns the id. */
  async function upsert(
    collection: CollectionSlug,
    where: Where,
    data: Data,
    state: { publish: boolean } = { publish: true },
  ): Promise<{ id: Id; created: boolean }> {
    const drafts = Boolean(payload.collections[collection]?.config.versions?.drafts);
    const statusData = drafts ? { _status: state.publish ? 'published' : 'draft' } : {};
    const found = await api.find({
      collection,
      where,
      limit: 1,
      depth: 0,
      trash: true,
      pagination: false,
    });
    const existing = found.docs[0];
    if (existing) {
      if (mode !== 'sync') {
        bump(report.skipped, collection);
      } else {
        await api.update({
          collection,
          id: existing.id,
          data: { ...data, ...statusData },
          draft: drafts && !state.publish,
          context: SEED_CONTEXT,
        });
        bump(report.updated, collection);
      }
      return { id: existing.id as Id, created: false };
    }
    bump(report.created, collection);
    if (dry) return { id: `dry-${(fakeId += 1)}`, created: true };
    const doc = await api.create({
      collection,
      data: { ...data, ...statusData },
      draft: drafts && !state.publish,
      context: SEED_CONTEXT,
    });
    return { id: doc.id as Id, created: true };
  }

  /** Publish when the publish gate passes, else keep a draft and say why. */
  async function upsertGated(collection: CollectionSlug, where: Where, data: Data, label: string) {
    try {
      return await upsert(collection, where, data, { publish: true });
    } catch (err) {
      if (!(err instanceof ValidationError)) throw err;
      report.warnings.push(
        `${label}: kept as a draft (${err.data.errors.map((e) => e.message).join(' ')})`,
      );
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
  const newStandalone: string[] = [];
  for (const category of services.data.categories) {
    const data = categoryData(category);
    const { id, created } = await upsert(
      'service-categories',
      { key: { equals: category.key } },
      data,
      { publish: !data.standalone },
    );
    categoryIds.set(category.key, id);
    if (data.standalone && (created || mode === 'sync')) newStandalone.push(category.key);
  }

  // 2. Services, their tiers and aliases.
  const serviceIds = new Map<string, Id>();
  const position = new Map<string, number>();
  for (const service of services.data.services) {
    const categoryId = categoryIds.get(service.category);
    if (categoryId === undefined) {
      throw new SeedDataError(
        `${SEED_FILES.services}:${services.lineOf(['services', services.data.services.indexOf(service), 'category'])}: unknown category "${service.category}".`,
      );
    }
    const index = position.get(service.category) ?? 0;
    position.set(service.category, index + 1);
    const { id } = await upsert(
      'services',
      { key: { equals: service.key } },
      serviceData(service, categoryId, (index + 1) * 10),
    );
    serviceIds.set(service.key, id);
  }

  // 3. Standalone categories point at the service with their key, then publish.
  for (const key of newStandalone) {
    const serviceId = serviceIds.get(key);
    const categoryId = categoryIds.get(key);
    if (serviceId === undefined || categoryId === undefined) {
      report.warnings.push(
        `service-categories ${key}: no service with the same key; left as a draft`,
      );
      continue;
    }
    if (!dry) {
      await api.update({
        collection: 'service-categories',
        id: categoryId,
        data: { standaloneService: serviceId, _status: 'published' },
        context: SEED_CONTEXT,
      });
    }
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
    const patch = mode === 'sync' ? seed : emptyFieldsPatch(current, seed);
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
    await upsert('pages', { key: { equals: page.key } }, pageData(page), {
      publish: !isGuideKey(page.key),
    });
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
    await upsertGated(
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
