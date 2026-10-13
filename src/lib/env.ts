import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { z } from 'zod';

/**
 * The one environment schema of the app. Server code reads configuration only through
 * `readEnv()`; `.env.example` documents every name. `next build` needs only a parseable
 * DATABASE_URL and a non-empty PAYLOAD_SECRET: during the build phase every other value
 * falls back to its development default.
 */

export type DbKind = 'postgres' | 'sqlite';
type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
type CspMode = 'enforce' | 'report-only';

export interface ServerEnv {
  nodeEnv: 'development' | 'test' | 'production';
  siteUrl: string;
  gitSha: string;
  buildTime: string | null;
  databaseUrl: string;
  dbKind: DbKind;
  payloadSecret: string;
  cronSecret: string;
  internalApiToken: string;
  internalOrigin: string;
  ipHashSecret: string;
  formTokenSecrets: readonly string[];
  formTokenTtlSeconds: number;
  allowFirstUser: boolean;
  allowIndexing: boolean;
  trustProxyHeaders: boolean;
  trustedProxyHops: number;
  maintenance: boolean;
  maintenanceRetryAfter: number;
  cspMode: CspMode;
  cspAdminMode: CspMode;
  qaRoutes: boolean;
  mediaDir: string;
  mediaPublicOrigin: string | null;
  s3: {
    bucket: string;
    endpoint: string | undefined;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
  } | null;
  smtp: {
    host: string;
    port: number;
    user: string | undefined;
    pass: string | undefined;
    from: string;
  } | null;
  logLevel: LogLevel;
  proxyConfigTtlMs: number;
}

type Source = Record<string, string | undefined>;

/** Secrets: at least 43 characters, the length of `openssl rand -base64 32` without padding. */
const MIN_SECRET_LENGTH = 43;

/** Every generated secret the app needs, with the fix printed when it is missing. */
const SECRETS = {
  CRON_SECRET: 'set it to `openssl rand -base64 48`; the cron caller sends it as a bearer token',
  INTERNAL_API_TOKEN: 'set it to `openssl rand -base64 48`',
  IP_HASH_SECRET: 'set it to `openssl rand -base64 48`',
  FORM_TOKEN_SECRET: 'set it to `openssl rand -base64 48`',
} as const;
type SecretName = keyof typeof SECRETS;

export function dbKindFromUrl(url: string): DbKind {
  if (url.startsWith('file:')) return 'sqlite';
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres';
  throw new Error(
    'DATABASE_URL has an unknown scheme: use postgres://, postgresql:// or file: (see .env.example)',
  );
}

const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const text = () => z.preprocess(blankToUndefined, z.string().trim().optional());
const flag = (defaultValue: boolean) =>
  z.preprocess(
    blankToUndefined,
    z
      .stringbool({ truthy: ['true', '1', 'on', 'yes'], falsy: ['false', '0', 'off', 'no'] })
      .default(defaultValue),
  );
const integer = (defaultValue: number, min: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).default(defaultValue));
const oneOf = <T extends readonly [string, ...string[]]>(values: T, defaultValue: T[number]) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? blankToUndefined(v.toLowerCase().trim()) : v),
    z.enum(values).default(defaultValue),
  );

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

/** Origin only: scheme, host and port; no path, query, fragment or trailing slash. */
const origin = (name: string, options: { forbidWww?: boolean } = {}) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .refine((v) => {
        const u = parseUrl(v);
        return u !== null && (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === v;
      }, `${name} must be an origin like https://example.com (no path, no trailing slash)`)
      .refine(
        (v) => !options.forbidWww || !parseUrl(v)?.hostname.startsWith('www.'),
        `${name} must use the apex host, not www.`,
      )
      .optional(),
  );

