import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

import { defaultLaunch, noWebgl2Launch, swiftShaderLaunch } from './tests/helpers/launch';
import { VIEWPORTS } from './tests/helpers/screens';
import { APP_ORIGIN, TLS_FRONT, TLS_FRONT_PORT } from './tests/helpers/servers';
import { e2eDatabaseUrl } from './tests/setup/e2eGlobal';

const root = path.dirname(fileURLToPath(import.meta.url));

// Local runs read the repo .env (PW_CHROMIUM_EXECUTABLE and the server's secrets); values set in
// the shell win. CI has no .env: the workflow sets every variable.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.E2E_PORT ?? '3000');
const MAINTENANCE_PORT = PORT + 1;
const INDEXING_PORT = PORT + 2;
const baseURL = APP_ORIGIN;

// e2e always runs the artifact that deploys (`node .next/standalone/server.js` through
// scripts/start-standalone.mjs) on a migrated database, never a pushed one (freeze 7.2):
// E2E_DATABASE_URL in CI, else the local file `npm run db:e2e` builds.
const databaseUrl = e2eDatabaseUrl();

function serverEnv(port: number, extra: Record<string, string> = {}): Record<string, string> {
  return {
    PORT: String(port),
    SITE_URL: `http://localhost:${port}`,
    DATABASE_URL: databaseUrl,
    DB_PUSH: 'false',
    QA_ROUTES: '1',
    ...extra,
  };
}

type WebServer = Exclude<NonNullable<PlaywrightTestConfig['webServer']>, readonly unknown[]>;

function standaloneServer(port: number, name: string, extra?: Record<string, string>): WebServer {
  return {
    name,
    command: 'npm run start:standalone',
    cwd: root,
    env: serverEnv(port, extra),
    url: `http://localhost:${port}/api/health`,
    // The standalone server prints "Ready in" once it listens; either signal starts the tests.
    wait: { stdout: /Ready in/ },
    // A server already on the port could be a dev server on a pushed database: fail instead.
    reuseExistingServer: false,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    stdout: 'ignore',
    stderr: 'pipe',
    timeout: 120_000,
  };
}

// The WebKit run goes through the TLS front (tests/helpers/servers.ts): a throwaway localhost
// certificate, held in memory by the front only.
const tlsFront: WebServer[] = TLS_FRONT
  ? [
      {
        name: 'tls-front',
        command: `node scripts/tls-front.mjs ${TLS_FRONT_PORT} ${PORT}`,
        cwd: root,
        url: `${APP_ORIGIN}/api/health`,
        ignoreHTTPSErrors: true,
        reuseExistingServer: false,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 120_000,
      },
    ]
  : [];

// Firefox headless on the CI runner offers no WebGL 2 unless forced: every page then latches
// tier 0 (no-webgl2, decision D-Q3), whatever ?tier says, and no scene runs (CI run 85).
const FIREFOX_WEBGL = { 'webgl.force-enabled': true, 'webgl.forbid-software': false };

const base = {
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  launchOptions: defaultLaunch(),
} as const;

// E2E_ENGINE=webkit or firefox moves the six matrix projects into that engine and keeps their
// names, which the specs gate rows on; the other projects stay on Chromium (CDP, GPU flags). The
// CI cross-engine job sets it. Firefox has no isMobile: run only its desktop projects.
const ENGINE = process.env.E2E_ENGINE?.trim() || undefined;
if (ENGINE !== undefined && ENGINE !== 'webkit' && ENGINE !== 'firefox') {
  throw new Error(`E2E_ENGINE must be webkit or firefox, got "${ENGINE}".`);
}

