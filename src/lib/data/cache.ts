import { unstable_cache } from 'next/cache';

/**
 * Every reader goes through this: one cache entry per reader and arguments, tagged so the
 * Payload hooks can revalidate it (freeze 3.10, section 5). Never reads headers() or cookies().
 * `unstable_cache` is the legacy API while `cacheComponents` stays off (freeze decision 17).
 */
export function cachedRead<T>(
  name: string,
  args: unknown,
  tags: string[],
  load: () => Promise<T>,
): Promise<T> {
  return unstable_cache(load, [name, JSON.stringify(args ?? null)], { tags })();
}
