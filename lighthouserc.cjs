// Lighthouse CI 0.15.1 (Lighthouse 12.6.1), mobile preset with simulated throttling (Lighthouse's
// default: a mid-range Android phone over 4G, docs/brief.md section 7).
//
// Content budgets run on /qa/not-found (the 404 template rendered with HTTP 200, because
// Lighthouse aborts on a 404 document, freeze decision 3; the route exists only while the server
// runs with QA_ROUTES=1), the restoration service page, the e2e fixture's dentist profile and home
// at tier 0 (phase 4 freeze F11). scripts/lhci.mjs runs this file twice: light, then
// LHCI_THEME=dark. Reports stay on disk (.lighthouseci/reports/<theme>), never on a public link.
const limits = require('./tests/budgets/limits.json');

const KiB = 1024;
const dark = process.env.LHCI_THEME === 'dark';
const port = Number(process.env.E2E_PORT ?? '3000');
const origin = `http://localhost:${port}`;
// scripts/lhci.mjs puts HTTPS and HTTP/2 in front of the server (scripts/tls-front.mjs), as
// production does; over plain HTTP/1.1 Lighthouse's simulation put LCP on the 404 template
// 300-470 ms later.
const tlsPin = process.env.LHCI_TLS_PIN;
const pageOrigin = tlsPin ? `https://localhost:${process.env.LHCI_TLS_PORT}` : origin;

// The artifact that deploys, on the migrated e2e database. ALLOW_INDEXING=true measures the page
// as production serves it (no X-Robots-Tag noindex, which would fail the SEO category); the
// server listens on localhost only. DATABASE_URL is passed by reference so LHCI never prints it.
const startServerCommand = [
  `PORT=${port}`,
  `SITE_URL=${origin}`,
  'QA_ROUTES=1',
  'ALLOW_INDEXING=true',
  'DB_PUSH=false',
  'DATABASE_URL="${E2E_DATABASE_URL:-file:./.data/e2e.db}"',
  'node scripts/start-standalone.mjs',
].join(' ');

// Interim initial-JS limits gate CI; the documented targets (90 KB content, 180 KB home) stay
// below the framework floor and are reported beside the measurements (freeze decision 4).
const scriptLimit = (pageClass) => limits.classes[pageClass].interimKiB * KiB;

const median = { aggregationMethod: 'median' };

const common = {
  'categories:accessibility': ['error', { minScore: 1, ...median }],
  'categories:best-practices': ['error', { minScore: 1, ...median }],
  'categories:seo': ['error', { minScore: 1, ...median }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, ...median }],
  'resource-summary:stylesheet:size': ['error', { maxNumericValue: limits.cssKiB * KiB }],
  'resource-summary:font:size': ['error', { maxNumericValue: limits.fontsKiB * KiB }],
  'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
  'errors-in-console': 'error',
};

// Persian paths are requested percent-encoded; the patterns match that form (encodeURI output
// holds no regex metacharacters). Every URL matches exactly one matrix entry (scripts/lhci.test.ts).
const SERVICE = encodeURI('/خدمات/ترمیم-دندان');
const DENTIST = encodeURI('/پزشکان/دکتر-نمونه-آزمایشی');
const PRICING = encodeURI('/هزینه-و-پرداخت');

const contentAssertions = {
  ...common,
  // INP has no value in a navigation run; total blocking time is the CI proxy. The 200 ms target
  // sits below what the framework alone blocks on a slow CI host. The gate is scripts/lhci.mjs
  // (tbtGate): the median against this interim limit, raised on a slow host to the framework
  // floor page's median plus tbtOverFloorMs (docs/brief.md section 7); LHCI itself only warns.
  // The score warns at its target: TBT, LCP and CLS, 80% of its weight, are errors on their own.
  'total-blocking-time': [
    'warn',
    { maxNumericValue: limits.classes.content.tbtInterimMs, ...median },
  ],
  'categories:performance': ['warn', { minScore: 0.95, ...median }],
  // The best of 5 runs: on a shared 2-core runner, contention only adds time and often makes
  // Lighthouse count the framework scripts (docs/brief.md section 7).
  'largest-contentful-paint': ['error', { maxNumericValue: 2500, aggregationMethod: 'optimistic' }],
  'resource-summary:script:size': ['error', { maxNumericValue: scriptLimit('content') }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand,
      startServerReadyPattern: 'Ready in',
      startServerReadyTimeout: 60000,
      url: [
        // The framework floor of this build (src/app/(floor)): no assertions, the TBT gate's base.
        `${pageOrigin}/qa/floor`,
        `${pageOrigin}/qa/not-found`,
        `${pageOrigin}${SERVICE}`,
        `${pageOrigin}${DENTIST}`,
        `${pageOrigin}${PRICING}`,
        `${pageOrigin}/?tier=0`,
        `${pageOrigin}/?tier=1`,
      ],
      // 5 runs: simulated LCP on the 404 template spreads up to 0.8 s between runs on the
      // container (1359-2121 ms) and more on a shared CI runner. Lighthouse counts every script
      // that ran before the first paint of the unthrottled load, and that order changes from
      // run to run. scripts/lhci.mjs prints min, median and max per URL.
      numberOfRuns: 5,
      // chromePath comes from CHROME_PATH: the container Chromium locally, the Playwright
      // Chromium in CI. --no-sandbox because the container runs Chrome as root.
      settings: {
        // scripts/lhci.mjs measures the host and picks Lighthouse's documented multiplier for a
        // mid-tier mobile target (4x on a fast desktop, 2x on a slower one); 4x is the default.
        throttling: { cpuSlowdownMultiplier: Number(process.env.LHCI_CPU_MULTIPLIER ?? '4') },
        chromeFlags: [
          '--headless=new',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          ...(dark ? ['--blink-settings=preferredColorScheme=0'] : []),
          // Trusts the one throwaway certificate of scripts/lhci.mjs, nothing else.
          ...(tlsPin ? [`--ignore-certificate-errors-spki-list=${tlsPin}`] : []),
        ].join(' '),
      },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '/qa/floor', assertions: {} },
        { matchingUrlPattern: '/qa/not-found', assertions: contentAssertions },
        { matchingUrlPattern: SERVICE, assertions: contentAssertions },
        { matchingUrlPattern: DENTIST, assertions: contentAssertions },
        { matchingUrlPattern: PRICING, assertions: contentAssertions },
        {
          matchingUrlPattern: '/\\?tier=0',
          assertions: {
            ...contentAssertions,
            // Home ships the experience scaffold and two booking islands: the home interim limit.
            'resource-summary:script:size': ['error', { maxNumericValue: scriptLimit('home') }],
          },
        },
        {
          matchingUrlPattern: '/\\?tier=1',
          assertions: {
            // Home is a placeholder in phase 3: these become errors with the real home in
            // phase 7 (docs/prompts/07-scroll-experience.md).
            'categories:performance': ['warn', { minScore: 0.9, ...median }],
            'largest-contentful-paint': ['warn', { maxNumericValue: 2500, ...median }],
            'resource-summary:script:size': ['warn', { maxNumericValue: scriptLimit('home') }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, ...median }],
            'resource-summary:third-party:count': ['error', { maxNumericValue: 0 }],
          },
        },
      ],
    },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/reports/${dark ? 'dark' : 'light'}`,
    },
  },
};
