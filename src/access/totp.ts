import { AsyncLocalStorage } from 'node:async_hooks';

import type { Access } from 'payload';
import { totpAccess } from 'payload-totp';

// One store per process: the bundler copies this module into each server layer (route, RSC).
const store = globalThis as typeof globalThis & { __sefidJobRunner?: AsyncLocalStorage<true> };
const jobRunner = (store.__sefidJobRunner ??= new AsyncLocalStorage<true>());

/**
 * Runs `fn` as the site's job runner (`/api/cron/tick`). Only inside it may a user without an
 * auth strategy skip the TOTP check: Payload's schedulePublish job runs as the scheduling user,
 * and that user proved the TOTP check when the job was queued (src/admin/schedulePublish.ts).
 */
export const asJobRunner = <T>(fn: () => Promise<T>): Promise<T> => jobRunner.run(true, fn);

/**
 * HTTP-authenticated users always carry `_strategy` (set by Payload's JWT and API-key
 * strategies, and by the TOTP strategy once a code is entered). A user passed explicitly to the
 * Local API, as Payload's schedulePublish job does, has none. That alone proves nothing, so the
 * exemption also needs the job runner (PAY 12.4; SEC-AUTH-1). Use with
 * `custom: { totp: { disableAccessWrapper: { update: true } } }`.
 */
export const totpUnlessServerUser =
  (inner: Access): Access =>
  async (args) => {
    const user = args.req.user as { _strategy?: string } | null | undefined;
    if (user && user._strategy === undefined && jobRunner.getStore() === true) return inner(args);
    return totpAccess(inner)(args);
  };

/** The collection opt-out that goes with `totpUnlessServerUser` on `update`. */
export const SERVER_USER_UPDATE = { totp: { disableAccessWrapper: { update: true } } } as const;
