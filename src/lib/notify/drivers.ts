import type { Payload } from 'payload';

import type { ServerEnv } from '@/lib/env';
import { scrubPhones } from '@/lib/log/redact';

import { msg } from './render';
import type { Channel, NotifierSettings, NotifyEvent, RenderedMessage, SendResult } from './types';

/**
 * Drivers (admin-notify.md 9.5). A channel is ready only when its switch in the notifier global
 * is on AND the server has its credentials; without SMTP Payload's console adapter would look
 * like success, so mail is then not ready. Errors are thrown for the job to retry: Persian, at
 * most 200 characters, phone-scrubbed, never a URL, token or password.
 */

type Env = Pick<ServerEnv, 'smtp' | 'telegram' | 'farapayamak'>;

export function readyChannels(settings: NotifierSettings, env: Env, event: NotifyEvent): Channel[] {
  const channels: Channel[] = [];
  const mail = settings.mail;
  if (mail?.enabled && env.smtp && (mail.recipients?.length ?? 0) > 0) channels.push('mail');
  if (settings.telegram?.enabled && settings.telegram.chatId && env.telegram) {
    channels.push('telegram');
  }
  const sms = settings.sms;
  const smsReady = Boolean(sms?.enabled && sms.senderNumber && env.farapayamak);
  // Spike and error alerts go to mail and Telegram only (9.2).
  if (smsReady && (event.type === 'booking' || event.type === 'test')) {
    if ((sms?.adminRecipients?.length ?? 0) > 0) channels.push('sms_admin');
    if (event.type === 'booking' && sms?.patientConfirmation) channels.push('sms_patient');
  }
  return channels;
}

/** Error text that is safe to store in payload_jobs and show on the status view. */
export function driverError(text: string): Error {
  return new Error(scrubPhones(text).slice(0, 200));
}

const causeOf = (error: unknown): string => {
  const code = (error as { code?: unknown; name?: unknown } | null)?.code;
  const name = error instanceof Error ? error.name : 'Error';
  return typeof code === 'string' && /^[A-Z0-9_]{2,40}$/.test(code) ? code : name;
};

export async function sendMail(
  payload: Pick<Payload, 'sendEmail'>,
  settings: NotifierSettings,
  message: RenderedMessage,
): Promise<SendResult> {
  const to = (settings.mail?.recipients ?? []).map((r) => r.email).filter(Boolean);
  if (to.length === 0) return { status: 'skipped', reason: 'no_recipient' };
  try {
    await payload.sendEmail({ to, subject: message.subject, text: message.text });
  } catch (error) {
    throw driverError(msg('notify.fail.mail', { cause: `SMTP: ${causeOf(error)}` }));
  }
  return { status: 'sent' };
}

/** Scaffold behind its switch (Telegram is usually filtered from servers in Iran, C-7). */
export async function sendTelegram(
  env: Env,
  settings: NotifierSettings,
  message: RenderedMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
  const chatId = settings.telegram?.chatId;
  if (!env.telegram || !chatId) return { status: 'skipped', reason: 'no_recipient' };
  let status: number;
  try {
    // The URL holds the bot token: it is never logged or put into an error.
    const res = await fetchImpl(
      `https://api.telegram.org/bot${env.telegram.botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: `${message.subject}\n${message.text}` }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    status = res.status;
  } catch (error) {
    throw driverError(msg('notify.fail.telegram', { cause: causeOf(error) }));
  }
  if (status < 200 || status >= 300) {
    throw driverError(msg('notify.fail.telegram', { cause: `HTTP ${status}` }));
  }
  return { status: 'sent' };
}

/**
 * Farapayamak scaffold: the provider call is written in the phase that enables SMS, after reading
 * the provider's current API documentation. Until then a ready channel fails loudly (the switch
 * stays off by default) and the SMS cap runs before this call.
 */
export async function sendSms(): Promise<SendResult> {
  throw driverError(msg('notify.fail.sms'));
}
