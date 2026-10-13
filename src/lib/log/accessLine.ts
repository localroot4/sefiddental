import { readEnv } from '@/lib/env';
import { scrubDeep } from '@/lib/log/redact';

const RANK = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const;

/**
 * The proxy's log writer: same field names as the pino logger (`time`, `level`, `msg`,
 * `service`, `sha`, `reqId`, `route`) without importing pino. Phone-scrubbed like every line.
 * The proxy logs its own outcomes (`redirect`, `canonical_redirect`, `maintenance`, `gone`,
 * `rate_limited`) at info and everything else at debug.
 */
export function accessLine(fields: {
  level: 'info' | 'warn' | 'debug';
  msg: string;
  reqId: string;
  route?: string;
  [k: string]: unknown;
}): void {
  let min: number = RANK.info;
  let sha = 'unknown';
  try {
    const env = readEnv();
    min = RANK[env.logLevel];
    sha = env.gitSha;
  } catch {
    // Keep logging with defaults; assertEnv reports the broken environment at boot.
  }
  if (RANK[fields.level] < min) return;
  const route = typeof fields.route === 'string' ? fields.route.split('?')[0] : undefined;
  const line = scrubDeep({
    time: new Date().toISOString(),
    service: 'sefid-web',
    sha,
    ...fields,
    ...(route === undefined ? {} : { route }),
  });
  process.stdout.write(`${JSON.stringify(line)}\n`);
}
