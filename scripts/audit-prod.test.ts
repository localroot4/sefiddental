import { describe, expect, it } from 'vitest';

import { ALLOWED, judge } from './audit-prod.mjs';

const advisory = (id: string, severity: string, name = 'pkg') => ({
  url: `https://github.com/advisories/${id}`,
  title: `${id} title`,
  severity,
  name,
});
const report = {
  vulnerabilities: {
    picomatch: { via: [advisory('GHSA-fc5q-39xc-vjpf', 'high', 'picomatch')] },
    // Inherited through a dependency: counted at picomatch, not again here.
    anymatch: { via: ['picomatch'] },
    next: { via: [advisory('GHSA-mfr8-8qww-v76h', 'moderate', 'next')] },
  },
};
const allow = [{ id: 'GHSA-fc5q-39xc-vjpf', reason: 'r', expires: '2026-12-01' }];

describe('audit-prod', () => {
  it('T-AU1 an allowed high advisory passes until its date, each advisory once; a moderate one never fails', () => {
    const out = judge(report, allow, new Date('2026-11-17T12:00:00Z'));
    expect(out.failing).toEqual([]);
    expect(out.excused.map((e) => e.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    // The last day still counts.
    expect(judge(report, allow, new Date('2026-12-01T23:00:00Z')).failing).toEqual([]);
  });

  it('T-AU2 past its date the exception fails again and says so; an advisory not listed fails', () => {
    const late = judge(report, allow, new Date('2026-12-02T00:00:00Z'));
    expect(late.failing.map((f) => f.id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(late.expired).toEqual(['GHSA-fc5q-39xc-vjpf']);
    const other = {
      vulnerabilities: { x: { via: [advisory('GHSA-aaaa-bbbb-cccc', 'critical', 'x')] } },
    };
    expect(judge(other, allow, new Date('2026-11-17')).failing).toEqual([
      {
        id: 'GHSA-aaaa-bbbb-cccc',
        severity: 'critical',
        package: 'x',
        title: 'GHSA-aaaa-bbbb-cccc title',
      },
    ]);
  });

  it('T-AU3 every exception has a reason and a date at most 30 days ahead of today', () => {
    for (const a of ALLOWED) {
      expect(a.id).toMatch(/^GHSA-/);
      expect(a.reason.length).toBeGreaterThan(10);
      expect(a.expires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(a.expires) - Date.now()).toBeLessThanOrEqual(30 * 86_400_000);
    }
  });
});
