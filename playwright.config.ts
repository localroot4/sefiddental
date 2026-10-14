import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

import { defaultLaunch, noWebgl2Launch, swiftShaderLaunch } from './tests/helpers/launch';
import { VIEWPORTS } from './tests/helpers/screens';
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
const baseURL = `http://localhost:${PORT}`;

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

const base = {
  locale: 'fa-IR',
  timezoneId: 'Asia/Tehran',
  launchOptions: defaultLaunch(),
} as const;

// Six matrix projects: three viewports (00-master.md section 5), light and dark.
const matrix = (['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
  (['light', 'dark'] as const).map((colorScheme) => ({
    name: `${size}-${colorScheme}`,
    testDir: './tests/e2e',
    // Each of these files has its own project below.
    testIgnore: [/[\\/]http[\\/]/, /admin\.spec\.ts/, /tier0\.spec\.ts/],
    use: { ...devices['Desktop Chrome'], ...base, ...VIEWPORTS[size], colorScheme },
  })),
);

export default defineConfig({
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // A test that passes only on retry still fails CI: retries collect traces, never hide flakes.
  failOnFlakyTests: CI,
  fullyParallel: true,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'on-first-retry' },
  // Resets the e2e accounts after the servers start (tests/setup/e2eUsers.ts).
  globalSetup: './tests/setup/e2eGlobal.ts',
  webServer: [
    // PROXY_CONFIG_TTL_MS=0: the proxy reads the redirects table on every page request, so a
    // redirect saved in the admin applies to the next request (no 30 s memo to wait out).
    standaloneServer(PORT, 'app', { PROXY_CONFIG_TTL_MS: '0' }),
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
    {
      name: 'perf-swiftshader',
      testDir: './tests/perf',
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        ...base,
        ...VIEWPORTS.desktop,
        colorScheme: 'light',
        launchOptions: swiftShaderLaunch(),
      },
    },
  ],
});
