import type { ServerEnv } from '@/lib/env';
import type { PathKind } from '@/lib/http/classify';
import { STATIC_PAGE_STYLE_SHA256 } from '@/lib/system-pages/staticPage';
import { THEME_INIT_SCRIPT_SHA256 } from '@/lib/theme/themeInitScript';

export type CspHeaderName = 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only';

/** Policy of every non-HTML response (API, internal, feeds): nothing may load or frame it. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

export const CSP_REPORT_PATH = '/api/csp-report';
export const CSP_REPORT_GROUP = 'csp';

/** GA4 hosts, added only when the features global enables GA4 (spec 7.2; regional host unverified). */
const GA_SCRIPT = ['https://www.googletagmanager.com'];
const GA_IMG = ['https://*.google-analytics.com', 'https://*.googletagmanager.com'];
const GA_CONNECT = [
  'https://*.google-analytics.com',
  'https://*.analytics.google.com',
  'https://*.googletagmanager.com',
];

/** 16 random bytes, base64: matches Next's nonce pattern `[A-Za-z0-9+/_-]+={0,2}`. */
export function newNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

type Directives = Array<[name: string, ...sources: Array<string | null | false>]>;

function serialize(directives: Directives): string {
  return directives
    .map(([name, ...sources]) =>
      [name, ...sources.filter((s): s is string => Boolean(s))].join(' '),
    )
    .join('; ');
}

/**
 * Content-Security-Policy per route kind (spec 7.2, 7.3; decisions 1, 2, 47).
 *
 * Public pages: nonce plus 'strict-dynamic' for scripts, the theme init script by hash (it also
 * runs where a document renders without the layout nonce); styles by nonce plus the static
 * system page style by hash (/qa/gone serves that document under this policy). Never
 * 'unsafe-inline' or 'unsafe-eval' outside development.
 * Admin: the same script policy; styles keep 'unsafe-inline' (Payload injects runtime styles and
 * exposes no nonce), so style-src carries no nonce or hash, which would void 'unsafe-inline'.
 * Development: 'unsafe-eval' for React's debugging and 'unsafe-inline' styles (Next dev).
 * Report-only mode drops upgrade-insecure-requests, which browsers ignore there with a warning.
 */
export function buildCsp(input: {
  kind: PathKind;
  nonce: string | null;
  env: ServerEnv;
  draft: boolean;
  ga4MeasurementId: string | null;
}): { header: CspHeaderName; value: string } {
  const { kind, nonce, env, draft } = input;
  if (kind !== 'page' && kind !== 'admin') {
    return { header: 'Content-Security-Policy', value: API_CSP };
  }

  const mode = kind === 'admin' ? env.cspAdminMode : env.cspMode;
  const header: CspHeaderName =
    mode === 'report-only' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
  const dev = env.nodeEnv === 'development';
  const https = new URL(env.siteUrl).protocol === 'https:';
  const media = env.mediaPublicOrigin;
  const nonceSource = nonce === null ? null : `'nonce-${nonce}'`;
  const tail: Directives = [
    ['upgrade-insecure-requests'],
    ['report-uri', CSP_REPORT_PATH],
    ['report-to', CSP_REPORT_GROUP],
  ];
  if (!https || mode === 'report-only') tail.shift();

  if (kind === 'admin') {
    return {
      header,
      value: serialize([
        ['default-src', "'self'"],
        [
          'script-src',
          "'self'",
          nonceSource,
          nonceSource && "'strict-dynamic'",
          dev && "'unsafe-eval'",
        ],
        ['style-src', "'self'", "'unsafe-inline'"],
        ['img-src', "'self'", 'data:', 'blob:', media],
        ['font-src', "'self'", 'data:'],
        ['connect-src', "'self'"],
        ['media-src', "'self'", 'blob:', media],
        ['frame-src', "'self'"],
        ['worker-src', "'self'", 'blob:'],
        ['object-src', "'none'"],
        ['base-uri', "'none'"],
        ['form-action', "'self'"],
        ['frame-ancestors', "'none'"],
        ...tail,
      ]),
    };
  }

  const ga = input.ga4MeasurementId !== null;
  return {
    header,
    value: serialize([
      ['default-src', "'self'"],
      [
        'script-src',
        "'self'",
        nonceSource,
        nonceSource && "'strict-dynamic'",
        `'sha256-${THEME_INIT_SCRIPT_SHA256}'`,
        dev && "'unsafe-eval'",
        ...(ga ? GA_SCRIPT : []),
      ],
      dev
        ? ['style-src', "'self'", "'unsafe-inline'"]
        : ['style-src', "'self'", nonceSource, `'sha256-${STATIC_PAGE_STYLE_SHA256}'`],
      ['img-src', "'self'", 'data:', 'blob:', media, ...(ga ? GA_IMG : [])],
      ['font-src', "'self'"],
      ['connect-src', "'self'", ...(ga ? GA_CONNECT : [])],
      ['media-src', "'self'", media],
      ['worker-src', "'self'"],
      ['manifest-src', "'self'"],
      ['frame-src', "'none'"],
      ['object-src', "'none'"],
      ['base-uri', "'none'"],
      ['form-action', "'self'"],
      // Live preview (phase 4) frames public pages from the admin only while the draft cookie is set.
      ['frame-ancestors', draft ? "'self'" : "'none'"],
      ...tail,
    ]),
  };
}
