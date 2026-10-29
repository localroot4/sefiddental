// Guard (postbuild): no `:has()` selector in the site's CSS outside `@media (scripting: none)`.
// In Chromium one active `:has()` rule makes every DOM insertion restyle the whole document (phase 7
// tier 1 Lighthouse: 867 elements per insertion on home, 22 of 23 rules alone; none with every
// `:has()` rule gone). A rule in a media query that does not match is not active, so the no-JS path
// keeps the `:has()` rules it needs there (Tailwind `noscript:`), each class listed in ALLOW; with
// JavaScript the components set attributes instead (data-modal, data-choice, data-checked, ...).
// Runs as `postbuild`:
//   node scripts/check-has.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

/** The classes allowed to carry `:has()`, and only under `@media (scripting: none)`. */
export const ALLOW = new Set([
  // SiteShell: an open modal locks the page scroll under 1024 px.
  'noscript:max-lg:has-[dialog:modal:not(#intro)]:overflow-hidden',
  // StickyBar: hidden while a dialog is open.
  'noscript:[body:has(dialog[open])_&]:translate-y-[120%]',
  // MegaMenu: the caret turns while the panel is open.
  'noscript:group-has-[:popover-open]/mega:rotate-180',
  // Tiers: the checked card, its badge and the section CTA.
  'noscript:has-[input:checked]:border-warm',
  'noscript:has-[input:checked]:bg-warm-soft',
  'noscript:group-has-[input:checked]/card:block',
  'noscript:group-has-[input:checked]/tiers:hidden',
  'noscript:group-has-[article:nth-of-type(1)_input:checked]/tiers:block',
  'noscript:group-has-[article:nth-of-type(2)_input:checked]/tiers:block',
  'noscript:group-has-[article:nth-of-type(3)_input:checked]/tiers:block',
  'noscript:group-has-[article:nth-of-type(4)_input:checked]/tiers:block',
  // RestorationSection: the panel of the checked step.
  'noscript:group-has-[label:nth-of-type(1)>input:checked]/tiers:grid',
  'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:grid',
  'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:grid',
  'noscript:group-has-[label:nth-of-type(4)>input:checked]/tiers:grid',
  // MolarStepper: the layer of the checked step.
  'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:opacity-0',
  'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:transform-[scale(.94)]',
  'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:opacity-100',
  'noscript:group-has-[label:nth-of-type(2)>input:checked]/tiers:transform-none',
  'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:opacity-0',
  'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:transform-[scale(.94)]',
  'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:opacity-100',
  'noscript:group-has-[label:nth-of-type(3)>input:checked]/tiers:transform-none',
]);

/** `@media (scripting: none)`, alone or joined by `and`: matches only without JavaScript. */
const noScript = (prelude) =>
  /^@media\b/.test(prelude) &&
  /\(\s*scripting\s*:\s*none\s*\)/.test(prelude) &&
  !/\bnot\b|\bor\b|,/.test(prelude);

/** Splits a selector list at its top-level commas. */
function splitList(list) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i += 1) {
    const c = list[i];
    if (c === '\\') i += 1;
    else if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(list.slice(start).trim());
  return out;
}

/** The unescaped class names of a selector. */
const classesOf = (selector) =>
  [...selector.matchAll(/\.((?:\\.|[\w-])+)/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));

/** The `:has()` selectors of `css` outside `@media (scripting: none)` or not from an ALLOW class. */
export function hasViolations(css) {
  const bad = [];
  const stack = [];
  let start = 0;
  for (let i = 0; i < css.length; i += 1) {
    const c = css[i];
    if (c === '\\') {
      i += 1;
    } else if (c === '"' || c === "'") {
      const end = css.indexOf(c, i + 1);
      i = end < 0 ? css.length : end;
    } else if (c === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 1;
    } else if (c === ';') {
      start = i + 1;
    } else if (c === '{') {
      const prelude = css
        .slice(start, i)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      stack.push(prelude);
      start = i + 1;
      if (prelude.startsWith('@') || !prelude.includes(':has(')) continue;
      const allowed = stack.some(noScript);
      for (const selector of splitList(prelude)) {
        if (!selector.includes(':has(')) continue;
        if (!allowed || !classesOf(selector).some((name) => ALLOW.has(name))) bad.push(selector);
      }
    } else if (c === '}') {
      stack.pop();
      start = i + 1;
    }
  }
  return bad;
}

/**
 * The site's CSS files, as paths relative to `.next`: every entry CSS file of the app's client
 * reference manifests, except the admin's (Payload's own CSS uses `:has()`; /giris only).
 */
export function siteCss(next) {
  const app = path.join(next, 'server', 'app');
  const files = new Set();
  for (const name of readdirSync(app, { recursive: true })) {
    if (!name.endsWith('_client-reference-manifest.js')) continue;
    const context = {};
    context.globalThis = context;
    vm.runInNewContext(readFileSync(path.join(app, name), 'utf8'), context);
    for (const page of Object.values(context.__RSC_MANIFEST ?? {})) {
      for (const [entry, css] of Object.entries(page.entryCSSFiles ?? {})) {
        if (entry.includes('/(payload)/')) continue;
        for (const file of css) files.add(file.path);
      }
    }
  }
  // A Next.js upgrade that moves the manifests would turn the guard off: fail the build.
  if (files.size === 0) throw new Error(`check-has: no site CSS in the manifests under ${app}`);
  return [...files];
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const next =
    process.argv[2] ??
    path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), '.next');
  const files = siteCss(next);
  const bad = files.flatMap((file) =>
    hasViolations(readFileSync(path.join(next, file), 'utf8')).map((s) => `  ${file}: ${s}`),
  );
  if (bad.length > 0) {
    throw new Error(
      `check-has: ${bad.length} :has() selector(s) outside @media (scripting: none) or ALLOW; each makes every DOM insertion restyle the whole page. Use a class, a data attribute or a peer/group variant instead:\n${bad.join('\n')}`,
    );
  }
  console.log(`check-has: ${files.length} site CSS file(s), no active :has() selector`);
}
