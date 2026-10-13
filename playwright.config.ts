import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

import { defaultLaunch, noWebgl2Launch, swiftShaderLaunch } from './tests/helpers/launch';
import { e2eDatabaseUrl } from './tests/setup/e2eGlobal';

const root = path.dirname(fileURLToPath(import.meta.url));

// Local runs read the repo .env (PW_CHROMIUM_EXECUTABLE and the server's secrets); values set in
// the shell win. CI has no .env: the workflow sets every variable.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const CI = Boolean(process.env.CI);
const PORT = Number(process.env.E2E_PORT ?? '3000');
const MAINTENANCE_PORT = PORT + 1;
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

const androidChrome = devices['Pixel 7'].userAgent;

const viewports = {
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: androidChrome,
  },
  tablet: {
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: androidChrome,
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
} as const;

// Six matrix projects: three viewports (00-master.md section 5), light and dark.
const matrix = (['phone', 'tablet', 'desktop'] as const).flatMap((size) =>
  (['light', 'dark'] as const).map((colorScheme) => ({
    name: `${size}-${colorScheme}`,
    testDir: './tests/e2e',
    use: { ...devices['Desktop Chrome'], ...base, ...viewports[size], colorScheme },
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
    standaloneServer(PORT, 'app'),
    // The maintenance suite (503 page) talks to a second server with the switch on.
    standaloneServer(MAINTENANCE_PORT, 'maintenance', { MAINTENANCE_MODE: 'on' }),
  ],
  projects: [
    ...matrix,
    {
      name: 'no-webgl2',
      testDir: './tests/e2e',
      testMatch: /tier0\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...base,
        ...viewports.desktop,
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
        ...viewports.desktop,
        colorScheme: 'light',
        launchOptions: swiftShaderLaunch(),
      },
    },
  ],
});
