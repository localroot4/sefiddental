import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLINIC_FALLBACK } from '@/i18n/fa';
import {
  BRAND_LOCKUP,
  LOCKUP_SPRITE,
  renderStaticSystemPage,
  STATIC_PAGE_COPY,
  STATIC_PAGE_CSP,
  STATIC_PAGE_STYLE_SHA256,
} from '@/lib/system-pages/staticPage';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const styleOf = (html: string) => /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('base64');

describe('static system pages (spec 7.4, 14.3, 14.4)', () => {
  it.each(['maintenance', 'gone'] as const)(
    'SP1 %s: Persian RTL document without script or style attributes',
    (kind) => {
      const html = renderStaticSystemPage(kind);
      expect(html.startsWith('<!doctype html><html lang="fa" dir="rtl">')).toBe(true);
      expect(html).toContain('<meta charset="utf-8">');
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).not.toMatch(/<script/i);
      expect(html).not.toMatch(/\sstyle=/i);
      expect(html).not.toMatch(/\son[a-z]+=/i);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).toContain(`href="tel:${STATIC_PAGE_COPY.phoneE164}"`);
      expect(html).toContain(`<span class="num" dir="ltr">${STATIC_PAGE_COPY.phoneDisplay}</span>`);
    },
  );

  it('SP2 the CSP hash matches the inline style of both documents', () => {
    const maintenance = styleOf(renderStaticSystemPage('maintenance'));
    expect(maintenance.length).toBeGreaterThan(100);
    expect(sha(maintenance)).toBe(STATIC_PAGE_STYLE_SHA256);
    expect(styleOf(renderStaticSystemPage('gone'))).toBe(maintenance);
    expect(STATIC_PAGE_CSP).toBe(
      `default-src 'none'; style-src 'sha256-${STATIC_PAGE_STYLE_SHA256}'; font-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    );
  });

  it('SP3 maintenance has no site links (they would answer 503); gone has the 404 links', () => {
    const maintenance = renderStaticSystemPage('maintenance');
    const gone = renderStaticSystemPage('gone');
    expect(maintenance).not.toContain('/خدمات');
    expect(maintenance).toContain('<title>در حال به‌روزرسانی | کلینیک دندانپزشکی سفید</title>');
    for (const link of STATIC_PAGE_COPY.links)
      expect(gone).toContain(`<a href="${link.href}">${link.label}</a>`);
    expect(gone).toContain('href="/اورژانس"');
  });

  it('SP4 light and dark token values from design/tokens.css', () => {
    const css = styleOf(renderStaticSystemPage('maintenance'));
    expect(css).toContain('--surface:#F7F8F7');
    expect(css).toContain('@media (prefers-color-scheme:dark){:root{--surface:#071A2B');
    const tokens = readFileSync(path.join(ROOT, 'design/tokens.css'), 'utf8');
    expect(tokens).toContain('--color-surface: #F7F8F7;');
    expect(tokens).toContain('--color-surface: #071A2B;');
  });

  it('SP5 the embedded logo is the design source, path for path', () => {
    const svg = readFileSync(path.join(ROOT, 'design/brand/logo-lockup-no-latin.svg'), 'utf8');
    expect(svg).toContain(`viewBox="${BRAND_LOCKUP.viewBox}"`);
    expect(svg).toContain(`fill="#0A243F" fill-rule="evenodd" d="${BRAND_LOCKUP.wordmarkPath}"`);
    expect(svg).toContain(`fill="#00827A" fill-rule="evenodd" d="${BRAND_LOCKUP.markPath}"`);
  });

  it('SP5b the logo sprite is the same drawing, under the symbol BrandLogo uses', () => {
    expect(LOCKUP_SPRITE).toContain(`<symbol id="lockup" viewBox="${BRAND_LOCKUP.viewBox}">`);
    expect(LOCKUP_SPRITE).toContain(
      `fill="currentColor" fill-rule="evenodd" d="${BRAND_LOCKUP.wordmarkPath}"`,
    );
    expect(LOCKUP_SPRITE).toContain(
      `fill="#00827A" fill-rule="evenodd" d="${BRAND_LOCKUP.markPath}"`,
    );
  });

  it('SP6 one copy of the clinic facts: static page and i18n agree', () => {
    expect(STATIC_PAGE_COPY.phoneE164).toBe(CLINIC_FALLBACK.phoneE164);
    expect(STATIC_PAGE_COPY.phoneDisplay).toBe(CLINIC_FALLBACK.phoneDisplay);
    expect(STATIC_PAGE_COPY.hoursLine).toBe(CLINIC_FALLBACK.hoursLine);
  });

  it('SP7 Node 22 imports the module directly (scripts/sync-public-assets.mjs)', () => {
    const out = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `const m = await import(${JSON.stringify(path.join(ROOT, 'src/lib/system-pages/staticPage.ts'))}); process.stdout.write(m.renderStaticSystemPage('maintenance').slice(0, 15));`,
      ],
      { encoding: 'utf8' },
    );
    expect(out).toBe('<!doctype html>');
  });
});
