// Fails when `next build` prerendered HTML (freeze decision 1): every public HTML response must
// render per request, so it carries the CSP nonce of that request. A prerendered page has no
// nonce, and the CSP then blocks its scripts. Run after `npm run build`:
//   node scripts/check-no-prerender.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Next's own documents that are allowed to stay static, each with the reason. */
export const ALLOWED = new Map([
  [
    '/_global-error',
    'Next 16 always prerenders its global-error document. It renders only when a root layout ' +
      'itself throws and carries no data; under the nonce CSP its scripts stay blocked, so ' +
      'its retry button does not work (static text only).',
  ],
]);

/**
 * `/_not-found` is Next's default not-found document (freeze amendment A6). It is allowed only
 * while the (site) catch-all `/[...notFound]` exists: that dynamic route answers every unknown
 * public path with the branded 404, so Next's static document serves only paths outside the
 * proxy matcher (missing `/_next/static` files), where no CSP applies.
 */
export const NOT_FOUND = '/_not-found';
const SITE_CATCH_ALL = '/(site)/[...notFound]/page';

/** Route of an HTML file under `.next/server/app` (`index.html` is `/`). */
export function routeOfHtml(relativePath) {
  const route = `/${relativePath.split(path.sep).join('/')}`.replace(/\.html$/, '');
  return route === '/index' ? '/' : route.replace(/\/index$/, '');
}

/**
 * @param {{ htmlRoutes: string[], appPaths: string[] }} build
 * @returns {{ route: string, ok: boolean, reason: string }[]}
 */
export function verdicts({ htmlRoutes, appPaths }) {
  const hasCatchAll = appPaths.includes(SITE_CATCH_ALL);
  return [...new Set(htmlRoutes)].sort().map((route) => {
    const allowed = ALLOWED.get(route);
    if (allowed) return { route, ok: true, reason: allowed };
    if (route === NOT_FOUND) {
      return hasCatchAll
        ? {
            route,
            ok: true,
            reason:
              "Next's default not-found document. The (site) catch-all /[...notFound] renders " +
              'the branded 404 per request; this static copy only answers paths the proxy ' +
              'never sees (missing /_next/static files).',
          }
        : {
            route,
            ok: false,
            reason:
              'The public 404 is a static document: add the (site) catch-all /[...notFound] ' +
              'that renders the branded 404 per request (freeze amendment A6).',
          };
    }
    return {
      route,
      ok: false,
      reason:
        'Prerendered page: make it render per request (it reads headers(), or export ' +
        "dynamic = 'force-dynamic'), never force-static or ISR (freeze decision 1).",
    };
  });
}

function listHtml(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(full, base);
    return entry.name.endsWith('.html') ? [path.relative(base, full)] : [];
  });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const next = path.join(root, '.next');
  const manifest = path.join(next, 'prerender-manifest.json');
  const appPathsFile = path.join(next, 'app-path-routes-manifest.json');
  if (!existsSync(manifest) || !existsSync(appPathsFile)) {
    console.error('check-no-prerender: .next has no build manifests. Run `npm run build` first.');
    process.exit(1);
  }
  const prerendered = Object.keys(readJson(manifest).routes ?? {});
  const htmlFiles = listHtml(path.join(next, 'server', 'app')).map(routeOfHtml);
  const results = verdicts({
    htmlRoutes: htmlFiles,
    appPaths: Object.keys(readJson(appPathsFile)),
  });
  const nonHtml = prerendered.filter((r) => !htmlFiles.includes(r));

  for (const { route, ok, reason } of results) {
    console.log(`${ok ? 'allowed ' : 'FAILED  '} ${route}\n          ${reason}`);
  }
  for (const route of nonHtml) {
    console.log(`note     ${route} is prerendered (not HTML): check that this is intended.`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`check-no-prerender: ${failed.length} prerendered HTML route(s) not allowed.`);
    process.exit(1);
  }
  console.log(`check-no-prerender: no prerendered public HTML (${results.length} allowed).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
