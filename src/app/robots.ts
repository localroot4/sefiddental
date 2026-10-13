import type { MetadataRoute } from 'next';

import { readEnv } from '@/lib/env';
import { robotsTxt } from '@/lib/seo/robots';

// Read at request time (critic W1): a cached robots.txt would freeze ALLOW_INDEXING at build.
export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return robotsTxt(readEnv());
}
