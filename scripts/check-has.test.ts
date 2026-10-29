import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { hasViolations, siteCss } from './check-has.mjs';

// An allowed class, escaped as Tailwind and lightningcss print it.
const KEPT =
  '.noscript\\:group-has-\\[input\\:checked\\]\\/tiers\\:hidden:is(:where(.group\\/tiers):has(:is(input:checked)) *)';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check-has', () => {
  it('T-HS1 a :has() selector anywhere outside @media (scripting: none) is reported', () => {
    expect(hasViolations('.a:has(:checked){color:red}.b{color:blue}')).toEqual([
      '.a:has(:checked)',
    ]);
    // Inside another media query, a layer, :is()/:where(), and merged into a selector list.
    expect(
      hasViolations(
        '@layer utilities{@media (width<64rem){html.x:has(:is(dialog:modal)){overflow:hidden}}}' +
          '.c,.d:is(:where(.g):has(input:focus-visible) *){outline:2px}' +
          'body:has(dialog[open]) .bar{translate:0 120%}',
      ),
    ).toEqual([
      'html.x:has(:is(dialog:modal))',
      '.d:is(:where(.g):has(input:focus-visible) *)',
      'body:has(dialog[open]) .bar',
    ]);
    expect(hasViolations('.a{color:red}@media (scripting:none){.b{color:blue}}')).toEqual([]);
  });

  it('T-HS2 an ALLOW class passes under @media (scripting: none), alone, nested or joined by and', () => {
    expect(hasViolations(`@media (scripting: none){${KEPT}{display:none}}`)).toEqual([]);
    expect(
      hasViolations(`@media (scripting:none){@media (width<64rem){${KEPT}{display:none}}}`),
    ).toEqual([]);
    expect(
      hasViolations(`@media (scripting:none) and (width<64rem){${KEPT}{display:none}}`),
    ).toEqual([]);
  });

  it('T-HS3 the same class with JavaScript on, or an unlisted class, is reported', () => {
    const at = (media: string) => hasViolations(`@media ${media}{${KEPT}{display:none}}`);
    expect(at('not (scripting: none)')).toHaveLength(1);
    expect(at('(scripting: none), print')).toHaveLength(1);
    expect(at('(scripting: enabled)')).toHaveLength(1);
    expect(hasViolations(`${KEPT}{display:none}`)).toHaveLength(1);
    expect(
      hasViolations(
        '@media (scripting:none){.noscript\\:has-checked\\:x:has(:checked){color:red}}',
      ),
    ).toEqual(['.noscript\\:has-checked\\:x:has(:checked)']);
  });

  it('T-HS4 strings, comments and escaped braces do not move the rule boundaries', () => {
    expect(
      hasViolations(
        '/*! x:has( { */.a::after{content:"}:has({"}.b\\{:has(i){color:red}[data-x="{"]{color:blue}',
      ),
    ).toEqual(['.b\\{:has(i)']);
  });

  it('T-HS5 the site CSS comes from the client reference manifests, without the admin entries', () => {
    const next = mkdtempSync(path.join(tmpdir(), 'check-has-'));
    dirs.push(next);
    const write = (dir: string, manifest: Record<string, unknown>) => {
      mkdirSync(path.join(next, 'server', 'app', dir), { recursive: true });
      writeFileSync(
        path.join(next, 'server', 'app', dir, 'page_client-reference-manifest.js'),
        `globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};\nglobalThis.__RSC_MANIFEST["/${dir}/page"] = ${JSON.stringify(manifest)};`,
      );
    };
    write('(site)', {
      entryCSSFiles: {
        '[project]/src/app/(site)/layout': [{ path: 'static/chunks/site.css', inlined: false }],
        '[project]/src/app/global-not-found': [{ path: 'static/chunks/nf.css', inlined: false }],
      },
    });
    write('(payload)/giris', {
      entryCSSFiles: {
        '[project]/src/app/global-not-found': [{ path: 'static/chunks/nf.css', inlined: false }],
        '[project]/src/app/(payload)/layout': [{ path: 'static/chunks/admin.css', inlined: false }],
      },
    });
    expect(siteCss(next).sort()).toEqual(['static/chunks/nf.css', 'static/chunks/site.css']);
    rmSync(path.join(next, 'server'), { recursive: true });
    mkdirSync(path.join(next, 'server', 'app'), { recursive: true });
    expect(() => siteCss(next)).toThrow(/no site CSS/);
  });
});
