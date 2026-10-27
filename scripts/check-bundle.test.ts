import { describe, expect, it } from 'vitest';

import { evaluate, markdownTable } from './check-bundle.mjs';

const limits = {
  classes: {
    home: { pages: ['/'], targetKB: 180, interimKiB: 215, routeAllowanceKiB: 85 },
    content: { pages: ['/qa/not-found'], targetKB: 90, interimKiB: 150, routeAllowanceKiB: 15 },
    booking: {
      pages: [],
      pendingNote: 'no booking page before phase 5',
      targetKB: 70,
      interimKiB: 150,
      routeAllowanceKiB: 20,
    },
  },
  cssKiB: 50,
  fontsKiB: 120,
};

const KiB = 1024;

function page(url: string, scripts: Record<string, number>, extra: object = {}) {
  return {
    url,
    scripts,
    cssBytes: 10 * KiB,
    fontBytes: 60 * KiB,
    foreignOrigins: [],
    webglBeforeLoad: false,
    webglAfterLoad: false,
    ...extra,
  };
}

const framework = { '/_next/static/chunks/framework.js': 130 * KiB };

describe('check-bundle evaluate', () => {
  it('T-BU1 shared JS is what every page loads; route JS is the rest', () => {
    const { rows, failures, sharedScripts } = evaluate(
      {
        home: { pages: [page('/', { ...framework, '/home.js': 60 * KiB })] },
        content: { pages: [page('/qa/not-found', { ...framework, '/content.js': 10 * KiB })] },
      },
      limits,
    );
    expect(sharedScripts).toEqual(['/_next/static/chunks/framework.js']);
    expect(rows[0]).toMatchObject({ initialKiB: 190, sharedKiB: 130, routeKiB: 60, targetKB: 180 });
    expect(rows[1]).toMatchObject({ initialKiB: 140, routeKiB: 10 });
    expect(rows[2]).toMatchObject({ pageClass: 'booking', url: null });
    expect(failures).toEqual([]);
  });

  it('T-BU2 over the interim total or the route allowance fails (B1, B2)', () => {
    const { failures } = evaluate(
      {
        home: { pages: [page('/', { ...framework })] },
        content: { pages: [page('/qa/not-found', { ...framework, '/big.js': 21 * KiB })] },
      },
      limits,
    );
    expect(failures).toEqual([
      'B1 content /qa/not-found: initial JS 151 KiB > 150 KiB',
      'B2 content /qa/not-found: route JS 21 KiB > allowance 15 KiB',
    ]);
  });

  it('T-BU3 three.js on a content page, heavy CSS or fonts and other origins fail (B3-B5)', () => {
    const { failures } = evaluate(
      {
        home: { pages: [page('/', framework, { webglAfterLoad: true })] },
        content: {
          pages: [
            page('/qa/not-found', framework, {
              webglAfterLoad: true,
              cssBytes: 51 * KiB,
              fontBytes: 121 * KiB,
              foreignOrigins: ['https://cdn.example.com'],
            }),
          ],
        },
      },
      limits,
    );
    expect(failures).toEqual([
      'B3 content /qa/not-found: three.js (WebGLRenderer) loaded on a content page',
      'B4 content /qa/not-found: CSS 51 KiB > 50 KiB',
      'B4 content /qa/not-found: fonts 121 KiB > 120 KiB',
      'B5 content /qa/not-found: request to another origin https://cdn.example.com',
    ]);
  });

  it('T-BU5 gsap before load on home, or at all on a content page, fails (B3, phase 7)', () => {
    const { failures } = evaluate(
      {
        home: {
          pages: [page('/', framework, { gsapBeforeLoad: true, gsapAfterLoad: true })],
        },
        content: {
          pages: [page('/qa/not-found', framework, { gsapAfterLoad: true })],
        },
      },
      limits,
    );
    expect(failures).toEqual([
      'B3 home /: gsap (_gsap or ScrollTrigger) loaded before load',
      'B3 content /qa/not-found: gsap (_gsap or ScrollTrigger) loaded on a content page',
    ]);
    // The engine chunk after load on home is the design, not a failure.
    expect(
      evaluate({ home: { pages: [page('/', framework, { gsapAfterLoad: true })] } }, limits)
        .failures,
    ).toEqual([]);
  });

  it('T-BU4 the report table shows the documented target beside each measurement', () => {
    const { rows } = evaluate({ home: { pages: [page('/', framework)] } }, limits);
    const table = markdownTable(rows);
    expect(table).toContain(
      '| home | `/` | 130 KiB | 130 KiB | 0 KiB | 215 KiB | 85 KiB | 180 KB |',
    );
    expect(table).toContain('| booking | none (no booking page before phase 5) |');
  });
});
