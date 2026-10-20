import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { articlesYaml, clinicYaml, pagesYaml, servicesYaml } from '@/seed/schemas';
import { readYaml } from '@/seed/sources';

import {
  adminUrlOf,
  GAP_KIND_HEADINGS,
  GAP_REGISTRY,
  getContentGaps,
  yamlMarkerGap,
} from './registry';

const ROOT = process.cwd();

describe('content-gap registry (spec-data 9.2)', () => {
  it('CG1 every NEEDS_CLIENT and verify comment of the yaml sources maps to a registry entry', () => {
    const ids = new Set(GAP_REGISTRY.map((entry) => entry.id));
    const markers = [
      ...readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml).markers,
      ...readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).markers,
      ...readYaml(ROOT, 'src/seed/data/pages.yaml', pagesYaml).markers,
      ...readYaml(ROOT, 'src/seed/data/articles.yaml', articlesYaml).markers,
    ];
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      const id = yamlMarkerGap(marker.file, marker.path);
      expect(id, `${marker.file}:${marker.line} ${marker.path}`).toBeDefined();
      expect(ids.has(id as string)).toBe(true);
    }
  });

  it('CG2 every gap row exists in docs/content/gaps.md; ids are unique', () => {
    const table = readFileSync(path.join(ROOT, 'docs/content/gaps.md'), 'utf8');
    const rows = new Set([...table.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1])));
    for (const entry of GAP_REGISTRY) {
      if (entry.gapRow !== null) expect(rows.has(entry.gapRow), entry.id).toBe(true);
    }
    expect(new Set(GAP_REGISTRY.map((e) => e.id)).size).toBe(GAP_REGISTRY.length);
  });

  it('CG5 a `*` in a marker key matches one path segment (H26 wildcard keys)', () => {
    expect(yamlMarkerGap('docs/content/clinic.yaml', 'address.lat')).toBe('clinic.coordinates');
    expect(yamlMarkerGap('docs/content/services.yaml', 'services.12.reviewed_by')).toBe(
      'services.reviewer',
    );
    expect(yamlMarkerGap('src/seed/data/pages.yaml', 'pages.9.reviewed_by')).toBe(
      'guides.reviewer',
    );
    expect(yamlMarkerGap('src/seed/data/articles.yaml', 'articles.0.reviewed_by')).toBe(
      'articles.reviewer',
    );
    expect(yamlMarkerGap('src/seed/data/articles.yaml', 'articles.5.cover')).toBe('articles.cover');
    expect(yamlMarkerGap('src/seed/data/articles.yaml', 'articles.5.author')).toBe(
      'articles.author',
    );
    expect(yamlMarkerGap('docs/content/services.yaml', 'services.1.tiers.0.reviewed_by')).toBe(
      undefined,
    );
    expect(yamlMarkerGap('docs/content/clinic.yaml', 'services.1.reviewed_by')).toBe(undefined);
  });

  it('CG6 the reviewer row 42 covers services, guides and articles; rows 58 to 63 have entries', async () => {
    const ids = GAP_REGISTRY.map((entry) => entry.id);
    for (const id of ['services.reviewer', 'guides.reviewer', 'articles.reviewer']) {
      expect(GAP_REGISTRY.find((e) => e.id === id)?.gapRow, id).toBe(42);
    }
    const rows = new Set(GAP_REGISTRY.map((entry) => entry.gapRow));
    for (const row of [58, 59, 60, 61, 62, 63]) expect(rows.has(row), String(row)).toBe(true);
    expect(ids).toEqual(expect.arrayContaining(['articles.cover', 'articles.author']));
    // A question with no field to fill stays open until its answer is in the copy.
    const payload = {
      findGlobal: async () => ({}),
      count: async () => ({ totalDocs: 0 }),
      find: async () => ({ docs: [] }),
    };
    const open = (await getContentGaps(payload as never)).groups.flatMap((g) => g.items);
    const openRows = new Set(open.map((item) => item.gapRow));
    for (const row of [59, 61, 62, 63]) expect(openRows.has(row), String(row)).toBe(true);
    for (const id of [
      'articles.cover',
      'articles.author',
      'articles.reviewer',
      'tiers.materials',
    ]) {
      expect(
        open.map((item) => item.id),
        id,
      ).not.toContain(id);
    }
  });

  it('CG3 headings and admin URLs', () => {
    expect(GAP_KIND_HEADINGS).toEqual({
      needs_client: 'منتظر اطلاعات کلینیک',
      needs_verification: 'منتظر تأیید کلینیک',
      missing_content: 'محتوای ناقص',
      marker_in_text: 'علامت NEEDS_CLIENT در متن',
    });
    expect(adminUrlOf({ type: 'global', slug: 'clinic' })).toBe('/admin/globals/clinic');
    expect(adminUrlOf({ type: 'collection', slug: 'services', id: 4 })).toBe(
      '/admin/collections/services/4',
    );
    expect(adminUrlOf({ type: 'collection', slug: 'doctors' })).toBe('/admin/collections/doctors');
  });

  it('CG4 groups follow the kind order, empty groups are left out, markers name the field', async () => {
    const clinic = {
      address: {},
      phones: { whatsappVerified: true, telegramVerified: true },
      tagline: 'x [[NEEDS_CLIENT: y]]',
    };
    const payload = {
      findGlobal: async ({ slug }: { slug: string }) => (slug === 'clinic' ? clinic : {}),
      count: async () => ({ totalDocs: 0 }),
      find: async () => ({ docs: [] }),
    };
    const report = await getContentGaps(payload as never);
    expect(report.groups.map((g) => g.kind)).toEqual([
      'needs_client',
      'needs_verification',
      'missing_content',
      'marker_in_text',
    ]);
    expect(report.total).toBe(report.groups.reduce((n, g) => n + g.items.length, 0));
    const marker = report.groups.at(-1)?.items[0];
    expect(marker).toMatchObject({ fieldPath: 'tagline', adminUrl: '/admin/globals/clinic' });
    expect(JSON.stringify(report)).not.toContain('[[NEEDS_CLIENT: y]]');
    const verification = report.groups
      .find((g) => g.kind === 'needs_verification')
      ?.items.map((i) => i.id);
    expect(verification).not.toContain('clinic.whatsapp');
  });
});
