import type { PayloadRequest } from 'payload';
import { totpAccess } from 'payload-totp';

import { readEnv } from '@/lib/env';
import { isCronCaller } from '@/lib/http/auth';

import { hasRole } from './roles';

const verifiedAdmin = totpAccess(({ req }) => hasRole(req.user, 'admin'));

/**
 * `jobs.access.run` for Payload's own `/api/payload-jobs/run`: the cron bearer (constant-time
 * compare) or an admin who passed the TOTP check. The plugin does not wrap this access
 * (PAY 12.4 item 4); the default would let any signed-in user run jobs. The site's scheduler
 * is `/api/cron/tick` (freeze decision 6), which uses the Local API.
 */
export async function canRunJobs({ req }: { req: PayloadRequest }): Promise<boolean> {
  if (isCronCaller(req.headers, readEnv().cronSecret)) return true;
  return (await verifiedAdmin({ req })) === true;
}
