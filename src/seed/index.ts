// `npm run seed` = `payload run src/seed/index.ts [create-only|sync|fill|dry-run]`. `payload run` passes
// positional arguments to the script but drops --flags (PAY 12.5), so the mode is positional.
// `npm run seed -- copy-sync [apply]`: the three-way copy update of ./copySync.ts, a dry run
// unless `apply` follows. It prints natural keys, field names and counts, never a value.
import config from '@payload-config';
import { getPayload } from 'payload';

import { readEnv } from '@/lib/env';

import { copySyncSummary, runCopySync } from './copySync';
import { runSeed, summary, type SeedMode } from './run';

const MODES: readonly string[] = ['create-only', 'sync', 'fill', 'dry-run', 'copy-sync'];
const [arg, flag] = process.argv.slice(2).filter((value) => !value.startsWith('-'));
const mode = arg ?? 'create-only';
if (!MODES.includes(mode)) {
  throw new Error(`seed: unknown mode "${arg}". Use one of: ${MODES.join(', ')}.`);
}
if (flag !== undefined && !(mode === 'copy-sync' && flag === 'apply')) {
  throw new Error(`seed: unknown argument "${flag}". Only copy-sync takes one: apply.`);
}

const payload = await getPayload({ config });
if (mode === 'copy-sync') {
  const report = await runCopySync(payload, { root: process.cwd(), apply: flag === 'apply' });
  for (const row of report.rows) {
    if (row.status !== 'unchanged') {
      payload.logger.info(
        `copy-sync: ${row.collection} | ${row.key} | ${row.field} | ${row.status}`,
      );
    }
  }
  for (const line of report.warnings) payload.logger.warn(`copy-sync: ${line}`);
  payload.logger.info(`copy-sync: ${copySyncSummary(report)}`);
} else {
  const report = await runSeed(payload, {
    mode: mode as SeedMode,
    root: process.cwd(),
    nodeEnv: readEnv().nodeEnv,
  });
  payload.logger.info(`seed: ${summary(report)}`);
  for (const line of report.templates) payload.logger.info(`seed: left out ${line}`);
  for (const line of report.warnings) payload.logger.warn(`seed: ${line}`);
  for (const marker of report.markers) {
    payload.logger.info(`seed: ${marker.kind} ${marker.file}:${marker.line} ${marker.path}`);
  }
}
