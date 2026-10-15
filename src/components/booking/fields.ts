/**
 * Field names of the booking form (docs/conversion.md 5.1, 5.3): the phase 4 markup and the
 * phase 5 handler read this one constant. The honeypot name looks like no real field, so browser
 * autofill never fills it for a real visitor (not `company`, nav-conversion-hero C6).
 */
export const BOOKING_FIELDS = {
  phone: 'phone',
  name: 'name',
  /** The chip group: a booking group (BOOKING_GROUP_OPTIONS). */
  service: 'service',
  /** The exact service the page knew, as its ASCII key. */
  serviceKey: 'service_key',
  tier: 'tier',
  dentist: 'dentist',
  timePref: 'time_pref',
  note: 'note',
  sourceUrl: 'source_url',
  utm: 'utm',
  location: 'location',
  ts: 'ts',
  csrf: 'csrf',
  honeypot: 'extra_7',
} as const;

/** The note's limit; no maxlength attribute, so a long paste is never cut silently. */
export const NOTE_MAX = 500;

/** Chip values in display order (docs/content/services.yaml booking groups). */
export const BOOKING_GROUPS = [
  'exam',
  'cosmetic',
  'implant',
  'restore',
  'root_canal',
  'ortho',
  'kids',
  'other',
] as const;

export const TIME_PREFS = ['morning', 'evening', 'any'] as const;
