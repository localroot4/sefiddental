/**
 * The Notifier (architecture.md 5.3, admin-notify.md 9.1). Events and job inputs hold ids,
 * counts and hashes only: never a phone, name, note or triage text (privacy rule P-1, P-2).
 */

export type Channel = 'mail' | 'telegram' | 'sms_admin' | 'sms_patient';
export const CHANNELS: readonly Channel[] = ['mail', 'telegram', 'sms_admin', 'sms_patient'];

export type NotifyEvent =
  | { type: 'booking'; bookingId: number | string; requestId?: string }
  | { type: 'ip_spike'; ipHashPrefix: string; count: number; requestId?: string }
  | {
      type: 'error';
      signature: string;
      routePath: string;
      errName: string;
      count: number;
      requestId?: string;
    }
  | { type: 'test'; requestedBy: number | string };

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
