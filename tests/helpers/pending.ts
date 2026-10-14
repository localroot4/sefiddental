// Tests for routes another lane is still building. The test skips while the route is missing from
// the source tree and runs by itself once it lands. The check reads the source, never the HTTP
// status: a route whose file exists but answers 404 still fails its test.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { test } from '@playwright/test';

/**
 * Where each route lives (freeze sections 6 and 8). An admin view exists only once it is
 * registered in the Payload config, so its marker is the component path in that file.
 */
const ROUTES = {
  health: { file: 'src/app/(site)/api/health/route.ts' },
  events: { file: 'src/app/(site)/api/events/route.ts' },
  cron: { file: 'src/app/(site)/api/cron/tick/route.ts' },
  proxyConfig: { file: 'src/app/(site)/api/internal/proxy-config/route.ts' },
  sitemapIndex: { file: 'src/app/sitemap.xml/route.ts' },
  rss: { file: 'src/app/rss.xml/route.ts' },
  serviceProbe: { file: 'src/app/(site)/r/services/[slug]/page.tsx' },
  statusView: {
    file: 'src/payload.config.ts',
    contains: '/admin/views/SystemStatus#SystemStatusView',
  },
} satisfies Record<string, { file: string; contains?: string }>;

export type PendingRoute = keyof typeof ROUTES;

function describeRoute(route: PendingRoute): string {
  const entry: { file: string; contains?: string } = ROUTES[route];
  return entry.contains ? `${entry.contains} in ${entry.file}` : entry.file;
}

/** True when the route's file exists (and holds its marker, for admin views). */
export function routeExists(route: PendingRoute): boolean {
  const entry: { file: string; contains?: string } = ROUTES[route];
  const file = path.resolve(process.cwd(), entry.file);
  if (!existsSync(file)) return false;
  return entry.contains === undefined || readFileSync(file, 'utf8').includes(entry.contains);
}

/** Skips the calling test (or describe block) until every named route exists. */
export function requireRoutes(...routes: PendingRoute[]): void {
  const missing = routes.filter((route) => !routeExists(route));
  test.skip(
    missing.length > 0,
    `PENDING Lane P or integrator: ${missing.map(describeRoute).join(', ')} does not exist yet.`,
  );
}
