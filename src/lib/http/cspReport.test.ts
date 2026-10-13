import { describe, expect, it } from 'vitest';

import { readTextCapped } from '@/lib/http/body';
import { parseCspReports } from '@/lib/http/cspReport';

describe('parseCspReports (spec 7.6)', () => {
  it('CR1 report-uri body: directive, blocked origin, path without query', () => {
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://sefiddental.ir/%D8%AE%D8%AF%D9%85%D8%A7%D8%AA?phone=09123456789',
        'violated-directive': 'script-src-elem',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/x.js?token=abc',
      },
    });
    expect(parseCspReports('application/csp-report', body)).toEqual([
      { directive: 'script-src-elem', blocked: 'https://evil.example', path: '/خدمات' },
    ]);
  });

  it('CR2 report-to body: csp-violation entries only, keywords kept', () => {
    const body = JSON.stringify([
      {
        type: 'csp-violation',
        url: 'https://sefiddental.ir/',
        body: {
          documentURL: 'https://sefiddental.ir/a?b=1',
          effectiveDirective: 'style-src-attr',
          blockedURL: 'inline',
        },
      },
      { type: 'deprecation', body: {} },
      {
        type: 'csp-violation',
        body: {
          documentURL: 'https://sefiddental.ir/',
          effectiveDirective: 'script-src',
          blockedURL: 'eval',
        },
      },
    ]);
    expect(parseCspReports('application/reports+json', body)).toEqual([
      { directive: 'style-src-attr', blocked: 'inline', path: '/a' },
      { directive: 'script-src', blocked: 'eval', path: '/' },
    ]);
  });

  it('CR3 data: and blob: become their scheme; junk is rejected', () => {
    const body = JSON.stringify({
      'csp-report': {
        'document-uri': 'https://sefiddental.ir/',
        'violated-directive': 'img-src',
        'blocked-uri': 'data:image/png;base64,AAAA',
      },
    });
    expect(parseCspReports('application/csp-report', body)?.[0]?.blocked).toBe('data');
    expect(parseCspReports('application/csp-report', 'not json')).toBeNull();
    expect(parseCspReports('text/plain', body)).toBeNull();
    expect(parseCspReports('application/csp-report', '{"x":1}')).toBeNull();
  });
});

describe('readTextCapped', () => {
  const req = (body: string, headers: Record<string, string> = {}) =>
    new Request('https://sefiddental.ir/api/csp-report', { method: 'POST', body, headers });

  it('BC1 returns the text within the cap, null above it', async () => {
    await expect(readTextCapped(req('سلام'), 16)).resolves.toBe('سلام');
    await expect(readTextCapped(req('x'.repeat(17)), 16)).resolves.toBeNull();
  });

  it('BC2 a declared length above the cap is refused before reading', async () => {
    await expect(readTextCapped(req('x', { 'content-length': '99999' }), 16)).resolves.toBeNull();
  });
});
