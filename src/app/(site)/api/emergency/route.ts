import { emergencyDeps } from '@/lib/booking/deps';
import { createEmergencyHandler } from '@/lib/booking/handler';

// Reads cookies and the body on every request; every answer says no-store.
export const dynamic = 'force-dynamic';

const handler = createEmergencyHandler(emergencyDeps);

/** POST /api/emergency; the proxy also rewrites a POST of /اورژانس here (freeze G2). */
export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
