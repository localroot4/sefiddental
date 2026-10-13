// Global setup of the Vitest `int` project: one fresh temporary directory per run for the SQLite
// files and uploaded media, removed afterwards. A database file that survives a run could make
// Drizzle push prompt on a later schema change (and hang the run), so every run starts empty.
// Secrets the app requires are random per run, so no test file holds one.
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    intDataDir: string;
    intSecrets: Record<string, string>;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sefid-int-'));
  project.provide('intDataDir', dir);
  const names = [
    'PAYLOAD_SECRET',
    'CRON_SECRET',
    'INTERNAL_API_TOKEN',
    'IP_HASH_SECRET',
    'FORM_TOKEN_SECRET',
  ];
  project.provide(
    'intSecrets',
    Object.fromEntries(names.map((name) => [name, randomBytes(48).toString('base64url')])),
  );
  return async () => {
    await rm(dir, { recursive: true, force: true });
  };
}
