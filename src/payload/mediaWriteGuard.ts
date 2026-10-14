import config from '@payload-config';
import { getPayload } from 'payload';

import { normalizePath } from '@/lib/paths';

type RouteHandler<C> = (request: Request, context: C) => Promise<Response>;

const FORBIDDEN = 'شما مجاز به انجام این کار نیستید.';

/**
 * Media writes skip the proxy (uploads must not pass its 10 MB body buffer), and Payload parses
 * the whole multipart body to a temp file before it checks access: anyone could stream 64 MB per
 * request to the disk (UP-5). A request without a signed-in user is refused before the body is
 * read. Every other path goes straight to Payload.
 */
export function refuseAnonymousMediaWrites<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (request, context) => {
    const path = normalizePath(new URL(request.url).pathname);
    if (path === '/api/media' || path.startsWith('/api/media/')) {
      const payload = await getPayload({ config });
      const { user } = await payload.auth({ headers: request.headers });
      if (!user) {
        await request.body?.cancel().catch(() => undefined);
        return Response.json({ errors: [{ message: FORBIDDEN }] }, { status: 403 });
      }
    }
    return handler(request, context);
  };
}
