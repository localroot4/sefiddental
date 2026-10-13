import type { Access } from 'payload';
import { totpAccess } from 'payload-totp';

/**
 * HTTP-authenticated users always carry `_strategy` (set by Payload's JWT and API-key
 * strategies, and by the TOTP strategy once a code is entered). A user passed explicitly to the
 * Local API, as Payload's schedulePublish job does, has none: that call comes from server code,
 * so the TOTP session check does not apply (PAY 12.4; the job otherwise fails for every enrolled
 * user). Use with `custom: { totp: { disableAccessWrapper: { update: true } } }`.
 */
export const totpUnlessServerUser =
  (inner: Access): Access =>
  async (args) => {
    const user = args.req.user as { _strategy?: string } | null | undefined;
    if (user && user._strategy === undefined) return inner(args);
    return totpAccess(inner)(args);
  };

/** The collection opt-out that goes with `totpUnlessServerUser` on `update`. */
export const SERVER_USER_UPDATE = { totp: { disableAccessWrapper: { update: true } } } as const;
