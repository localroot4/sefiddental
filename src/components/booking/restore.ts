import type { Flash } from '@/lib/http/flash';

import type { BookingInitial, Notice, PhoneReason } from './BookingFormIsland';

/** What a no-JS booking post left for the booking page (freeze G3): values, errors, a message. */
export interface BookingRestore {
  /** The submitted text fields by form name (phone, name, service, time_pref, note, …). */
  values: Partial<Record<string, string>>;
  initial: BookingInitial;
  nameError: boolean;
}

const PHONE_REASONS: readonly PhoneReason[] = ['empty', 'invalid', 'landline'];
const NOTICES: Partial<Record<Flash['outcome'], Notice>> = {
  retry: 'retry',
  expired: 'expired',
  neutral: 'neutral',
  server: 'server',
};

/**
 * The booking page's state from the flash the proxy opened: null without one, for another form,
 * or for a success (that flash belongs to the success page). Codes map to the form's own copy.
 */
export function restoreFromFlash(flash: Flash | null): BookingRestore | null {
  if (!flash || flash.form !== 'booking' || flash.outcome === 'success') return null;
  const values = flash.values ?? {};
  const errors = flash.errors ?? {};
  const phoneError = errors.phone
    ? (PHONE_REASONS.find((reason) => reason === errors.phone) ?? 'invalid')
    : undefined;
  return {
    values,
    nameError: Boolean(errors.name),
    initial: {
      phone: values.phone,
      note: values.note,
      phoneError,
      noteError: Boolean(errors.note),
      notice: NOTICES[flash.outcome],
    },
  };
}
