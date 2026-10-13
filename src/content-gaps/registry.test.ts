import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { clinicYaml, servicesYaml } from '@/seed/schemas';
import { readYaml } from '@/seed/sources';

import {
  adminUrlOf,
  GAP_KIND_HEADINGS,
  GAP_REGISTRY,
  getContentGaps,
  YAML_MARKER_GAPS,
} from './registry';

const ROOT = process.cwd();

describe('content-gap registry (spec-data 9.2)', () => {
  it('CG1 every NEEDS_CLIENT and verify comment of the yaml sources maps to a registry entry', () => {
    const ids = new Set(GAP_REGISTRY.map((entry) => entry.id));
    const markers = [
      ...readYaml(ROOT, 'docs/content/clinic.yaml', clinicYaml).markers,
      ...readYaml(ROOT, 'docs/content/services.yaml', servicesYaml).markers,
    ];
    expect(markers.length).toBeGreaterThan(0);
    for (const marker of markers) {
      const id = YAML_MARKER_GAPS[`${marker.file}:${marker.path}`];
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
