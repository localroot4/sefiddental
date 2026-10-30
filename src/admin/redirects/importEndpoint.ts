import { createHash } from 'node:crypto';

import { type PayloadHandler, type PayloadRequest, ValidationError } from 'payload';
import { totpAccess } from 'payload-totp';

import { hasRole } from '@/access/roles';
import { redirectsText } from '@/i18n/fa-redirects';
import type { getPublishedSlugs } from '@/lib/data/slugs';
import { readEnv } from '@/lib/env';
import { readTextCapped } from '@/lib/http/body';
import { dynamicRoute } from '@/lib/http/proxyRules';
import { log } from '@/lib/log/logger';
import { isGuideKey, PAGE_KEYS, PAGE_PATHS } from '@/lib/paths';
import { formatNumberFa } from '@/lib/persianText';
import {
  type ExistingRedirect,
  type ImportPlan,
  parseOrigins,
  planImport,
} from '@/lib/redirects/importCsv';

// Custom endpoints are not wrapped by payload-totp: the check is explicit (as the CSV export).
const verifiedAdmin = totpAccess(({ req }: { req: PayloadRequest }) => hasRole(req.user, 'admin'));

const MAX_BODY_MB = 4;

const json = (body: object, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message: string, status: number) => json({ message }, status);

/** Paths a visitor reaches now: static pages and hubs, and published dynamic slugs (as the proxy). */
function livePaths(slugs: Awaited<ReturnType<typeof getPublishedSlugs>>) {
  // Guide paths come from their (editable) slugs, not from PAGE_PATHS.
  const statics = new Set(PAGE_KEYS.filter((key) => !isGuideKey(key)).map((k) => PAGE_PATHS[k]));
  return (path: string) => {
    if (statics.has(path)) return true;
    const route = dynamicRoute(path);
    return route !== null && slugs[route.key].includes(route.slug);
  };
}

async function plan(req: PayloadRequest, csv: string, origins: string): Promise<ImportPlan> {
  // Loaded on use: both readers import the Payload config, which imports this file.
  const [{ getPublishedSlugs }, { REDIRECTS_SNAPSHOT_MAX }] = await Promise.all([
    import('@/lib/data/slugs'),
    import('@/lib/data/redirects'),
  ]);
  const { docs } = await req.payload.find({
    collection: 'redirects',
    depth: 0,
    pagination: false,
    select: { from: true, to: true, statusCode: true, source: true, active: true },
    req,
  });
  const existing = new Map<string, ExistingRedirect>(
    docs.map((d) => [
      d.from,
      {
        id: d.id,
        to: d.to ?? null,
        statusCode: d.statusCode,
        source: d.source,
        active: !!d.active,
      },
    ]),
  );
  return planImport(csv, {
    // This site's own host counts too: the old site may have lived on the same domain.
    origins: [...parseOrigins(origins), ...parseOrigins(readEnv().siteUrl)],
    existing,
    activeCount: docs.filter((d) => d.active).length,
    isLive: livePaths(await getPublishedSlugs()),
    cap: REDIRECTS_SNAPSHOT_MAX,
  });
}

const digestOf = (value: ImportPlan) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

/**
 * POST /api/redirects/import {csv, origins, apply?, digest?} (H19, plan section 6): the dry run
 * answers the plan and its digest and writes nothing; apply re-plans and writes only when the
 * digest is still the same, so what is written is what the admin saw. Rows go through the
 * collection's hooks (normalize, flatten, repoint, audit), one at a time: SQLite has no
 * transactions here, so a failure stops the run, says where, and a rerun skips what was written.
 */
export const importRedirectsCsv: PayloadHandler = async (req) => {
  if ((await verifiedAdmin({ req })) !== true) {
    return fail(redirectsText('redirects.import.forbidden'), 403);
  }
  // JSON only: a cross-site form cannot send it without a preflight (with SameSite cookies).
  if (!req.headers.get('content-type')?.startsWith('application/json')) {
    return fail(redirectsText('redirects.import.badRequest'), 400);
  }
  // Bytes, not UTF-16 units (a Persian file is about two bytes a letter). An HTTP request is
  // refused on its declared size, else read only up to the limit (a chunked body stops there);
  // a Local API caller without a body stream passes text().
  const max = MAX_BODY_MB * 1024 * 1024;
  const declared = Number(req.headers.get('content-length') ?? 0);
  const raw = req.body
    ? await readTextCapped(req as unknown as Request, max)
    : declared <= max
      ? ((await req.text?.()) ?? '')
      : null;
  // The stream path stops at the limit itself; text() is measured once read.
  if (raw === null || (!req.body && Buffer.byteLength(raw) > max)) {
    return fail(
      redirectsText('redirects.import.tooLarge', { max: formatNumberFa(MAX_BODY_MB) }),
      413,
    );
  }
  let body: { csv?: unknown; origins?: unknown; apply?: unknown; digest?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return fail(redirectsText('redirects.import.badRequest'), 400);
  }
  if (typeof body?.csv !== 'string') return fail(redirectsText('redirects.import.badRequest'), 400);

  const result = await plan(req, body.csv, typeof body.origins === 'string' ? body.origins : '');
  const digest = digestOf(result);
  if (body.apply !== true) return json({ ...result, digest });
  if (result.error) return fail(result.error, 400);
  if (body.digest !== digest) return fail(redirectsText('redirects.import.changed'), 409);

  let written = 0;
  for (const row of result.rows) {
    if (row.outcome !== 'new' && row.outcome !== 'update') continue;
    const data = {
      from: row.from,
      to: row.to,
      statusCode: row.status as '301' | '410',
      source: 'import' as const,
      active: true,
    };
    const as = { depth: 0, overrideAccess: false, user: req.user, req };
    try {
      if (row.id === undefined) await req.payload.create({ collection: 'redirects', data, ...as });
      else await req.payload.update({ collection: 'redirects', id: row.id, data, ...as });
    } catch (error) {
      log.error({ msg: 'redirect_import_row_failed', line: row.line, written, err: error });
      const reason =
        error instanceof ValidationError ? error.data.errors.map((e) => e.message).join(' ') : '';
      const message = redirectsText('redirects.import.failed', {
        line: formatNumberFa(row.line),
        reason,
        n: formatNumberFa(written),
      });
      return fail(message.replace(/ {2,}/g, ' '), 500);
    }
    written += 1;
  }
  log.info({ msg: 'redirect_import_applied', written, rows: result.rows.length });
  return json({ ...result, digest, written });
};
