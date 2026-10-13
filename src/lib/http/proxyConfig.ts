import { z } from 'zod';

import type { ServerEnv } from '@/lib/env';
import type { RedirectRow, RedirectStatus } from '@/lib/data/redirects';
import { accessLine } from '@/lib/log/accessLine';

export interface ProxyConfigView {
  redirects: Map<string, { from: string; to: string | null; status: RedirectStatus }>;
  ga4MeasurementId: string | null;
}

export const PROXY_CONFIG_PATH = '/api/internal/proxy-config';
export const REDIRECT_HIT_PATH = '/api/internal/redirect-hit';
const FETCH_TIMEOUT_MS = 1500;
const WARN_EVERY_MS = 60_000;
/** After a failed fetch, requests use the stale (or empty) view for this long before retrying. */
const RETRY_AFTER_FAILURE_MS = 5_000;

const bodySchema = z.object({
  v: z.literal(1),
  generatedAt: z.string(),
  redirects: z.array(
    z.tuple([
      z.string().startsWith('/'),
      z.string().nullable(),
      z.union([z.literal(301), z.literal(302), z.literal(308), z.literal(410)]),
    ]),
  ),
  ga4MeasurementId: z.string().nullable(),
});

const empty = (): ProxyConfigView => ({ redirects: new Map(), ga4MeasurementId: null });

function toView(rows: readonly RedirectRow[], ga4MeasurementId: string | null): ProxyConfigView {
  const redirects: ProxyConfigView['redirects'] = new Map();
  for (const [from, to, status] of rows) redirects.set(from, { from, to, status });
  return { redirects, ga4MeasurementId };
}

interface MemoState {
  value: ProxyConfigView | null;
  freshUntil: number;
  inflight: Promise<ProxyConfigView> | null;
  lastWarnAt: number;
}

const state: MemoState = {
  value: null,
  freshUntil: -Infinity,
  inflight: null,
  lastWarnAt: -Infinity,
};

/** Test hook: forget the memo between cases. */
export function resetProxyConfigMemo(): void {
  state.value = null;
  state.freshUntil = -Infinity;
  state.inflight = null;
  state.lastWarnAt = -Infinity;
}

async function fetchView(env: ServerEnv): Promise<ProxyConfigView> {
  const res = await fetch(new URL(PROXY_CONFIG_PATH, env.internalOrigin), {
    headers: { 'x-internal-token': env.internalApiToken },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`proxy-config answered ${res.status}`);
  const body = bodySchema.parse(await res.json());
  return toView(body.redirects, body.ga4MeasurementId);
}

/**
 * Redirect rows and the GA4 id, read from the internal route and memoized in this module for
 * `env.proxyConfigTtlMs` (spec 6.4, decision D-P4). One fetch at a time (single flight). Never
 * throws: on failure the stale view (or an empty one) answers, with one `warn` line per minute.
 */
export function getProxyConfig(
  env: ServerEnv,
  nowMs: number = Date.now(),
): Promise<ProxyConfigView> {
  if (state.value !== null && nowMs < state.freshUntil) return Promise.resolve(state.value);
  if (state.value === null && nowMs < state.freshUntil) return Promise.resolve(empty());
  if (state.inflight) return state.inflight;

  const flight = fetchView(env)
    .then((view) => {
      state.value = view;
      state.freshUntil = nowMs + env.proxyConfigTtlMs;
      return view;
    })
    .catch((error: unknown) => {
      state.freshUntil = nowMs + Math.min(env.proxyConfigTtlMs, RETRY_AFTER_FAILURE_MS);
      if (nowMs - state.lastWarnAt >= WARN_EVERY_MS) {
        state.lastWarnAt = nowMs;
        accessLine({
          level: 'warn',
          msg: 'proxy_config_unavailable',
          reqId: '-',
          reason: error instanceof Error ? error.message : String(error),
        });
      }
      return state.value ?? empty();
    })
    .finally(() => {
      state.inflight = null;
    });
  state.inflight = flight;
  return flight;
}

/**
 * Absolute redirect target on SITE_URL's origin. Keeps the row's own query and fragment and adds
 * only the request's `utm_*` keys (bookings store them; other keys are dropped). A target that
 * would leave the site (`//host`, `/\host`, an absolute URL) falls back to the home page.
 */
export function destination(hit: { to: string | null }, url: URL, env: ServerEnv): URL {
  const site = new URL(env.siteUrl);
  let target = new URL(hit.to ?? '/', site);
  if (target.origin !== site.origin) target = new URL('/', site);
  for (const [key, value] of url.searchParams) {
    if (key.startsWith('utm_')) target.searchParams.append(key, value);
  }
  return target;
}

/**
 * Counts one redirect hit through the internal route (spec 10.3), for `event.waitUntil` in the
 * proxy: the proxy cannot import Payload. Never throws; a lost hit only lowers a counter.
 */
export async function recordRedirectHit(env: ServerEnv, from: string): Promise<void> {
  try {
    const res = await fetch(new URL(REDIRECT_HIT_PATH, env.internalOrigin), {
      method: 'POST',
      headers: { 'x-internal-token': env.internalApiToken, 'content-type': 'application/json' },
      body: JSON.stringify({ from }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`redirect-hit answered ${res.status}`);
  } catch (error) {
    accessLine({
      level: 'debug',
      msg: 'redirect_hit_lost',
      reqId: '-',
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
