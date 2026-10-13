import { describe, expect, it } from 'vitest';

import { classifyPath } from '@/lib/http/classify';

describe('classifyPath', () => {
  it.each([
    ['/', 'page'],
    ['/خدمات/لمینت-سرامیکی', 'page'],
    ['/old.php', 'page'],
    ['/admin', 'admin'],
    ['/admin/collections/users', 'admin'],
    ['/administrator', 'page'],
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
    expect(classifyPath('/Admin/')).toBe('admin');
    expect(classifyPath('/%61dmin/login')).toBe('admin');
    expect(classifyPath('//api//users/login/')).toBe('api');
    expect(classifyPath('/API/Internal/proxy-config')).toBe('internal');
    expect(classifyPath('/Sitemaps/Pages.xml')).toBe('feed');
  });
});