// Six matrix projects: three viewports (00-master.md section 5), light and dark.
const matrix = (['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
  (['light', 'dark'] as const).map((colorScheme) => {
    const engine = ENGINE
      ? devices[
          ENGINE === 'firefox'
            ? 'Desktop Firefox'
            : size === 'desktop'
              ? 'Desktop Safari'
              : 'iPhone 15'
        ]
      : undefined;
    return {
      name: `${size}-${colorScheme}`,
      testDir: './tests/e2e',
      // Each of these files has its own project below.
      testIgnore: [/[\\/]http[\\/]/, /admin\.spec\.ts/, /tier0\.spec\.ts/],
      use: {
        ...devices['Desktop Chrome'],
        ...base,
        ...VIEWPORTS[size],
        colorScheme,
        // The engine's own browser and user agent; the Chromium path from .env does not apply.
        ...(engine && {
          browserName: engine.defaultBrowserType,
          userAgent: engine.userAgent,
          launchOptions: ENGINE === 'firefox' ? { firefoxUserPrefs: FIREFOX_WEBGL } : {},
        }),
      },
    };
  }),
);

export default defineConfig({
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // A test that passes only on retry still fails CI: retries collect traces, never hide flakes.
  failOnFlakyTests: CI,
  fullyParallel: true,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'on-first-retry', ...(TLS_FRONT && { ignoreHTTPSErrors: true }) },
  // Resets the e2e accounts after the servers start (tests/setup/e2eUsers.ts).
  globalSetup: './tests/setup/e2eGlobal.ts',
  webServer: [
    // PROXY_CONFIG_TTL_MS=0: the proxy reads the redirects table on every page request, so a
    // redirect saved in the admin applies to the next request (no 30 s memo to wait out).
    // FORM_SESSION_RATE_LIMIT: every page fetches /api/form-session, and all tests share one
    // localhost client; production keeps 60 a minute.
    // TRUST_PROXY_HEADERS (phase 5 freeze G18): booking tests send their own X-Forwarded-For from
    // 2001:db8::/32, so the per-IP rules see one client per test; requests without the header
    // behave as before.
    standaloneServer(PORT, 'app', {
      PROXY_CONFIG_TTL_MS: '0',
      FORM_SESSION_RATE_LIMIT: '100000',
      TRUST_PROXY_HEADERS: 'true',
      TRUSTED_PROXY_HOPS: '1',
      SITE_URL: APP_ORIGIN,
    }),
    ...tlsFront,
    // The maintenance suite (503 page) talks to a second server with the switch on.
    standaloneServer(MAINTENANCE_PORT, 'maintenance', { MAINTENANCE_MODE: 'on' }),
    // The same artifact with ALLOW_INDEXING=true: robots.txt and sitemaps switch at run time
    // (freeze decision 39), without a rebuild.
    standaloneServer(INDEXING_PORT, 'indexing', { ALLOW_INDEXING: 'true' }),
  ],
  projects: [
    ...matrix,
    // Request-level checks (routes, redirects, headers, robots) do not depend on the viewport
    // or the theme: one run, desktop light.
    {
      name: 'http',
      testDir: './tests/e2e/http',
      use: { ...devices['Desktop Chrome'], ...base, ...VIEWPORTS.desktop, colorScheme: 'light' },
    },
    // Admin flows share two accounts and the sign-in rate limit (10 POSTs per 15 minutes per
    // client key, decision 41): one serial file, one project, no retry (a retry would sign in
    // again and could hit 429).
    {
      name: 'admin',
      testDir: './tests/e2e',
      testMatch: /admin\.spec\.ts/,
      retries: 0,
      use: { ...devices['Desktop Chrome'], ...base, ...VIEWPORTS.desktop, colorScheme: 'light' },
    },
    {
      name: 'no-webgl2',
      testDir: './tests/e2e',
      testMatch: /tier0\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...base,
        ...VIEWPORTS.desktop,
        colorScheme: 'light',
        launchOptions: noWebgl2Launch(),
      },
    },
    // The recorders render on the CPU (SwiftShader) under 4x and 6x throttling for minutes: on
    // CI's 2 cores a test running beside them starves (T-AD32 timed out in run 53). They start
    // once every other project is done, one test at a time; `--no-deps` runs them alone.
    {
      name: 'perf-swiftshader',
      testDir: './tests/perf',
      fullyParallel: false,
      workers: 1,
      dependencies: [
        'phone-light',
        'phone-dark',
        'tablet-light',
        'tablet-dark',
        'desktop-light',
        'desktop-dark',
        'http',
        'admin',
        'no-webgl2',
      ],
      use: {
        ...devices['Desktop Chrome'],
        ...base,
        ...VIEWPORTS.desktop,
        colorScheme: 'light',
        launchOptions: swiftShaderLaunch(),
      },
    },
    // The same recorders on the default GPU: the measurement host's frame numbers (phase 7
    // report D19). `PERF_GATE=1 npx playwright test --project=perf-default` asserts the budgets.
    {
      name: 'perf-default',
      testDir: './tests/perf',
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'], ...base, ...VIEWPORTS.desktop, colorScheme: 'light' },
    },
  ],
});
