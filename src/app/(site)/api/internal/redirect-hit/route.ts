import { z } from 'zod';

import { recordRedirectHit } from '@/lib/data/redirects';
import { readEnv } from '@/lib/env';
import { isInternalCaller } from '@/lib/http/auth';
import { parseJson, readTextCapped } from '@/lib/http/body';

const headers = { 'Cache-Control': 'no-store' };
const bodySchema = z.object({ from: z.string().startsWith('/').max(2048) });

// Spec 10.3: the proxy counts one hit per redirected GET or HEAD (one SQL update, no versions).
export async function POST(request: Request): Promise<Response> {
  if (!isInternalCaller(request.headers, readEnv().internalApiToken)) {
    return new Response('Not Found', { status: 404, headers });
  }
  const parsed = bodySchema.safeParse(parseJson(await readTextCapped(request, 4096)));
  if (!parsed.success) return new Response(null, { status: 400, headers });
  await recordRedirectHit(parsed.data.from);
  return new Response(null, { status: 204, headers });
}
