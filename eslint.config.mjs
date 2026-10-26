// ESLint 9 flat config, set up as the Next.js 16.4 docs describe (eslint-config-next presets,
// eslint-config-prettier last among the rule sets, globalIgnores overriding the Next defaults).
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

// Banned patterns from docs/prompts/00-master.md section 4 and docs/brief.md section 8.
const bannedSyntax = [
  {
    selector: "CallExpression[callee.property.name='addEventListener'][arguments.0.value='scroll']",
    message:
      'No scroll listeners: use GSAP ScrollTrigger, IntersectionObserver or CSS scroll-driven animation (00-master.md section 4).',
  },
  {
    selector: "JSXAttribute[name.name='onScroll']",
    message: 'No scroll listeners (00-master.md section 4).',
  },
  {
    selector: 'Literal[value=/(^|\\s)h-screen(\\s|$)/]',
    message: 'Use min-h-[100dvh], not "h-screen" (00-master.md section 4).',
  },
  {
    selector: 'TemplateElement[value.raw=/(^|\\s)h-screen(\\s|$)/]',
    message: 'Use min-h-[100dvh], not "h-screen" (00-master.md section 4).',
  },
  // src/app/globals.css resets the breakpoints and defines md (744), lg, xl and 2xl only: Tailwind
  // generates no CSS for an sm variant, so the class would silently do nothing.
  {
    selector: 'Literal[value=/(^|[\\s:])(max-)?sm:/]',
    message: 'No sm breakpoint exists (globals.css defines md, lg, xl, 2xl); use md or max-md.',
  },
  {
    selector: 'TemplateElement[value.raw=/(^|[\\s:])(max-)?sm:/]',
    message: 'No sm breakpoint exists (globals.css defines md, lg, xl, 2xl); use md or max-md.',
  },
  {
    selector: 'Literal[value=/fonts\\.(googleapis|gstatic)\\.com/]',
    message: 'No Google Fonts: self-host through next/font/local (brief.md decision 13).',
  },
  {
    selector: 'Literal[value=/maps\\.googleapis\\.com/]',
    message: 'No Google Maps JavaScript (00-master.md section 4).',
  },
];

const restrictedPaths = [
  { name: 'next/font/google', message: 'Use next/font/local (brief.md decision 13).' },
];

const experienceOnlyPatterns = [
  {
    group: ['three', 'three/*', '@react-three/*', 'detect-gpu', 'lenis', 'lenis/*'],
    message:
      'WebGL and scroll-engine code lives in src/experience only (00-master.md section 4: no WebGL on content pages).',
  },
];

// D-P6 (freeze decision 51): no `style` attribute in server-rendered public HTML, because the
// public CSP has no 'unsafe-inline' for styles. react/forbid-dom-props 7.37.5 has no allow list,
// only `disallowedFor`, so the rule names every HTML element (the HTML element names of the
// aria-query 5.3 `dom` map plus search, slot, template, math). SVG elements stay allowed: the
// exception list belongs to the platform lane (critic G19).
const HTML_ELEMENTS = `
  a abbr acronym address applet area article aside audio b base bdi bdo big blink blockquote body
  br button canvas caption center cite code col colgroup content data datalist dd del details dfn
  dialog dir div dl dt em embed fieldset figcaption figure font footer form frame frameset h1 h2 h3
  h4 h5 h6 head header hgroup hr html i iframe img input ins kbd keygen label legend li link main
  map mark marquee math menu menuitem meta meter nav noembed noscript object ol optgroup option
  output p param picture pre progress q rp rt rtc ruby s samp script search section select slot
  small source spacer span strike strong style sub summary sup table tbody td template textarea
  tfoot th thead time title tr track tt u ul var video wbr xmp
`
  .trim()
  .split(/\s+/);

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Unused code fails the build (--max-warnings=0); a leading underscore marks an
      // intentionally unused binding (callback signatures, destructuring rests).
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-restricted-syntax': ['error', ...bannedSyntax],
      'no-restricted-imports': [
        'error',
        { paths: restrictedPaths, patterns: experienceOnlyPatterns },
      ],
    },
  },
  {
    files: ['src/experience/**', 'tests/**', 'scripts/**'],
    rules: {
      'no-restricted-imports': ['error', { paths: restrictedPaths }],
    },
  },
  {
    files: ['src/app/(site)/**/*.{js,jsx,ts,tsx}', 'src/components/**/*.{js,jsx,ts,tsx}'],
    rules: {
      'react/forbid-dom-props': [
        'error',
        {
          forbid: [
            {
              propName: 'style',
              disallowedFor: HTML_ELEMENTS,
              message:
                'No style attribute in public HTML: the CSP blocks it (D-P6). Use a class, or set el.style through a ref after hydration.',
            },
          ],
        },
      ],
    },
  },
  {
    // Plain Node scripts and CommonJS tool configs.
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  prettier,
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Generated by Payload (generate:types, generate:importmap, migrate:create); regenerated,
    // never edited, so they keep Payload's own style.
    'src/payload-types.ts',
    'src/payload-generated-schema.ts',
    // The admin route folder; a config file cannot import ADMIN_ROUTE (src/lib/paths.ts).
    'src/app/(payload)/giris/importMap.js',
    'src/migrations/**',
    // Read-only sources, generated assets and tool output.
    'design/**',
    'docs/**',
    'content/**',
    'public/**',
    'media/**',
    '.data/**',
    'coverage/**',
    '.vitest/**',
    '.lighthouseci/**',
    'playwright-report/**',
    'test-results/**',
    'blob-report/**',
    // The cPanel package (scripts/package-cpanel.mjs): a built copy of the site.
    'release/**',
  ]),
]);
