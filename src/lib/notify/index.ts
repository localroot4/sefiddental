import type { Payload } from 'payload';
import type { Logger } from 'pino';

import { readEnv, type ServerEnv } from '@/lib/env';
import { log } from '@/lib/log/logger';

import { readyChannels } from './drivers';
import { destinationHash } from './smsThrottle';
import { NOTIFY_TASK, readNotifierSettings, type NotifyJobInput } from './task';
import type { Channel, Notifier, NotifierSettings, NotifyEvent } from './types';

interface NotifierDeps {
  payload: () => Promise<Payload>;
  env: () => Pick<ServerEnv, 'ipHashSecret' | 'smtp' | 'telegram' | 'farapayamak'>;
  logger: Pick<Logger, 'info' | 'warn'>;
  now: () => number;
}

type Queue = (args: { task: string; input: NotifyJobInput }) => Promise<unknown>;

/**
 * notify(): the `log` driver writes one line at once (always on, no phone, name or note), then
 * one `notify` job per ready channel is queued, holding ids and hashes only (D-5). With no ready
 * channel the log line is the only output; the booking is in the admin list anyway (R-11).
 */
export function createNotifier(deps: NotifierDeps): Notifier {
  // shortcut: the spike dedupe lives in one process, so two processes may each alert once;
  // move it to a table if alerts repeat.
  const lastSpike = new Map<string, number>();

  return {
    async notify(event: NotifyEvent) {
      const reqId = 'requestId' in event ? event.requestId : undefined;
      const line = (channels: Channel[]) =>
        deps.logger.info({
          msg: 'notify',
          type: event.type,
          bookingId: event.type === 'booking' ? event.bookingId : undefined,
          channels,
          reqId,
        });
      const env = deps.env();
      let payload: Payload;
      let settings: NotifierSettings;
      try {
        payload = await deps.payload();
        settings = await readNotifierSettings(payload);
      } catch (error) {
        // The log driver's line survives a database failure (9.1 step 1).
        line([]);
        throw error;
      }

      if (event.type === 'ip_spike') {
        const windowMs = Math.max(1, settings.errorDedupMinutes ?? 60) * 60_000;
        const now = deps.now();
        const last = lastSpike.get(event.ipHashPrefix);
        if (last !== undefined && now - last < windowMs) {
          deps.logger.info({ msg: 'notify_deduped', type: event.type, reqId });
          return;
        }
        lastSpike.set(event.ipHashPrefix, now);
      }

      const channels = readyChannels(settings, env, event);
      line(channels);

      const queue = (input: NotifyJobInput) =>
        // The task slug joins the generated job types with this phase's type generation.
        (payload.jobs as unknown as { queue: Queue }).queue({ task: NOTIFY_TASK, input });
      for (const channel of channels) {
        if (channel === 'sms_admin') {
          for (const recipient of settings.sms?.adminRecipients ?? []) {
            const recipientHash = destinationHash(recipient.phone, env.ipHashSecret);
            await queue({ event, channel, recipientHash });
          }
        } else {
          await queue({ event, channel });
        }
      }
    },
  };
}

/** The site's Notifier. */
export const notifier: Notifier = createNotifier({
  // Loaded on first use, so importing the notifier never loads the Payload config.
  payload: async () => (await import('@/lib/data/payload')).getPayloadClient(),
  env: readEnv,
  logger: log,
  now: Date.now,
});
