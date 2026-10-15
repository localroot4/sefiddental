import { z } from 'zod';

import type { ServerEnv } from '@/lib/env';
import type { RedirectStatus } from '@/lib/data/redirects';
import type { DynamicRouteKey } from '@/lib/http/proxyRules';
import { accessLine } from '@/lib/log/accessLine';

export interface ProxyConfigView {
  redirects: Map<string, { from: string; to: string | null; status: RedirectStatus }>;
  ga4MeasurementId: string | null;
  /** Published slugs per dynamic route (normalizePath form); null when unknown or stale. */
  slugs: Map<string, Set<string>> | null;
  /** When the fetch behind this view started (the caller's clock). */
  fetchedAt: number;
}

export const PROXY_CONFIG_PATH = '/api/internal/proxy-config';
export const REDIRECT_HIT_PATH = '/api/internal/redirect-hit';
const FETCH_TIMEOUT_MS = 1500;
const WARN_EVERY_MS = 60_000;
/** After a failed fetch, requests use the stale (or empty) view for this long before retrying. */
const RETRY_AFTER_FAILURE_MS = 5_000;
/** At most one refresh per this window confirms an unknown slug; misses inside it fall through. */
const MISS_REFRESH_MS = 2_000;

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
  // Optional: without it every slug reaches its page (the view's slugs stay unknown).
  slugs: z.record(z.string(), z.array(z.string())).optional(),
});

const empty = (): ProxyConfigView => ({
  redirects: new Map(),
  ga4MeasurementId: null,
  slugs: null,
  fetchedAt: -Infinity,
});

function toView(body: z.infer<typeof bodySchema>, fetchedAt: number): ProxyConfigView {
  const redirects: ProxyConfigView['redirects'] = new Map();
  for (const [from, to, status] of body.redirects) redirects.set(from, { from, to, status });
  const slugs = body.slugs
    ? new Map(Object.entries(body.slugs).map(([key, list]) => [key, new Set(list)]))
    : null;
  return { redirects, ga4MeasurementId: body.ga4MeasurementId, slugs, fetchedAt };
}

interface MemoState {
  value: ProxyConfigView | null;
  freshUntil: number;
  inflight: Promise<ProxyConfigView> | null;
  lastWarnAt: number;
  /** Start of the latest fetch, shared or not: the floor of the unknown-slug refresh. */
  lastStartAt: number;
}

const state: MemoState = {
  value: null,
  freshUntil: -Infinity,
  inflight: null,
  lastWarnAt: -Infinity,
  lastStartAt: -Infinity,
};

/** Test hook: forget the memo between cases. */
export function resetProxyConfigMemo(): void {
  state.value = null;
  state.freshUntil = -Infinity;
  state.inflight = null;
  state.lastWarnAt = -Infinity;
  state.lastStartAt = -Infinity;
}

async function fetchView(env: ServerEnv, nowMs: number): Promise<ProxyConfigView> {
  const res = await fetch(new URL(PROXY_CONFIG_PATH, env.internalOrigin), {
    headers: { 'x-internal-token': env.internalApiToken },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`proxy-config answered ${res.status}`);
  return toView(bodySchema.parse(await res.json()), nowMs);
}

/** One fetch into the memo. A failure keeps the stale redirects but forgets the slugs. */
function startFetch(env: ServerEnv, nowMs: number): Promise<ProxyConfigView> {
  state.lastStartAt = Math.max(state.lastStartAt, nowMs);
  return fetchView(env, nowMs)
    .then((view) => {
      // A slower, older fetch never replaces a newer view.
      if (view.fetchedAt >= (state.value?.fetchedAt ?? -Infinity)) {
        state.value = view;
        state.freshUntil = nowMs + env.proxyConfigTtlMs;
      }
      return view;
    })
    .catch((error: unknown) => {
      state.freshUntil = nowMs + Math.min(env.proxyConfigTtlMs, RETRY_AFTER_FAILURE_MS);
      if (state.value) state.value = { ...state.value, slugs: null };
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
    });
}

/**
 * Redirect rows, the GA4 id and the published slugs, read from the internal route and memoized in
 * this module for `env.proxyConfigTtlMs` (spec 6.4, decision D-P4). One fetch at a time (single
 * flight). Never throws: on failure the stale redirects (or an empty view) answer with unknown
 * slugs, with one `warn` line per minute.
 */
export function getProxyConfig(
  env: ServerEnv,
  nowMs: number = Date.now(),
): Promise<ProxyConfigView> {
  if (state.value !== null && nowMs < state.freshUntil) return Promise.resolve(state.value);
  if (state.value === null && nowMs < state.freshUntil) return Promise.resolve(empty());
  if (state.inflight) return state.inflight;

  const flight = startFetch(env, nowMs).finally(() => {
    if (state.inflight === flight) state.inflight = null;
  });
  state.inflight = flight;
  return flight;
}

const misses = (view: ProxyConfigView, route: { key: DynamicRouteKey; slug: string }): boolean => {
  const published = view.slugs?.get(route.key);
  return published !== undefined && published.size > 0 && !published.has(route.slug);
};

/**
 * True when `route.slug` is not published under its row, so the proxy answers the 404 document
 * (decision F10). `view` is what getProxyConfig gave this request at `nowMs`. Only a view fetched
 * for this request may refuse a slug: an older one is first refreshed by a fetch of this request's
 * own (at most one per MISS_REFRESH_MS, or per TTL when shorter), so a slug published since the
 * last fetch reaches its page. Unknown or empty sets, a failed refresh and misses inside the floor
 * fall through to the page, never a 404 for every slug.
 */
export async function isUnknownSlug(
  env: ServerEnv,
  view: ProxyConfigView,
  route: { key: DynamicRouteKey; slug: string },
  nowMs: number,
): Promise<boolean> {
  if (!misses(view, route)) return false;
  if (view.fetchedAt >= nowMs) return true;
  if (nowMs - state.lastStartAt < Math.min(MISS_REFRESH_MS, env.proxyConfigTtlMs)) return false;
  // Not the shared flight: one that started before this request may predate the publish.
  return misses(await startFetch(env, nowMs), route);
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
