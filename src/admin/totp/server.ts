import { createHmac } from 'node:crypto';

import { Secret } from 'otpauth';
import type { Endpoint, PayloadHandler } from 'payload';

import { normalizeCode } from './code';

interface SessionUser {
  collection: string;
  id: number | string;
  /** Payload's session ID (auth.useSessions), on users the JWT strategy authenticated. */
  _sid?: unknown;
  /** Changes with every write to the user, enrollment and removal of TOTP included. */
  updatedAt?: unknown;
}

/**
 * The secret the setup page offers until enrollment succeeds: HMAC-SHA256 under the Payload
 * secret of the user, their sign-in session and the user's updatedAt. A reload, a second tab
 * or a token refresh (Payload keeps updatedAt on session writes) shows the same one; a new
 * sign-in, an enrollment or a removal of TOTP gives a new one. Nothing is stored: the setup
 * endpoint derives it again. Undefined without a session ID or updatedAt.
 *
 * Any path that clears totpSecret must change one of these inputs, so that a session that saw
 * the old secret never gets it again: a Payload update changes updatedAt, and a password change
 * (scripts/resetAccount.ts) also ends the sessions. A raw database write that clears the field
 * must end the user's sessions too.
 */
export function pendingTotpSecret(payloadSecret: string, user: SessionUser): string | undefined {
  const { _sid: sid, updatedAt } = user;
  if (typeof sid !== 'string' || !sid || typeof updatedAt !== 'string' || !updatedAt) {
    return undefined;
  }
  const digest = createHmac('sha256', payloadSecret)
    .update(`payload-totp pending secret\0${user.collection}\0${user.id}\0${sid}\0${updatedAt}`)
    .digest();
  return new Secret({ buffer: Uint8Array.from(digest).buffer }).base32;
}

/**
 * Where a code screen sends the user once the code is accepted: `back` from the query string when
 * it is a path inside the admin, else the admin root (no open redirect, no `javascript:`).
 */
export function safeBackPath(adminRoute: string, back: unknown): string {
  const base = 'http://admin.invalid';
  if (typeof back !== 'string' || !back) return adminRoute;
  let url: URL;
  try {
    url = new URL(back, base);
  } catch {
    return adminRoute;
  }
  const inside = url.pathname === adminRoute || url.pathname.startsWith(`${adminRoute}/`);
  return url.origin === base && inside ? `${url.pathname}${url.search}${url.hash}` : adminRoute;
}

/**
 * payload-totp's setup and verify endpoints, with the code's digits normalized first; setup also
 * gets the pending secret in place of any secret the request names, so a client can only enroll
 * the secret the page showed. Other endpoints pass through.
 */
export function withCodeFixes(endpoint: Endpoint): Endpoint {
  const setup = endpoint.path === '/setup-totp';
  if (endpoint.method !== 'post' || (!setup && endpoint.path !== '/verify-totp')) return endpoint;
  const handler: PayloadHandler = async (req) => {
    let data: unknown;
    try {
      data = await req.json?.();
    } catch {
      data = undefined;
    }
    // JSON `null` is an object to the plugin's check, which then reads its token: a 500.
    if (data === null) data = undefined;
    if (typeof data === 'object') {
      const body: Record<string, unknown> = { ...(data as object) };
      if (typeof body.token === 'string') body.token = normalizeCode(body.token);
      if (setup)
        body.secret = req.user ? pendingTotpSecret(req.payload.secret, req.user) : undefined;
      data = body;
    }
    // The plugin reads the body through req.json, which a request can do only once.
    req.json = () => Promise.resolve(data);
    return endpoint.handler(req);
  };
  return { ...endpoint, handler };
}
