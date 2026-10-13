import { z } from 'zod';

import { scrubPhones } from '@/lib/log/redact';

/** One violation, reduced to what may be logged: no query strings, no full URLs (spec 7.6). */
export interface CspViolation {
  directive: string;
  blocked: string;
  path: string;
}

export const CSP_REPORT_MAX_BYTES = 16 * 1024;
const MAX_REPORTS = 20;

const legacySchema = z.object({
  'csp-report': z.object({
    'document-uri': z.string().optional(),
    'violated-directive': z.string().optional(),
    'effective-directive': z.string().optional(),
    'blocked-uri': z.string().optional(),
  }),
});

const reportingSchema = z.array(
  z.object({
    type: z.string(),
    url: z.string().optional(),
    body: z
      .object({
        documentURL: z.string().optional(),
        effectiveDirective: z.string().optional(),
        blockedURL: z.string().optional(),
      })
      .optional(),
  }),
);

/** Blocked resource as a keyword (`inline`, `eval`, `data`, …) or an origin; never a full URL. */
function reduceBlocked(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  if (value === '') return 'unknown';
  if (/^[a-z-]+$/i.test(value)) return value.toLowerCase();
  try {
    const url = new URL(value);
    if (
      url.protocol === 'http:' ||
      url.protocol === 'https:' ||
      url.protocol === 'wss:' ||
      url.protocol === 'ws:'
    ) {
      return url.origin;
    }
    return url.protocol.slice(0, -1);
  } catch {
    return 'unknown';
  }
}

function documentPath(raw: string | undefined): string {
  if (!raw) return 'unknown';
  try {
    return scrubPhones(decodeURIComponentSafe(new URL(raw).pathname));
  } catch {
    return 'unknown';
  }
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const directiveName = (raw: string | undefined) =>
  (raw ?? 'unknown').trim().split(/\s+/)[0] ?? 'unknown';

/**
 * Parses `application/csp-report` (report-uri) and `application/reports+json` (report-to)
 * bodies. Returns null when the body is not one of them; unknown report types are skipped.
 */
export function parseCspReports(contentType: string, text: string): CspViolation[] | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const type = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'application/csp-report' || type === 'application/json') {
    const parsed = legacySchema.safeParse(json);
    if (parsed.success) {
      const r = parsed.data['csp-report'];
      return [
        {
          directive: directiveName(r['effective-directive'] ?? r['violated-directive']),
          blocked: reduceBlocked(r['blocked-uri']),
          path: documentPath(r['document-uri']),
        },
      ];
    }
  }
  if (type === 'application/reports+json' || type === 'application/json') {
    const parsed = reportingSchema.safeParse(json);
    if (parsed.success) {
      return parsed.data
        .filter((r) => r.type === 'csp-violation')
        .slice(0, MAX_REPORTS)
        .map((r) => ({
          directive: directiveName(r.body?.effectiveDirective),
          blocked: reduceBlocked(r.body?.blockedURL),
          path: documentPath(r.body?.documentURL ?? r.url),
        }));
    }
  }
  return null;
}
