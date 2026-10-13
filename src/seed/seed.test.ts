import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { emptyFieldsPatch } from './run';
import { clinicYaml, doctorsYaml, servicesYaml } from './schemas';
import { readYaml, SeedSourceError } from './sources';
import {
  ACCENT_MAP,
  aliasRedirect,
  categoryData,
  checkedSlug,
  financingData,
  isSeedableTestimonial,
  isTemplateDoctor,
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
      summary: null,
      facts: { sessions: null, duration: null },
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
