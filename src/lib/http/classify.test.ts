import { describe, expect, it } from 'vitest';

import { classifyPath } from '@/lib/http/classify';
import { ADMIN_ROUTE } from '@/lib/paths';

/** The admin route with its first letter percent-encoded, e.g. `/%61dmin` for `/admin`. */
const encodedAdmin = `/%${ADMIN_ROUTE.charCodeAt(1).toString(16)}${ADMIN_ROUTE.slice(2)}`;

describe('classifyPath', () => {
  it.each([
    ['/', 'page'],
    ['/خدمات/لمینت-سرامیکی', 'page'],
    ['/old.php', 'page'],
    [ADMIN_ROUTE, 'admin'],
    [`${ADMIN_ROUTE}/collections/users`, 'admin'],
    [`${ADMIN_ROUTE}x`, 'page'],
    // The old mount point is an ordinary unknown page now.
    ['/admin', 'page'],
    ['/admin/login', 'page'],
    ['/api/health', 'api'],
    ['/api', 'api'],
    ['/apis', 'page'],
    ['/api/internal/proxy-config', 'internal'],
    ['/api/internal', 'internal'],
    ['/api/internalx', 'api'],
    ['/sitemap.xml', 'feed'],
    ['/sitemaps/services.xml', 'feed'],
    ['/rss.xml', 'feed'],
    ['/robots.txt', 'feed'],
  ] as const)('C1 %s is %s', (path, kind) => {
    expect(classifyPath(path)).toBe(kind);
  });

  it('C2 classifies the routed form: case, encoding, slashes (freeze A1)', () => {
    expect(classifyPath(`${ADMIN_ROUTE.toUpperCase()}/`)).toBe('admin');
    expect(classifyPath(`${encodedAdmin}/login`)).toBe('admin');
    expect(classifyPath('/%61dmin/login')).toBe('page');
    expect(classifyPath('//api//users/login/')).toBe('api');
    expect(classifyPath('/API/Internal/proxy-config')).toBe('internal');
    expect(classifyPath('/Sitemaps/Pages.xml')).toBe('feed');
  });
});
