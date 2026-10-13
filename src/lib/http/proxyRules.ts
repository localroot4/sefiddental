import type { PathKind } from '@/lib/http/classify';

/*
 * Path rules of the proxy. Every `pathname` argument is the routed form, normalizePath() output
 * (freeze A1): Payload matches its endpoint and admin view paths case-insensitively and reaches
 * them with a trailing slash or a percent-encoded letter, so raw comparisons can be bypassed.
 */

/** Payload's first-user screen and endpoint: closed for every method unless ALLOW_FIRST_USER. */
const FIRST_USER_PATHS = new Set(['/admin/create-first-user', '/api/users/first-register']);

/** Credential endpoints behind the auth limiter (decision 41): POST only. */
const AUTH_LIMITED_PATHS = new Set([
  '/api/users/login',
  '/api/users/forgot-password',
  '/api/setup-totp',
  '/api/verify-totp',
]);

/**
 * Endpoints that stay reachable in maintenance mode without a session, so an admin can still
 * sign in (and finish TOTP) while the public site shows the 503 page.
 */
const MAINTENANCE_SIGN_IN_PATHS = new Set(['/api/users/login', '/api/verify-totp']);

/** Pages that get the form session cookie from the proxy (spec-utils 7.8, phase 5 forms). */
const FORM_SESSION_PAGES = new Set(['/رزرو-نوبت', '/اورژانس']);

/**
 * True when the request passes in maintenance mode: the health check, the admin pages, signed-in
 * API calls (Payload session cookie present), the sign-in endpoints, and internal routes (the
 * proxy passes kind 'internal' before the maintenance step; listed here for completeness).
 */
export function maintenanceBypass(
  kind: PathKind,
  pathname: string,
  hasPayloadToken: boolean,
): boolean {
  if (kind === 'internal' || kind === 'admin') return true;
  if (pathname === '/api/health') return true;
  if (kind === 'api') return hasPayloadToken || MAINTENANCE_SIGN_IN_PATHS.has(pathname);
  return false;
}

export function isFirstUserPath(pathname: string): boolean {
  return FIRST_USER_PATHS.has(pathname);
}

export function isAuthLimitedPath(method: string, pathname: string): boolean {
  return method.toUpperCase() === 'POST' && AUTH_LIMITED_PATHS.has(pathname);
}

/** GET or HEAD of a page that renders a form with server tokens (no-JS path). */
export function needsFormSession(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  return (m === 'GET' || m === 'HEAD') && FORM_SESSION_PAGES.has(pathname);
}
