// `npm run seed` = `payload run src/seed/index.ts [create-only|sync|fill|dry-run]`. `payload run` passes
// positional arguments to the script but drops --flags (PAY 12.5), so the mode is positional.
import config from '@payload-config';
import { getPayload } from 'payload';

import { readEnv } from '@/lib/env';

import { runSeed, summary, type SeedMode } from './run';

const MODES: readonly SeedMode[] = ['create-only', 'sync', 'fill', 'dry-run'];
const arg = process.argv.slice(2).find((value) => !value.startsWith('-'));
const mode = (arg ?? 'create-only') as SeedMode;
if (!MODES.includes(mode)) {
  throw new Error(`seed: unknown mode "${arg}". Use one of: ${MODES.join(', ')}.`);
}

const payload = await getPayload({ config });
const report = await runSeed(payload, { mode, root: process.cwd(), nodeEnv: readEnv().nodeEnv });

payload.logger.info(`seed: ${summary(report)}`);
for (const line of report.templates) payload.logger.info(`seed: left out ${line}`);
for (const line of report.warnings) payload.logger.warn(`seed: ${line}`);
for (const marker of report.markers) {
  payload.logger.info(`seed: ${marker.kind} ${marker.file}:${marker.line} ${marker.path}`);
}
