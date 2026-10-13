import {
  pino,
  stdSerializers,
  stdTimeFunctions,
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino';

import { readEnv, type ServerEnv } from '@/lib/env';
import { scrubDeep, scrubPhones } from '@/lib/log/redact';
import { warnLines } from '@/lib/log/ringBuffer';

/** Key paths redacted by pino (spec 12.1); value-based phone scrubbing runs as well. */
export const REDACT_PATHS = [
  'phone',
  '*.phone',
  'name',
  '*.name',
  'note',
  '*.note',
  'headers.cookie',
  'headers.authorization',
  'headers["x-internal-token"]',
  'body',
  'token',
  '*.token',
  'password',
  '*.password',
];

const WARN = 40;
const ERROR = 50;

/** stdout plus the warn+ ring buffer; pino sets `lastLevel` before each write (pino.metadata). */
function stdoutWithRing(): DestinationStream {
  const destination = {
    [Symbol.for('pino.metadata')]: true,
    lastLevel: 0,
    write(line: string) {
      process.stdout.write(line);
      if (destination.lastLevel >= WARN) warnLines.push(line);
    },
  };
  return destination;
}

type LoggerSettings = Pick<ServerEnv, 'logLevel' | 'gitSha' | 'nodeEnv'>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * JSON lines: `time` (ISO), `level` (label), `msg` (snake_case event), `service`, `env`, `sha`,
 * plus `reqId` and `route` on request loggers. Never a phone, name, note, IP, cookie, token or
 * full query string: key paths are redacted, every string is phone-scrubbed, errors are
 * serialized and scrubbed. `destination` is injectable for tests.
 */
export function createLogger(settings: LoggerSettings, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: settings.logLevel,
    base: { service: 'sefid-web', env: settings.nodeEnv, sha: settings.gitSha },
    timestamp: stdTimeFunctions.isoTime,
    messageKey: 'msg',
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    serializers: { err: (err: unknown) => scrubDeep(stdSerializers.err(err as Error)) },
    formatters: {
      level: (label) => ({ level: label }),
      log: (object) => {
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(object)) {
          out[key] = key === 'err' ? value : scrubDeep(value);
        }
        return out;
      },
    },
    hooks: {
      logMethod(args, method, level) {
        // A client error (status 4xx on the error, e.g. Payload's AuthenticationError) is a
        // warning, not an ERROR with a stack: Payload's loggingLevels key on class names only.
        const head: unknown = args[0];
        const err = head instanceof Error ? head : isRecord(head) ? head.err : undefined;
        const status = isRecord(err) ? err.status : undefined;
        if (level >= ERROR && typeof status === 'number' && status >= 400 && status < 500) {
          return this.warn(...(args as Parameters<typeof method>));
        }
        // pino copies an error's message into `msg` after this hook; supply it scrubbed instead.
        let list: unknown[] = [...args];
        const [first] = list;
        if (first instanceof Error) {
          list = [{ err: first }, ...(list.length > 1 ? list.slice(1) : [first.message])];
        } else if (
          list.length === 1 &&
          isRecord(first) &&
          first.err instanceof Error &&
          first.msg === undefined
        ) {
          list = [first, first.err.message];
        }
        const scrubbed = list.map((arg) => (typeof arg === 'string' ? scrubPhones(arg) : arg));
        return method.apply(this, scrubbed as Parameters<typeof method>);
      },
    },
  };
  return pino(options, destination ?? stdoutWithRing());
}

function settingsFromEnv(): LoggerSettings {
  try {
    const env = readEnv();
    return { logLevel: env.logLevel, gitSha: env.gitSha, nodeEnv: env.nodeEnv };
  } catch {
    // An incomplete environment fails boot elsewhere (assertEnv); logging must still work.
    return { logLevel: 'info', gitSha: 'unknown', nodeEnv: 'production' };
  }
}

/** The one server logger; Payload receives it as `logger` (spec 12.1). */
export const log: Logger = createLogger(settingsFromEnv());

/** Request logger: `reqId` from the proxy's x-request-id header, `route` a path without query. */
export function logFor(reqId?: string, route?: string): Logger {
  const bindings: Record<string, string> = {};
  if (reqId) bindings.reqId = reqId;
  if (route) bindings.route = scrubPhones(route.split('?')[0] ?? route);
  return log.child(bindings);
}
