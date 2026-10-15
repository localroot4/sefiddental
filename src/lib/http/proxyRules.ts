import type { PathKind } from '@/lib/http/classify';

/*
 * Path rules of the proxy. Every `pathname` argument is the routed form, normalizePath() output
 * (freeze A1): Payload matches its endpoint and admin view paths case-insensitively and reaches
 * them with a trailing slash or a percent-encoded letter, so raw comparisons can be bypassed.
 */

/** Payload's first-user screen and endpoint: closed for every method unless ALLOW_FIRST_USER. */
const FIRST_USER_PATHS = new Set(['/admin/create-first-user', '/api/users/first-register']);

/**
 * Payload's e-mail verification endpoint. Verification is off, so every call is a 500 with an
 * ERROR line and a stack that anyone can repeat (SEC-S4): closed like the first-user paths.
 */
const VERIFY_EMAIL_PATH = '/api/users/verify';

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

/**
 * The site's own anonymous API routes and its scheduler. The proxy cannot check a Payload
 * session cookie's value, so in maintenance mode the cookie never opens these (SF-2); the cron
 * route checks its own bearer but pauses with the site.
 */
const SITE_API_PATHS = new Set([
  '/api/events',
  '/api/form-session',
  '/api/csp-report',
  '/api/booking',
  '/api/emergency',
  '/api/cron/tick',
]);

/** Pages that get the form session cookie from the proxy (spec-utils 7.8, phase 5 forms). */
const FORM_SESSION_PAGES = new Set(['/رزرو-نوبت', '/اورژانس']);

/**
 * True when the request passes in maintenance mode: the health check, the admin pages, signed-in
 * Payload API calls (session cookie present; never the site's own routes), the sign-in endpoints, and internal routes (the
 * proxy passes kind 'internal' before the maintenance step; listed here for completeness).
 */
export function maintenanceBypass(
  kind: PathKind,
  pathname: string,
  hasPayloadToken: boolean,
): boolean {
  if (kind === 'internal' || kind === 'admin') return true;
  if (pathname === '/api/health') return true;
  if (kind === 'api') {
    return (
      MAINTENANCE_SIGN_IN_PATHS.has(pathname) || (hasPayloadToken && !SITE_API_PATHS.has(pathname))
    );
  }
  return false;
}

export function isFirstUserPath(pathname: string): boolean {
  return FIRST_USER_PATHS.has(pathname);
}

/** Payload endpoints the site does not use: 404 for every method and every suffix. */
export function isClosedPayloadPath(pathname: string): boolean {
  return pathname === VERIFY_EMAIL_PATH || pathname.startsWith(`${VERIFY_EMAIL_PATH}/`);
}

export function isAuthLimitedPath(method: string, pathname: string): boolean {
  return method.toUpperCase() === 'POST' && AUTH_LIMITED_PATHS.has(pathname);
}

/** GET or HEAD of a page that renders a form with server tokens (no-JS path). */
export function needsFormSession(method: string, pathname: string): boolean {
  const m = method.toUpperCase();
  return (m === 'GET' || m === 'HEAD') && FORM_SESSION_PAGES.has(pathname);
}

/*
 * Persian dynamic routes. Next 16.4 matches dynamic routes against the percent-encoded request
 * path with a regex built from the raw folder name (router-utils/filesystem.js
 * buildFilesystemDynamicRoute, resolve-routes.js checkTrue), so `[slug]` under a Persian folder
 * never matches in a production build. Static Persian folders work (getItem decodes the path).
 * Each Persian dynamic route therefore renders from `src/app/(site)/r/<folder>/[slug]/page.tsx`,
 * and the proxy rewrites the public path to it. One row per dynamic route of docs/ia.md (prefixes
 * as src/lib/paths.ts builds them; a test ties the two). A public path with one segment after a
 * prefix always rewrites, so no static Persian folder may sit beside these `[slug]` routes. A slug
 * outside the published set of its row (from proxy-config) rewrites to `/r` instead, because a
 * page's notFound() gets Next 16.4's `__next_error__` shell (no lang, dir or body until hydration).
 */
const INTERNAL_ROUTES = '/r';
const PERSIAN_DYNAMIC_ROUTES = [
  ['/خدمات/', 'services'], // services and service categories
  ['/پزشکان/', 'doctors'],
  ['/مقالات/دسته/', 'article-categories'],
  ['/مقالات/برچسب/', 'tags'],
  ['/مقالات/', 'articles'],
  ['/راهنمای-بیمار/', 'guides'],
] as const;

/** A row of the table: the folder name under `/r/`, also the key of its slug set in proxy-config. */
export type DynamicRouteKey = (typeof PERSIAN_DYNAMIC_ROUTES)[number][1];

/** The row and slug of a public path with exactly one segment after a table prefix, else null. */
export function dynamicRoute(pathname: string): { key: DynamicRouteKey; slug: string } | null {
  for (const [prefix, key] of PERSIAN_DYNAMIC_ROUTES) {
    const slug = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : '';
    if (slug !== '' && !slug.includes('/')) return { key, slug };
  }
  return null;
}

/**
 * The path Next renders instead of `pathname` (normalizePath() output): the ASCII folder of a
 * Persian dynamic route, or `/r` for an unknown slug (`unknownSlug`, decided by the proxy), for a
 * direct request into those folders and for `/qa/*` while QA_ROUTES is off (no page there, so
 * global-not-found answers with full server HTML). Null when the path renders as it is.
 */
export function routeRewrite(
  pathname: string,
  qaRoutes = false,
  unknownSlug = false,
): string | null {
  if (pathname.startsWith(`${INTERNAL_ROUTES}/`)) return INTERNAL_ROUTES;
  if (!qaRoutes && pathname.startsWith('/qa/')) return INTERNAL_ROUTES;
  const route = dynamicRoute(pathname);
  if (route === null) return null;
  return unknownSlug
    ? INTERNAL_ROUTES
    : `${INTERNAL_ROUTES}/${route.key}/${encodeURIComponent(route.slug)}`;
}
