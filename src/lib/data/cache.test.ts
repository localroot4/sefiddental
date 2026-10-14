import { describe, expect, it } from 'vitest';

import nextConfig from '../../../next.config';

describe('cachedRead storage (freeze section 5)', () => {
  it('C1 data-cache entries never reach disk, so a restart or another database reads fresh', () => {
    // Next 16.4 keeps revalidated tags in a per-process Map; a fetch-cache file on disk would
    // serve the old value after a restart (file-system-cache.js returns null when this is false).
    expect(nextConfig.experimental?.isrFlushToDisk).toBe(false);
  });
});
