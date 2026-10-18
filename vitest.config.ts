import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// `npm run test:tz` runs the date suites under several TZ values. V8 silently falls back to UTC
// for an unknown zone, so a typo would make every run look like UTC: fail before any test runs.
function checkTimeZone(): void {
  const tz = process.env.TZ?.replace(/^:/, '');
  if (!tz) return;
  let wanted: string;
  try {
    wanted = new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    throw new Error(`vitest.config.ts: TZ="${tz}" is not an IANA time zone (e.g. Asia/Tehran).`);
  }
  const active = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (active !== wanted) {
    throw new Error(`vitest.config.ts: TZ="${tz}" is set, but the process runs in "${active}".`);
  }
  console.info(`vitest: TZ=${tz}`);
}
checkTimeZone();

// Never collect tests from build output: a stale .next/standalone must not add test files.
const exclude = [...configDefaults.exclude, '.next/**', 'coverage/**', '.vitest/**'];

export default defineConfig({
  plugins: [react()],
  // Vite 8 resolves the tsconfig `paths` (@/*, @payload-config) itself.
  resolve: { tsconfigPaths: true },
  test: {
    exclude,
    // Inline projects inherit this root config (plugins, resolve, exclude) in Vitest 5.
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: [
            'src/**/*.test.ts',
            'scripts/**/*.test.ts',
            'tests/helpers/**/*.test.ts',
            'deploy/**/*.test.ts',
          ],
          exclude: [...exclude, 'src/**/*.int.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./tests/setup/dom.ts'],
        },
      },
      {
        test: {
          name: 'int',
          environment: 'node',
          include: ['tests/int/**/*.int.test.ts', 'tests/setup/**/*.int.test.ts'],
          globalSetup: ['./tests/setup/intGlobal.ts'],
          setupFiles: ['./tests/setup/int.ts'],
          // One database per worker and no parallel files: tests share tables, never rows.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib',
        'src/experience/core',
        'src/experience/tier',
        'src/experience/engine/timelineMath.ts',
        'src/experience/scenes',
      ],
      exclude: [
        '**/*.test.{ts,tsx}',
        // Server-only readers and the event counter run against a database: tests/int covers them.
        'src/lib/data/**',
        'src/lib/events/increment.ts',
      ],
      thresholds: {
        'src/lib/**': { lines: 90, branches: 85, functions: 90 },
        'src/experience/**': { lines: 80, branches: 75, functions: 80 },
      },
    },
  },
});