const rawSchema = z.object({
  NODE_ENV: oneOf(['development', 'test', 'production'] as const, 'development'),
  SITE_URL: origin('SITE_URL', { forbidWww: true }),
  GIT_SHA: text(),
  BUILD_TIME: text(),
  DATABASE_URL: text(),
  PAYLOAD_SECRET: text(),
  CRON_SECRET: text(),
  INTERNAL_API_TOKEN: text(),
  INTERNAL_ORIGIN: origin('INTERNAL_ORIGIN'),
  IP_HASH_SECRET: text(),
  FORM_TOKEN_SECRET: text(),
  FORM_TOKEN_SECRET_PREVIOUS: text(),
  FORM_TOKEN_TTL_SECONDS: integer(7200, 60),
  ALLOW_FIRST_USER: flag(false),
  ALLOW_INDEXING: flag(false),
  TRUST_PROXY_HEADERS: flag(false),
  TRUSTED_PROXY_HOPS: integer(1, 1),
  MAINTENANCE_MODE: flag(false),
  MAINTENANCE_RETRY_AFTER: integer(900, 1),
  CSP_MODE: oneOf(['enforce', 'report-only'] as const, 'enforce'),
  CSP_ADMIN_MODE: oneOf(['enforce', 'report-only'] as const, 'report-only'),
  QA_ROUTES: flag(false),
  MEDIA_DIR: text(),
  MEDIA_PUBLIC_ORIGIN: origin('MEDIA_PUBLIC_ORIGIN'),
  S3_BUCKET: text(),
  S3_ENDPOINT: z.preprocess(blankToUndefined, z.url().optional()),
  S3_REGION: text(),
  S3_FORCE_PATH_STYLE: flag(false),
  S3_ACCESS_KEY_ID: text(),
  S3_SECRET_ACCESS_KEY: text(),
  SMTP_HOST: text(),
  SMTP_PORT: integer(587, 1),
  SMTP_USER: text(),
  SMTP_PASS: text(),
  SMTP_FROM: z.preprocess(
    blankToUndefined,
    z.email('SMTP_FROM must be an e-mail address').optional(),
  ),
  LOG_LEVEL: oneOf(['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const, 'info'),
  PROXY_CONFIG_TTL_MS: integer(30_000, 0),
  PORT: integer(3000, 1),
});

/** Production at run time is strict; the build phase and dev/test fall back to defaults. */
function isStrict(nodeEnv: ServerEnv['nodeEnv'], source: Source): boolean {
  return nodeEnv === 'production' && source.NEXT_PHASE !== 'phase-production-build';
}

/** Per-process random values for missing dev secrets: stable for the life of the process. */
const devSecrets = new Map<SecretName, string>();
function devSecret(name: SecretName, quiet: boolean): string {
  let value = devSecrets.get(name);
  if (!value) {
    value = randomBytes(32).toString('base64url');
    devSecrets.set(name, value);
    // One line per secret; the logger is not imported here (the proxy imports this module).
    // Quiet during `next build`: every build worker would print the same lines.
    if (!quiet) {
      console.warn(
        JSON.stringify({ level: 'warn', msg: `${name} not set: using a random per-process value` }),
      );
    }
  }
  return value;
}

export function parseEnv(source: Source): ServerEnv {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const raw = parsed.data;
  const strict = isStrict(raw.NODE_ENV, source);
  const problems: string[] = [];
  const missing = (name: string, fix: string) => problems.push(`${name} missing: ${fix}`);

  // Always required, also at build time.
  if (!raw.DATABASE_URL) {
    missing('DATABASE_URL', 'set postgres://user:pass@host:5432/db or file:./.data/dev.db');
  }
  if (!raw.PAYLOAD_SECRET) missing('PAYLOAD_SECRET', 'set it to `openssl rand -base64 48`');
  let dbKind: DbKind = 'sqlite';
  if (raw.DATABASE_URL) {
    try {
      dbKind = dbKindFromUrl(raw.DATABASE_URL);
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  const tooShort = (name: string, value: string | undefined) => {
    if (strict && value !== undefined && value.length < MIN_SECRET_LENGTH) {
      problems.push(
        `${name} too short: use at least ${MIN_SECRET_LENGTH} characters (openssl rand -base64 48)`,
      );
    }
  };
  tooShort('PAYLOAD_SECRET', raw.PAYLOAD_SECRET);

  const secret = (name: SecretName): string => {
    const value = raw[name];
    if (value) {
      tooShort(name, value);
      return value;
    }
    if (strict) {
      missing(name, SECRETS[name]);
      return '';
    }
    return devSecret(name, source.NEXT_PHASE === 'phase-production-build');
  };

  if (strict && !raw.SITE_URL) {
    missing('SITE_URL', 'set it to the public origin, e.g. https://sefiddental.ir');
  }
  if (strict && !raw.GIT_SHA) missing('GIT_SHA', 'the build or deploy step sets the commit SHA');

  let mediaDir = raw.MEDIA_DIR;
  if (mediaDir && !path.isAbsolute(mediaDir)) {
    problems.push('MEDIA_DIR must be an absolute path outside .next');
  }
  if (!mediaDir) {
    if (strict) missing('MEDIA_DIR', 'set an absolute directory outside .next for uploads');
    mediaDir = path.resolve(process.cwd(), 'media');
  }

  let s3: ServerEnv['s3'] = null;
  if (raw.S3_BUCKET) {
    if (!raw.S3_ACCESS_KEY_ID) missing('S3_ACCESS_KEY_ID', 'required when S3_BUCKET is set');
    if (!raw.S3_SECRET_ACCESS_KEY) {
      missing('S3_SECRET_ACCESS_KEY', 'required when S3_BUCKET is set');
    }
    s3 = {
      bucket: raw.S3_BUCKET,
      endpoint: raw.S3_ENDPOINT,
      region: raw.S3_REGION ?? 'default',
      accessKeyId: raw.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: raw.S3_SECRET_ACCESS_KEY ?? '',
      forcePathStyle: raw.S3_FORCE_PATH_STYLE,
    };
  }

  let smtp: ServerEnv['smtp'] = null;
  if (raw.SMTP_HOST) {
    if (!raw.SMTP_FROM) missing('SMTP_FROM', 'required when SMTP_HOST is set: the sender address');
    smtp = {
      host: raw.SMTP_HOST,
      port: raw.SMTP_PORT,
      user: raw.SMTP_USER,
      pass: raw.SMTP_PASS,
      from: raw.SMTP_FROM ?? '',
    };
  }

  const env: ServerEnv = {
    nodeEnv: raw.NODE_ENV,
    siteUrl: raw.SITE_URL ?? 'http://localhost:3000',
    gitSha: raw.GIT_SHA ?? 'dev',
    buildTime: raw.BUILD_TIME ?? null,
    databaseUrl: raw.DATABASE_URL ?? '',
    dbKind,
    payloadSecret: raw.PAYLOAD_SECRET ?? '',
    cronSecret: secret('CRON_SECRET'),
    internalApiToken: secret('INTERNAL_API_TOKEN'),
    internalOrigin: raw.INTERNAL_ORIGIN ?? `http://127.0.0.1:${raw.PORT}`,
    ipHashSecret: secret('IP_HASH_SECRET'),
    formTokenSecrets: [secret('FORM_TOKEN_SECRET'), raw.FORM_TOKEN_SECRET_PREVIOUS].filter(
      (v): v is string => Boolean(v),
    ),
    formTokenTtlSeconds: raw.FORM_TOKEN_TTL_SECONDS,
    allowFirstUser: raw.ALLOW_FIRST_USER,
    allowIndexing: raw.ALLOW_INDEXING,
    trustProxyHeaders: raw.TRUST_PROXY_HEADERS,
    trustedProxyHops: raw.TRUSTED_PROXY_HOPS,
    maintenance: raw.MAINTENANCE_MODE,
    maintenanceRetryAfter: raw.MAINTENANCE_RETRY_AFTER,
    cspMode: raw.CSP_MODE,
    cspAdminMode: raw.CSP_ADMIN_MODE,
    qaRoutes: raw.QA_ROUTES,
    mediaDir,
    mediaPublicOrigin: raw.MEDIA_PUBLIC_ORIGIN ?? null,
    s3,
    smtp,
    logLevel: raw.LOG_LEVEL,
    proxyConfigTtlMs: raw.PROXY_CONFIG_TTL_MS,
  };

  if (problems.length > 0) {
    // Names and fixes only: a value is never printed.
    throw new Error(`Environment is incomplete:\n${problems.join('\n')}`);
  }
  return env;
}

let cached: ServerEnv | undefined;

/** Parsed environment. Memoized for `process.env`; pass `source` in tests. */
export function readEnv(source?: Source): ServerEnv {
  if (source) return parseEnv(source);
  cached ??= parseEnv(process.env);
  return cached;
}

/** Fail fast at server start. No-op during `next build` (NEXT_PHASE is set by Next). */
export function assertEnv(): void {
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  readEnv();
}
