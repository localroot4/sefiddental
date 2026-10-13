/**
 * Local stub of the types in `src/lib/data/redirects.ts` (Lane D, freeze 3.10), same shapes, so
 * proxyConfig.ts type-checks before Lane D merges. At merge: delete this file and change the
 * `import type` in proxyConfig.ts to '@/lib/data/redirects'.
 */
export type RedirectStatus = 301 | 302 | 308 | 410;
export type RedirectRow = readonly [from: string, to: string | null, status: RedirectStatus];
