import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import type { ServerEnv } from '@/lib/env';
import {
  csrfFor,
  FORM_COOKIE,
  FORM_COOKIE_OPTIONS,
  isWellFormedSid,
  newSid,
  renewTimeToken,
} from '@/lib/formTokens';
import { hoursState, type ClinicHours, type HoursOptions } from '@/lib/hoursState';

/**
 * GET /api/form-session (spec 7.5): the CSRF token, the signed time token and the hours state
 * for forms on cached or static pages. No token, timestamp or hours sentence ever sits in page
 * HTML; this response is `no-store`. Dependencies are injected so the handler is tested without
 * Payload; route.ts wires the real ones.
 */

/** Structurally the platform `RateLimiter` (src/lib/http/rateLimit.ts). */
export interface FormSessionLimiter {
  hit(key: string, nowMs: number): { ok: true } | { ok: false; retryAfterSec: number };
}

interface FormSessionDeps {
  env: () => Pick<ServerEnv, 'formTokenSecrets' | 'formTokenTtlSeconds'>;
  loadHours: () => Promise<{ hours: ClinicHours; options: HoursOptions }>;
  limiter: FormSessionLimiter;
  /** Rate-limit bucket key of the caller (never the raw address). */
  clientKey: (headers: Headers) => string;
  now: () => number;
}

/** 60 requests per minute per client key (decision D-K6); FORM_SESSION_RATE_LIMIT overrides the 60. */
export const FORM_SESSION_RATE = { limit: 60, windowMs: 60_000 } as const;

// The old time token sent back after a 419; anything else is ignored (a fresh token follows).
const renewSchema = z
  .string()
  .max(64)
  .regex(/^v1\.[0-9a-z]{1,11}\.[A-Za-z0-9_-]{43}$/);

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export function createFormSessionHandler(deps: FormSessionDeps) {
  return async function formSession(request: NextRequest): Promise<NextResponse> {
    const nowMs = deps.now();
    const limit = deps.limiter.hit(deps.clientKey(request.headers), nowMs);
    if (!limit.ok) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { ...NO_STORE, 'Retry-After': String(limit.retryAfterSec) } },
      );
    }

    const env = deps.env();
    const [current] = env.formTokenSecrets;
    if (!current) throw new Error('form-session: FORM_TOKEN_SECRET is not configured');

    const { hours, options } = await deps.loadHours();
    const state = hoursState(new Date(nowMs), hours, options);

    // Reuse a well-formed form cookie (refreshing its Max-Age); otherwise start a new one.
    const cookieSid = request.cookies.get(FORM_COOKIE)?.value;
    const sid = isWellFormedSid(cookieSid) ? cookieSid : newSid();
    const renew = renewSchema.safeParse(request.nextUrl.searchParams.get('renew'));
    const ts = renewTimeToken({
      secrets: env.formTokenSecrets,
      sid,
      oldTs: renew.success ? renew.data : undefined,
      nowMs,
      ttlMs: env.formTokenTtlSeconds * 1000,
    });

    const response = NextResponse.json(
      {
        csrf: csrfFor(current, sid),
        ts,
        ttlSeconds: env.formTokenTtlSeconds,
        hours: {
          state: state.state,
          callsAllowed: state.callsAllowed,
          showClosedSheet: state.showClosedSheet,
          nextChangeAt: state.nextChangeAt,
          copy: state.copy,
        },
      },
      { headers: NO_STORE },
    );
    response.cookies.set(FORM_COOKIE, sid, FORM_COOKIE_OPTIONS);
    return response;
  };
}
