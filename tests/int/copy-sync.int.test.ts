import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Payload } from 'payload';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { BASELINE, type CopySyncReport, runCopySync } from '@/seed/copySync';
import { runSeed, SEED_FILES } from '@/seed/run';
import { servicesYaml } from '@/seed/schemas';
import { readYaml } from '@/seed/sources';
import { categoryData, fixText } from '@/seed/transforms';

import { getTestPayload } from './helpers';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

let payload: Payload;
const ROOT = process.cwd();
type Doc = Record<string, unknown>;

/** A seed root whose services.yaml and pages.yaml are the baseline: the database before COPY. */
const baseRoot = mkdtempSync(path.join(os.tmpdir(), 'sefid-copy-sync-'));
for (const dir of ['docs/content', 'src/seed/data'])
  mkdirSync(path.join(baseRoot, dir), { recursive: true });
for (const file of ['content', SEED_FILES.clinic, SEED_FILES.articles])
  symlinkSync(path.join(ROOT, file), path.join(baseRoot, file));
symlinkSync(path.join(ROOT, BASELINE.services), path.join(baseRoot, SEED_FILES.services));
symlinkSync(path.join(ROOT, BASELINE.pages), path.join(baseRoot, SEED_FILES.pages));

/** The latest version (a draft included), or with `draft: false` the published one. */
const latest = async (
  collection: 'service-categories' | 'pages' | 'services',
  key: string,
  draft = true,
): Promise<Doc> =>
  (
    await payload.find({
      collection,
      where: { key: { equals: key } },
      depth: 0,
      limit: 1,
      draft,
    })
  ).docs[0] as unknown as Doc;

const statusOf = (report: CopySyncReport, collection: string, key: string, field: string) =>
  report.rows.find((r) => r.collection === collection && r.key === key && r.field === field)
    ?.status;

const HAND_ANSWER = 'پاسخی که کلینیک در پنل نوشته است.';
const HAND_SUMMARY = 'خلاصه‌ای که ویراستار در پیش‌نویس نوشته است.';
/** Set in beforeAll: the reviewed service and the published version under a pending draft. */
let scalingBefore: Doc;
let laminatePublished: Doc;
let applied: CopySyncReport;
let doctorId: number | string;

