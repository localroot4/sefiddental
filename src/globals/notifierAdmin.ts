import type { Endpoint, PayloadRequest } from 'payload';
import { totpAccess } from 'payload-totp';

import { hasRole } from '@/access/roles';
import { adminText, type AdminMessageKey } from '@/i18n/fa-admin';
import { readEnv, type ServerEnv } from '@/lib/env';
import { createRateLimiter, type RateLimiter } from '@/lib/http/rateLimit';
import { log } from '@/lib/log/logger';
import { readyChannels } from '@/lib/notify/drivers';
import { destinationHash } from '@/lib/notify/smsThrottle';
import { readNotifierSettings, runNotifyJob } from '@/lib/notify/task';
import type { Channel, NotifyEvent } from '@/lib/notify/types';

/**
 * admin-notify.md 9.7: a switch may be turned on only when the server holds the channel's
 * credentials (secrets live in env, never in the global). Applies to saves by a person; seeders
 * and tests that write with the Local API and no user are the operator's own choice.
 */
export const needsEnv =
  (has: (env: ServerEnv) => boolean, message: string, read: () => ServerEnv = readEnv) =>
  (value: unknown, { req }: { req: PayloadRequest }): true | string =>
    value !== true || !req.user || has(read()) ? true : message;

const verifiedAdmin = totpAccess(({ req }: { req: PayloadRequest }) => hasRole(req.user, 'admin'));

type Settings = Awaited<ReturnType<typeof readNotifierSettings>>;

/**
 * The test covers what the clinic receives; the patient SMS is never sent as a test. A switch
 * that is on but cannot send says so, as the status view does (9.10), never «خاموش».
 */
const TESTED: ReadonlyArray<{
  channel: Channel;
  name: AdminMessageKey;
  on: (settings: Settings) => boolean;
  notReady: AdminMessageKey;
}> = [
  {
    channel: 'mail',
    name: 'admin.notifier.mail',
    on: (s) => Boolean(s.mail?.enabled),
    notReady: 'admin.status.mailNotReady',
  },
  {
    channel: 'telegram',
    name: 'admin.notifier.telegram',
    on: (s) => Boolean(s.telegram?.enabled),
    notReady: 'admin.status.telegramNotReady',
  },
  {
    channel: 'sms_admin',
    name: 'admin.notifier.sms',
    on: (s) => Boolean(s.sms?.enabled),
    notReady: 'admin.notifier.smsNotReady',
  },
];

type TestStatus = 'sent' | 'off' | 'notReady' | 'skipped' | 'failed';

/** The toast's kind: any channel that should have sent and did not is an error. */
function levelOf(statuses: TestStatus[]): 'error' | 'success' | 'info' {
  if (statuses.some((s) => s === 'notReady' || s === 'skipped' || s === 'failed')) return 'error';
  return statuses.includes('sent') ? 'success' : 'info';
}

interface TestDeps {
  env: () => Pick<ServerEnv, 'siteUrl' | 'ipHashSecret' | 'smtp' | 'telegram' | 'farapayamak'>;
  limiter: RateLimiter;
  now: () => number;
}

/**
 * POST /api/globals/notifier/test (9.8): one test message per ready channel, sent at once (not
 * queued, so nothing is left in the job table), one line per channel and the toast's kind. A
 * TOTP-verified admin only, once a minute per person; anyone else gets the 404 the hidden global
 * gives editors (spec 7).
 */
export function createNotifierTest(deps: TestDeps): Omit<Endpoint, 'root'> {
  return {
    path: '/test',
    method: 'post',
    handler: async (req) => {
      if ((await verifiedAdmin({ req })) !== true || !req.user) {
        return Response.json({ errors: [{ message: 'Not Found' }] }, { status: 404 });
      }
      if (!deps.limiter.hit(`notifier-test:${req.user.id}`, deps.now()).ok) {
        return Response.json({ message: adminText('admin.notifier.wait') }, { status: 429 });
      }
      const env = deps.env();
      const settings = await readNotifierSettings(req.payload);
      const event: NotifyEvent = { type: 'test', requestedBy: req.user.id };
      const ready = readyChannels(settings, env, event);
      const first = settings.sms?.adminRecipients?.[0]?.phone;
      const outcome = async ({
        channel,
        on,
        notReady,
      }: (typeof TESTED)[number]): Promise<[TestStatus, string]> => {
        if (!ready.includes(channel)) {
          return on(settings)
            ? ['notReady', adminText(notReady)]
            : ['off', adminText('admin.notifier.off')];
        }
        try {
          const input = {
            event,
            channel,
            recipientHash: first ? destinationHash(first, env.ipHashSecret) : null,
          };
          const sent = await runNotifyJob(input, { payload: req.payload, env, now: deps.now });
          return sent.status === 'sent'
            ? ['sent', adminText('admin.notifier.sent')]
            : ['skipped', adminText('admin.notifier.noRecipient')];
        } catch (error) {
          // Driver errors are already Persian, phone-scrubbed and short (drivers.ts).
          return ['failed', error instanceof Error ? error.message : String(error)];
        }
      };
      const results: Partial<Record<Channel, TestStatus>> = {};
      const lines: string[] = [];
      for (const tested of TESTED) {
        const [status, text] = await outcome(tested);
        results[tested.channel] = status;
        lines.push(
          adminText('admin.notifier.line', { channel: adminText(tested.name), result: text }),
        );
      }
      log.info({ msg: 'notifier_test', results, userId: req.user.id });
      const level = levelOf(Object.values(results));
      return Response.json({ lines, message: lines.join(' '), level });
    },
  };
}

export const notifierTest = createNotifierTest({
  env: readEnv,
  limiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
  now: Date.now,
});
