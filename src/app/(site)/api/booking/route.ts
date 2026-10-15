import { bookingDeps } from '@/lib/booking/deps';
import { createBookingHandler } from '@/lib/booking/handler';

// Reads cookies and the body on every request; every answer says no-store.
export const dynamic = 'force-dynamic';

const handler = createBookingHandler(bookingDeps);

/** POST /api/booking; the proxy also rewrites a POST of /رزرو-نوبت here (freeze G2). */
export async function POST(request: Request): Promise<Response> {
  return handler(request);
}
