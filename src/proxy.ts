import { NextResponse, type NextRequest } from 'next/server';

import { readEnv } from './lib/env';

/**
 * Request pipeline skeleton (wave 0). Integration B composes the full pipeline from the
 * platform modules: maintenance, auth rate limits, redirects, canonical redirects, CSP and
 * security headers. Imports stay dependency-free: no Payload, node:fs or next/headers.
 */

const TRUSTED_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

// Headers only the proxy may set; a client-supplied copy is dropped.
const PROXY_OWNED_HEADERS = ['x-nonce', 'x-pathname', 'x-request-id'];

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

/**
 * The path as Next and Payload route it: percent-decoded, single slashes, no trailing slash,
 * ASCII lowercase (Payload matches endpoint and admin view paths case-insensitively). Rules
 * that block or limit a route compare this form, never the raw pathname. Lane P replaces it
 * with normalizePath() from src/lib/paths.ts.
 */
function routePath(pathname: string): string {
  const decoded = pathname.replace(/(?:%[0-9A-Fa-f]{2})+/g, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run; // not valid UTF-8: keep the escapes
    }
  });
  const single = decoded.replace(/\/{2,}/g, '/');
  const trimmed = single.length > 1 ? single.replace(/\/+$/, '') : single;
  return trimmed.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

// Every method: the page and the endpoint stay closed until ALLOW_FIRST_USER=true.
function isFirstUserPath(pathname: string): boolean {
  const path = routePath(pathname);
  return path === '/admin/create-first-user' || path === '/api/users/first-register';
}

export function proxy(request: NextRequest) {
  const env = readEnv();
  const { pathname } = request.nextUrl;

  const incomingId = request.headers.get('x-request-id');
  const requestId =
    env.trustProxyHeaders && incomingId && TRUSTED_REQUEST_ID.test(incomingId)
      ? incomingId
      : crypto.randomUUID();

  if (!env.allowFirstUser && isFirstUserPath(pathname)) {
    return new NextResponse('Not Found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-request-id': requestId },
    });
  }

  const requestHeaders = new Headers(request.headers);
  for (const name of PROXY_OWNED_HEADERS) requestHeaders.delete(name);
  requestHeaders.set('x-request-id', requestId);

  // payload-totp reads the current admin path from x-pathname in a server component.
  const admin = isAdminPath(pathname);
  if (admin) requestHeaders.set('x-pathname', pathname);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-request-id', requestId);
  if (admin) response.headers.set('x-pathname', pathname);
  return response;
}

// Every path except build assets, public static files and media files: uploads stream to
// Payload without the proxy's 10 MB request-body buffer.
export const config = {
  matcher: ['/((?!_next/static|_next/image|api/media|brand/|fonts/|detect-gpu/|favicon\\.ico).*)'],
};
