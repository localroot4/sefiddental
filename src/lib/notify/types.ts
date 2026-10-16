/**
 * The Notifier (architecture.md 5.3, admin-notify.md 9.1). Events and job inputs hold ids,
 * counts and hashes only: never a phone, name, note or triage text (privacy rule P-1, P-2).
 */

export type Channel = 'mail' | 'telegram' | 'sms_admin' | 'sms_patient';
export const CHANNELS: readonly Channel[] = ['mail', 'telegram', 'sms_admin', 'sms_patient'];

/** Booking and emergency notifications per channel and hour, mail and Telegram (S5). */
export const CHANNEL_BUDGET = 20;
/** Regular bookings may take this many of the hour's slots, so a flood of them always leaves
 * CHANNEL_BUDGET - REGULAR_BUDGET for emergencies (phase 5 studio decision on finding 5). */
export const REGULAR_BUDGET = 15;
export type BudgetedChannel = 'mail' | 'telegram';

export type NotifyEvent =
  | {
      type: 'booking';
      bookingId: number | string;
      /** Which budget the notification spends; the handler always sets it. */
      kind?: 'regular' | 'emergency';
      requestId?: string;
    }
  | {
      type: 'ip_spike';
      ipHashPrefix: string;
      count: number;
      requestId?: string;
      /** Set by the Notifier: distinct hashes seen in the window, and its length (S5). */
      addresses?: number;
      windowMinutes?: number;
    }
  | {
      type: 'error';
      signature: string;
      routePath: string;
      errName: string;
      count: number;
      requestId?: string;
    }
  | { type: 'test'; requestedBy: number | string }
  /**
   * The Notifier's own: a channel's hourly budget held booking notifications back (S5); `held`
   * counts them since `since` (ISO), the first one not reported yet.
   */
  | { type: 'budget'; channel: BudgetedChannel; held: number; since: string; limit: number };

export interface RenderedMessage {
  subject: string;
  text: string;
  sms: string;
}

export type SendResult = { status: 'sent' } | { status: 'skipped'; reason: 'cap' | 'no_recipient' };

/** The architecture's `Notifier`: persist first, then call notify (never inside the write). */
export interface Notifier {
  notify(event: NotifyEvent): Promise<void>;
}

/** The `notifier` global, as the drivers read it. */
export interface NotifierSettings {
  mail?: { enabled?: boolean | null; recipients?: Array<{ email: string }> | null } | null;
  telegram?: { enabled?: boolean | null; chatId?: string | null } | null;
  sms?: {
    enabled?: boolean | null;
    senderNumber?: string | null;
    adminRecipients?: Array<{ phone: string }> | null;
    patientConfirmation?: boolean | null;
  } | null;
  errorDedupMinutes?: number | null;
}