describe('copy-sync: the copy changes since the baseline, never over a human edit', () => {
  beforeAll(async () => {
    payload = await getTestPayload();
    // Whatever earlier files left: every seeded document holds the baseline copy again.
    await runSeed(payload, { mode: 'sync', root: baseRoot });

    // A hand edit of a field the new copy changes: surgery-replacement's FAQ answers.
    const surgery = await latest('service-categories', 'surgery-replacement');
    const faqs = (surgery.faqs as Doc[]).map((row, i) =>
      i === 0 ? { ...row, answer: HAND_ANSWER } : row,
    );
    await payload.update({
      collection: 'service-categories',
      id: surgery.id as number,
      data: { faqs },
      context: { skipRevalidate: true },
    });
    // cosmetic already holds the new search description.
    const services = readYaml(ROOT, SEED_FILES.services, servicesYaml).data;
    const cosmetic = await latest('service-categories', 'cosmetic');
    await payload.update({
      collection: 'service-categories',
      id: cosmetic.id as number,
      data: { seo: categoryData(services.categories.find((c) => c.key === 'cosmetic')!).seo },
      context: { skipRevalidate: true },
    });
    // A dentist reviewed scaling (C1), whose body and FAQs the new copy changes.
    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        name: `بازبین همگام‌سازی ${Date.now()}`,
        specialty: 'دندانپزشک عمومی',
        councilNumber: String(Math.floor(Math.random() * 1e9)),
        _status: 'draft',
      } as never,
      draft: true,
    });
    doctorId = doctor.id;
    const scaling = await latest('services', 'scaling');
    await payload.update({
      collection: 'services',
      id: scaling.id as number,
      data: { reviewedBy: doctorId },
      context: { skipRevalidate: true },
    });
    scalingBefore = await latest('services', 'scaling');
    // An editor's pending draft over the published ceramic-laminate (body and FAQs change).
    const laminate = await latest('services', 'ceramic-laminate');
    await payload.update({
      collection: 'services',
      id: laminate.id as number,
      data: { summary: HAND_SUMMARY },
      draft: true,
      context: { skipRevalidate: true },
    });
    laminatePublished = await latest('services', 'ceramic-laminate', false);
  }, 180_000);

  // Back to the current seed for the files that run later.
  afterAll(async () => {
    const scaling = await latest('services', 'scaling');
    await payload.update({
      collection: 'services',
      id: scaling.id as number,
      data: { reviewedBy: null },
      context: { skipRevalidate: true },
    });
    await runSeed(payload, { mode: 'sync', root: ROOT });
    rmSync(baseRoot, { recursive: true, force: true });
  }, 180_000);

  it('CS1 the dry run reports updated, edited-by-hand and unchanged fields and writes nothing', async () => {
    const keys = ['restorative', 'surgery-replacement', 'cosmetic'] as const;
    const stamps = async () =>
      Promise.all(keys.map(async (key) => (await latest('service-categories', key)).updatedAt));
    const before = await stamps();
    const audit = (await payload.count({ collection: 'audit-log' })).totalDocs;

    const report = await runCopySync(payload, { root: ROOT, apply: false });

    expect(statusOf(report, 'service-categories', 'restorative', 'seo.description')).toBe(
      'updated',
    );
    expect(statusOf(report, 'service-categories', 'restorative', 'intro')).toBe('updated');
    expect(statusOf(report, 'service-categories', 'surgery-replacement', 'faqs')).toBe(
      'edited-by-hand',
    );
    expect(statusOf(report, 'service-categories', 'cosmetic', 'seo.description')).toBe('unchanged');
    expect(statusOf(report, 'pages', 'home', 'blocks')).toBe('updated');
    expect(await stamps()).toEqual(before);
    expect((await payload.count({ collection: 'audit-log' })).totalDocs).toBe(audit);
  });

  it('CS5 an apply that fails on a write stops with the error and leaves an aborted audit row', async () => {
    const spy = vi.spyOn(payload, 'update').mockRejectedValueOnce(new Error('connection lost'));
    try {
      await expect(runCopySync(payload, { root: ROOT, apply: true })).rejects.toThrow(
        'connection lost',
      );
    } finally {
      spy.mockRestore();
    }
    const [row] = (
      await payload.find({
        collection: 'audit-log',
        where: { entitySlug: { equals: 'copy-sync' } },
        sort: '-createdAt',
        limit: 1,
        depth: 0,
      })
    ).docs;
    expect(row?.note).toMatch(/^aborted; applied; .*documents written 0$/);
  });

  it('CS2 apply writes the untouched fields, keeps the hand edit and the draft, skips the already new', async () => {
    const cosmeticBefore = await latest('service-categories', 'cosmetic');
    const guideBefore = await latest('pages', 'guide-aftercare');

    const report = await runCopySync(payload, { root: ROOT, apply: true });
    applied = report;

    const restorative = await latest('service-categories', 'restorative');
    expect((restorative.seo as Doc).description).toBeTruthy();
    // A group field is written alone: its sibling stays.
    expect((restorative.seo as Doc).title).toBe('درمان و نگهداری دندان');
    const surgery = await latest('service-categories', 'surgery-replacement');
    expect((surgery.faqs as Doc[])[0]!.answer).toBe(HAND_ANSWER);
    expect(statusOf(report, 'service-categories', 'surgery-replacement', 'faqs')).toBe(
      'edited-by-hand',
    );
    expect((await latest('service-categories', 'cosmetic')).updatedAt).toBe(
      cosmeticBefore.updatedAt,
    );
    expect((await latest('pages', 'guide-aftercare'))._status).toBe(guideBefore._status);

    // A second run has nothing left to write; the hand edit is still reported.
    const again = await runCopySync(payload, { root: ROOT, apply: false });
    expect(again.rows.filter((r) => r.status === 'updated')).toEqual([]);
    expect(statusOf(again, 'service-categories', 'surgery-replacement', 'faqs')).toBe(
      'edited-by-hand',
    );
  });

  it('CS3 a document a dentist reviewed is held: reported as reviewed, not written (C1)', async () => {
    expect(statusOf(applied, 'services', 'scaling', 'body')).toBe('reviewed');
    expect(statusOf(applied, 'services', 'scaling', 'faqs')).toBe('reviewed');
    const after = await latest('services', 'scaling');
    expect(after.updatedAt).toBe(scalingBefore.updatedAt);
    expect(after.body).toEqual(scalingBefore.body);
    expect(after.reviewedBy).toBe(doctorId);
  });

  it('CS4 a pending draft over a published page gets the copy; the live version stays as it was', async () => {
    expect(statusOf(applied, 'services', 'ceramic-laminate', 'faqs')).toBe('updated-in-draft');
    expect(statusOf(applied, 'services', 'ceramic-laminate', 'summary')).toBe('edited-by-hand');
    expect(applied.warnings).toContainEqual(
      expect.stringMatching(/^services ceramic-laminate: .*live page keeps the old copy/),
    );
    const live = await latest('services', 'ceramic-laminate', false);
    expect(live._status).toBe('published');
    expect(live.updatedAt).toBe(laminatePublished.updatedAt);
    expect(live.faqs).toEqual(laminatePublished.faqs);
    expect(live.summary).not.toBe(HAND_SUMMARY);

    const draft = await latest('services', 'ceramic-laminate');
    expect(draft._status).toBe('draft');
    expect(draft.summary).toBe(HAND_SUMMARY);
    const yaml = readYaml(ROOT, SEED_FILES.services, servicesYaml).data.services.find(
      (row) => row.key === 'ceramic-laminate',
    )!;
    expect((draft.faqs as Doc[]).map((row) => row.answer)).toEqual(
      (yaml.faqs ?? []).map((row) => fixText(row.answer)),
    );
  });
});
