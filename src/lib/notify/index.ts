import type { Payload } from 'payload';
import type { Logger } from 'pino';

import { readEnv, type ServerEnv } from '@/lib/env';
import { log } from '@/lib/log/logger';
import { setErrorAlertWindow } from '@/lib/log/requestError';

import { readyChannels } from './drivers';
import { destinationHash } from './smsThrottle';
import { NOTIFY_TASK, readNotifierSettings, type NotifyJobInput } from './task';
import {
  CHANNEL_BUDGET,
  REGULAR_BUDGET,
  type BudgetedChannel,
  type Channel,
  type Notifier,
  type NotifierSettings,
  type NotifyEvent,
} from './types';

interface NotifierDeps {
  payload: () => Promise<Payload>;
  env: () => Pick<ServerEnv, 'ipHashSecret' | 'smtp' | 'telegram' | 'farapayamak'>;
  logger: Pick<Logger, 'info' | 'warn'>;
  now: () => number;
}

type Queue = (args: { task: string; input: NotifyJobInput }) => Promise<unknown>;

const HOUR = 60 * 60_000;
// SMS keeps its own rules (admin recipients uncapped, C-3; one patient SMS a day); it needs a
// budget of its own before it is switched on.
const budgeted = (channel: Channel): channel is BudgetedChannel =>
  channel === 'mail' || channel === 'telegram';

/**
 * notify(): the `log` driver writes one line at once (always on, no phone, name or note), then
 * one `notify` job per ready channel is queued, holding ids and hashes only (D-5). With no ready
 * channel the log line is the only output; the booking is in the admin list anyway (R-11).
 * Spike alerts go out once per window for all addresses together; mail and Telegram take at most
 * CHANNEL_BUDGET booking notifications an hour, then one budget alert per channel and hour (S5).
 */
export function createNotifier(deps: NotifierDeps): Notifier {
  // shortcut: the spike dedupe and the channel budgets live in one process, so each process
  // alerts and spends on its own; move them to a table if there are several processes.
  // The map holds the hashes of one window: up to one per address over the per-IP rule.
  const spikeSeen = new Map<string, number>(); // hash prefix -> last spike
  let spikeAlertAt = -Infinity;
  let spikeWindowMs = 0; // the window last read; a spike inside it is only counted
  type Budget = { sent: number[]; held: number; heldSince: number; alertAt: number };
  const budgets = new Map<Channel, Budget>();

  /**
   * Takes one slot of the hour, up to `limit` slots used; when none is left, `report` is the held
   * count once an hour.
   */
  const spend = (channel: Channel, now: number, limit: number) => {
    const budget = budgets.get(channel) ?? { sent: [], held: 0, heldSince: 0, alertAt: -Infinity };
    budgets.set(channel, budget);
    budget.sent = budget.sent.filter((at) => now - at < HOUR);
    if (budget.sent.length < limit) {
      budget.sent.push(now);
      return { ok: true };
    }
    if (budget.held === 0) budget.heldSince = now;
    budget.held += 1;
    if (now - budget.alertAt < HOUR) return { ok: false };
    const report = { held: budget.held, since: new Date(budget.heldSince).toISOString() };
    budget.held = 0;
    budget.alertAt = now;
    return { ok: false, report };
  };

  return {
    async notify(received: NotifyEvent) {
      // A spike inside the current alert window costs no database read and no line (S1 lets up
      // to 600 requests a minute through, each over-limit one a spike).
      const seenAt = deps.now();
      if (received.type === 'ip_spike' && seenAt - spikeAlertAt < spikeWindowMs) {
        spikeSeen.set(received.ipHashPrefix, seenAt);
        return;
      }
      let event = received;
      const reqId = 'requestId' in event ? event.requestId : undefined;
      const line = (channels: Channel[], held: Channel[] = []) =>
        deps.logger.info({
          msg: 'notify',
          type: event.type,
          bookingId: event.type === 'booking' ? event.bookingId : undefined,
          channels,
          held: held.length > 0 ? held : undefined,
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
      setErrorAlertWindow(settings.errorDedupMinutes);
      const windowMinutes = Math.max(1, settings.errorDedupMinutes ?? 60);
      const windowMs = windowMinutes * 60_000;
      spikeWindowMs = windowMs;
      const now = deps.now();

      if (event.type === 'ip_spike') {
        for (const [hash, at] of spikeSeen) if (now - at >= windowMs) spikeSeen.delete(hash);
        spikeSeen.set(event.ipHashPrefix, now);
        if (now - spikeAlertAt < windowMs) {
          deps.logger.info({ msg: 'notify_deduped', type: event.type, reqId });
          return;
        }
        spikeAlertAt = now;
        event = { ...event, addresses: spikeSeen.size, windowMinutes };
      }

      const held: Channel[] = [];
      const alerts: NotifyJobInput[] = [];
      const channels = readyChannels(settings, env, event).filter((channel) => {
        if (event.type !== 'booking' || !budgeted(channel)) return true;
        const limit = event.kind === 'regular' ? REGULAR_BUDGET : CHANNEL_BUDGET;
        const { ok, report } = spend(channel, now, limit);
        if (!ok) held.push(channel);
        if (report !== undefined) {
          const alert = { type: 'budget', channel, ...report, limit } as const;
          alerts.push({ event: alert, channel });
          deps.logger.warn({ msg: 'notify_budget', channel, held: report.held, reqId });
        }
        return ok;
      });
      line(channels, held);

      const queue = (input: NotifyJobInput) =>
        // The task slug joins the generated job types with this phase's type generation.
        (payload.jobs as unknown as { queue: Queue }).queue({ task: NOTIFY_TASK, input });
      // First: `held` is already reset, and a failed queue call below must not lose the alert.
      for (const alert of alerts) await queue(alert);
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
