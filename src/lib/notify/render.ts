import { PREFERRED_TIME_OPTIONS } from '@/collections/Bookings';
import { BOOKING_GROUP_OPTIONS } from '@/fields/factories';
import { NOTIFY_MESSAGES, type NotifyMessageKey } from '@/i18n/fa-notify';
import { formatJalali, formatTimeFa } from '@/lib/jalali';
import { scrubPhones } from '@/lib/log/redact';
import { toPersianDigits } from '@/lib/persianText';
import { maskPhoneInline } from '@/lib/phone';

import type { NotifyEvent, RenderedMessage } from './types';

/** Message content (admin-notify.md 9.4, D-4): masked phone and the admin link, never more. */

export function msg(key: NotifyMessageKey, vars: Record<string, string | number> = {}): string {
  return NOTIFY_MESSAGES[key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ''));
}

/** The fields of a booking row a message may use (no name, note or triage). */
export interface BookingForMessage {
  id: number | string;
  kind?: string | null;
  phone: string;
  bookingGroup?: string | null;
  preferredTime?: string | null;
  createdAt: string;
  callbackDueAt?: string | null;
}

const labelOf = (options: Array<{ label: string; value: string }>, value?: string | null) =>
  options.find((option) => option.value === value)?.label ?? msg('notify.value.none');

const fa = (value: number | string) => toPersianDigits(String(value));

function when(iso: string | null | undefined): string {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return msg('notify.value.unknown');
  return msg('notify.value.dateTime', {
    date: formatJalali(at, 'd MMMM yyyy'),
    time: formatTimeFa(at),
  });
}

function masked(phone: string): string {
  try {
    return maskPhoneInline(phone);
  } catch {
    return msg('notify.value.unknown');
  }
}

export function renderBooking(
  booking: BookingForMessage,
  siteUrl: string,
  requestId?: string,
): RenderedMessage {
  const emergency = booking.kind === 'emergency';
  const id = fa(booking.id);
  const lines = [
    msg('notify.line.kind', {
      value: msg(emergency ? 'notify.kind.emergency' : 'notify.kind.regular'),
    }),
    msg('notify.line.group', { value: labelOf(BOOKING_GROUP_OPTIONS, booking.bookingGroup) }),
    msg('notify.line.time', { value: labelOf(PREFERRED_TIME_OPTIONS, booking.preferredTime) }),
    msg('notify.line.createdAt', { value: when(booking.createdAt) }),
    msg('notify.line.callbackDue', { value: when(booking.callbackDueAt) }),
    msg('notify.line.phone', { value: masked(booking.phone) }),
    msg('notify.line.link', { value: `${siteUrl}/admin/collections/bookings/${booking.id}` }),
  ];
  if (requestId) lines.push(msg('notify.line.requestId', { value: requestId }));
  return {
    subject: msg(emergency ? 'notify.emergency.subject' : 'notify.booking.subject', { id }),
    text: lines.join('\n'),
    sms: msg(emergency ? 'notify.sms.emergency' : 'notify.sms.booking', { id }),
  };
}

/** Every event except a booking (which needs its row). */
export function renderEvent(
  event: Exclude<NotifyEvent, { type: 'booking' }>,
  siteUrl: string,
): RenderedMessage {
  switch (event.type) {
    case 'ip_spike': {
      const link = `${siteUrl}/admin/collections/bookings?where[status][equals]=suspicious`;
      const text = msg('notify.spike.text', {
        link,
        addresses: fa(event.addresses ?? 1),
        minutes: fa(event.windowMinutes ?? 60),
      });
      return { subject: msg('notify.spike.subject'), text, sms: msg('notify.spike.subject') };
    }
    case 'budget': {
      const vars = {
        channel: msg(`notify.channel.${event.channel}`),
        limit: fa(event.limit),
        held: fa(event.held),
        since: when(event.since),
        link: `${siteUrl}/admin/collections/bookings`,
      };
      const subject = msg('notify.budget.subject', vars);
      return { subject, text: msg('notify.budget.text', vars), sms: subject };
    }
    case 'error': {
      const subject = msg('notify.error.subject', { route: scrubPhones(event.routePath) });
      const text = msg('notify.error.text', {
        count: fa(event.count),
        requestId: event.requestId ?? msg('notify.value.unknown'),
        link: `${siteUrl}/admin/system-status`,
      });
      return { subject, text, sms: subject };
    }
    case 'test':
      return {
        subject: msg('notify.test.subject'),
        text: msg('notify.test.text'),
        sms: msg('notify.test.text'),
      };
  }
}

/** The patient's confirmation SMS (client approves the text before SMS is enabled). */
export function renderPatientSms(): RenderedMessage {
  const text = msg('notify.sms.patient');
  return { subject: text, text, sms: text };
}
