import { getFeatures } from '@/lib/data/globals';
import { getRedirectsSnapshot } from '@/lib/data/redirects';
import { readEnv } from '@/lib/env';
import { isInternalCaller } from '@/lib/http/auth';

const headers = { 'Cache-Control': 'no-store' };

// Spec 10.2: what the proxy needs per request, read through the tagged readers. Only the proxy
// knows the token; everyone else gets the same 404 as an unknown path.
export async function GET(request: Request): Promise<Response> {
  if (!isInternalCaller(request.headers, readEnv().internalApiToken)) {
    return new Response('Not Found', { status: 404, headers });
  }
  const [snapshot, features] = await Promise.all([getRedirectsSnapshot(), getFeatures()]);
  return Response.json(
    {
      v: 1,
      generatedAt: snapshot.generatedAt,
      redirects: snapshot.rows,
      ga4MeasurementId: (features.ga4Enabled && features.ga4MeasurementId) || null,
    },
    { headers },
  );
}
