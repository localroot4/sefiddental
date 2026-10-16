import type { Flash } from '@/lib/http/flash';

import type { BookingInstance } from './BookingForm';
import { restoreFromFlash, type BookingRestore } from './restore';

type Query = Record<string, string | string[] | undefined>;

export interface BookingPageInputs {
  service?: string;
  tier?: string;
  dentist?: string;
  /** The instance a no-JS home post came from (`hero`, `block`), kept as `formLocation` (5.6). */
  location?: BookingInstance;
  restore: BookingRestore | null;
}

const LOCATIONS: readonly BookingInstance[] = ['hero', 'block', 'dialog', 'page'];

/** One query or kept value: the first string, trimmed, within `max` and free of controls. */
function one(value: string | string[] | undefined, max: number): string | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  return text && text.length <= max && !/[\u0000-\u001F]/.test(text) ? text : undefined;
}
const key = (value: string | string[] | undefined) => {
  const text = one(value, 100);
  return text && /^[a-z0-9-]+$/.test(text) ? text : undefined;
};

/**
 * What the booking page prefills (conversion.md 5, 5.6): the values a no-JS post left win over the
 * link's ASCII `?service=`, `?tier=` and `?dentist=`; other keys are ignored. Every value is only a
 * starting point: the page looks the service up, and the handler checks all of them again.
 */
export function bookingPageInputs(query: Query, flash: Flash | null): BookingPageInputs {
  const restore = restoreFromFlash(flash);
  const kept = restore?.values ?? {};
  const location = LOCATIONS.find((l) => l === kept.location);
  return {
    service: key(kept.service_key) ?? key(query.service),
    tier: key(kept.tier) ?? key(query.tier),
    dentist: one(kept.dentist, 200) ?? one(query.dentist, 200),
    location,
    restore,
  };
}
