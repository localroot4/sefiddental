import type { Payload, TaskConfig } from 'payload';

import { readEnv, type ServerEnv } from '@/lib/env';
import { log } from '@/lib/log/logger';

import { readyChannels, sendMail, sendSms, sendTelegram } from './drivers';
import { renderBooking, renderEvent, renderPatientSms } from './render';
import { claimSms, destinationHash, releaseSms } from './smsThrottle';
import {
  CHANNELS,
  type Channel,
  type NotifierSettings,
  type NotifyEvent,
  type SendResult,
} from './types';

/**
 * The `notify` job (admin-notify.md 9.3): one job per channel, input = the event (ids, counts,
 * hashes), the channel and, for an admin SMS, the recipient's hash. Run by the cron tick; five
 * retries with exponential backoff from 60 s (freeze G11, D-9); successful jobs are deleted.
 */

export const NOTIFY_TASK = 'notify';
export const NOTIFY_RETRIES = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
} as const;

export interface NotifyJobInput {
  event: NotifyEvent;
  channel: Channel;
  recipientHash?: string | null;
}

interface JobDeps {
  payload: Payload;
  env: Pick<ServerEnv, 'siteUrl' | 'ipHashSecret' | 'smtp' | 'telegram' | 'farapayamak'>;
  now: () => number;
  fetchImpl?: typeof fetch;
}

export async function readNotifierSettings(payload: Payload): Promise<NotifierSettings> {
  return (await payload.findGlobal({
    slug: 'notifier',
    depth: 0,
    overrideAccess: true,
  })) as NotifierSettings;
}

/** One delivery. Throws on a driver failure (the job retries); a vanished target is skipped. */
export async function runNotifyJob(input: NotifyJobInput, deps: JobDeps): Promise<SendResult> {
  const { payload, env } = deps;
  const { event, channel } = input;
  const settings = await readNotifierSettings(payload);
  // A switch turned off after queueing wins: nothing is sent.
  if (!readyChannels(settings, env, event).includes(channel)) {
    return { status: 'skipped', reason: 'no_recipient' };
  }

  let phone: string | null = null;
  let message;
  if (event.type === 'booking') {
    const booking = await payload.findByID({
      collection: 'bookings',
      id: event.bookingId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    });
    if (!booking) return { status: 'skipped', reason: 'no_recipient' };
    phone = booking.phone;
    message =
      channel === 'sms_patient'
        ? renderPatientSms()
        : renderBooking(booking, env.siteUrl, event.requestId);
  } else {
    message = renderEvent(event, env.siteUrl);
  }

  switch (channel) {
    case 'mail':
      return sendMail(payload, settings, message);
    case 'telegram':
      return sendTelegram(env, settings, message, deps.fetchImpl);
    case 'sms_admin': {
      const recipient = settings.sms?.adminRecipients?.find(
        (r) => destinationHash(r.phone, env.ipHashSecret) === input.recipientHash,
      );
      return recipient ? sendSms() : { status: 'skipped', reason: 'no_recipient' };
    }
    case 'sms_patient': {
      if (!phone) return { status: 'skipped', reason: 'no_recipient' };
      const hash = destinationHash(phone, env.ipHashSecret);
      const claimedAt = await claimSms(payload, hash, deps.now());
      if (claimedAt === null) {
        log.info({
          msg: 'sms_capped',
          bookingId: event.type === 'booking' ? event.bookingId : undefined,
        });
        return { status: 'skipped', reason: 'cap' };
      }
      try {
        return await sendSms();
      } catch (error) {
        await releaseSms(payload, hash, claimedAt);
        throw error;
      }
    }
  }
}

const bookingIdOf = (input: Partial<NotifyJobInput> | undefined) =>
  input?.event?.type === 'booking' ? input.event.bookingId : undefined;

export const notifyTask: TaskConfig<{ input: NotifyJobInput; output: { status: string } }> = {
  slug: NOTIFY_TASK,
  label: 'ارسال اعلان',
  inputSchema: [
    { name: 'event', type: 'json', required: true },
    {
      name: 'channel',
      type: 'select',
      required: true,
      options: CHANNELS.map((value) => ({ label: value, value })),
    },
    { name: 'recipientHash', type: 'text' },
  ],
  retries: NOTIFY_RETRIES,
  handler: async ({ input, req }) => {
    const result = await runNotifyJob(input, {
      payload: req.payload,
      env: readEnv(),
      now: Date.now,
    });
    return { output: { status: result.status } };
  },
  // Payload calls onFail after every failed try; only the last one (the same test as its
  // handleTaskError) is an error, the earlier ones retry.
  onFail: ({ input, job, taskStatus }) => {
    const event = (input as Partial<NotifyJobInput> | undefined)?.event;
    const final = !taskStatus?.complete && (taskStatus?.totalTried ?? 0) >= NOTIFY_RETRIES.attempts;
    log[final ? 'error' : 'warn']({
      msg: 'notify_failed',
      channel: (input as Partial<NotifyJobInput> | undefined)?.channel,
      type: event?.type,
      bookingId: bookingIdOf(input as Partial<NotifyJobInput> | undefined),
      jobId: job.id,
      reqId: event && 'requestId' in event ? event.requestId : undefined,
    });
  },
};
