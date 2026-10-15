import { z } from 'zod';

import {
  BOOKING_FIELDS as F,
  BOOKING_GROUPS,
  NOTE_MAX,
  TIME_PREFS,
} from '@/components/booking/fields';
import { normalizePersian } from '@/lib/persianText';
import { parseIranPhone } from '@/lib/phone';

/**
 * Request schemas of /api/booking and /api/emergency (booking-pipeline 5.2, emergency.md 6.3).
 * The phone and the visitor's text fail with a code the form maps to its own copy; metadata
 * (service, tier, dentist, location, source page, campaign) is normalized or dropped and never
 * fails a request: a validation error there would lose a real booking (conversion.md 1.6).
 */

export const NAME_MAX = 80;
const PHONE_INPUT_MAX = 64;
const SOURCE_URL_MAX = 300;
const UTM_MAX = 100;
const TIER_MAX = 30;

export const BOOKING_LOCATIONS = ['hero', 'block', 'dialog', 'page'] as const;
/** Bookings.triage values in the form's order. */
export const TRIAGE = ['severe_pain', 'swelling', 'broken', 'avulsion', 'bleeding'] as const;
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export type Triage = (typeof TRIAGE)[number];
export type FieldError = 'empty' | 'invalid' | 'landline' | 'too_long' | 'required';
export type FieldErrors = Partial<Record<'phone' | 'name' | 'note' | 'triage', FieldError>>;
export type Utm = Partial<Record<(typeof UTM_KEYS)[number], string>>;
type Id = number | string;

/** Published catalog the handler checks keys against. */
export interface Catalog {
  /** Service key to id. */
  services: ReadonlyMap<string, Id>;
  /** Service key to its published tier keys. */
  tiers: ReadonlyMap<string, ReadonlySet<string>>;
  /** Doctor slug to id. */
  doctors: ReadonlyMap<string, Id>;
}

/** Every text field of a submitted form as a string, triage as a list. */
export interface FormInput {
  fields: Record<string, string>;
  triage: string[];
}

export interface Contact {
  phone: string;
  phoneNational: string;
  name: string | null;
  note: string | null;
  sourceUrl: string | null;
  utm: Utm;
}

export interface BookingRequest extends Contact {
  bookingGroup: (typeof BOOKING_GROUPS)[number] | null;
  serviceKey: string | null;
  serviceId: Id | null;
  tier: string | null;
  doctorId: Id | null;
  preferredTime: (typeof TIME_PREFS)[number] | null;
  formLocation: (typeof BOOKING_LOCATIONS)[number];
}

export interface EmergencyRequest extends Contact {
  triage: Triage[];
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** FormData to strings; a file or a missing field reads as ''. */
export function formValues(form: FormData): FormInput {
  const fields: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key !== 'triage' && !(key in fields)) fields[key] = typeof value === 'string' ? value : '';
  }
  const triage = form.getAll('triage').filter((v): v is string => typeof v === 'string');
  return { fields, triage };
}

const phone = z.string().transform((value, ctx) => {
  const parsed =
    value.length > PHONE_INPUT_MAX
      ? ({ ok: false, reason: 'invalid' } as const)
      : parseIranPhone(value, { accept: 'mobile' });
  if (!parsed.ok) {
    ctx.issues.push({ code: 'custom', message: parsed.reason, input: value });
    return z.NEVER;
  }
  return { phone: parsed.e164, phoneNational: parsed.national };
});

// C0 controls other than tab and line breaks: PostgreSQL rejects NUL in text, and none is ever
// typed into a form.
const CONTROLS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const name = z
  .string()
  .transform((value) => normalizePersian(value.replace(CONTROLS, '')).replace(/\n+/g, ' '))
  .pipe(z.string().max(NAME_MAX, 'too_long'))
  .transform((value) => value || null);

// The limit applies to the stored (normalized) text, as for the name: a pasted ligature grows
// on normalization, and the column's own limit must never fail a valid request. CRLF counts as
// one character, like the client counter.
const note = z
  .string()
  .transform((value) => normalizePersian(value.replace(CONTROLS, '')))
  .pipe(z.string().max(NOTE_MAX, 'too_long'))
  .transform((value) => value || null);

/** A decoded path (no query or fragment), cut at 300 characters; anything else is null. */
function sourcePath(value: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(value.split(/[?#]/)[0] ?? '');
  } catch {
    return null;
  }
  if (!path.startsWith('/') || path.startsWith('//') || /[\u0000-\u001F]/.test(path)) return null;
  return path.slice(0, SOURCE_URL_MAX);
}

function utmOf(value: string): Utm {
  const params = new URLSearchParams(value.slice(0, 2048));
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const v = params
      .get(`utm_${key}`)
      ?.replace(/[\u0000-\u001F]/g, '')
      .trim();
    if (v) utm[key] = v.slice(0, UTM_MAX);
  }
  return utm;
}

const contactShape = {
  phone,
  name,
  note,
  sourceUrl: z.string().transform(sourcePath),
  utm: z.string().transform(utmOf),
};

const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values).nullable().catch(null);

function issuesToErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'phone' || field === 'name' || field === 'note' || field === 'triage') {
      errors[field] ??= issue.message as FieldError;
    }
  }
  return errors;
}

const contactInput = (fields: Record<string, string>) => ({
  phone: fields[F.phone] ?? '',
  name: fields[F.name] ?? '',
  note: fields[F.note] ?? '',
  sourceUrl: fields[F.sourceUrl] ?? '',
  utm: fields[F.utm] ?? '',
});

function bookingSchema(catalog: Catalog) {
  const known = <T>(map: ReadonlyMap<string, T>) =>
    z
      .string()
      .transform((key) => (map.has(key) ? key : null))
      .catch(null);
  return z
    .object({
      ...contactShape,
      bookingGroup: oneOf(BOOKING_GROUPS),
      serviceKey: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(100)
        .pipe(known(catalog.services))
        .catch(null),
      tier: z.string().max(TIER_MAX).catch(''),
      dentist: known(catalog.doctors),
      preferredTime: oneOf(TIME_PREFS),
      formLocation: z.enum(BOOKING_LOCATIONS).catch('page'),
    })
    .transform(({ phone: number, serviceKey, tier, dentist, ...rest }): BookingRequest => {
      const tiers = serviceKey ? [catalog.tiers.get(serviceKey)] : [...catalog.tiers.values()];
      return {
        ...rest,
        ...number,
        serviceKey,
        serviceId: serviceKey ? (catalog.services.get(serviceKey) ?? null) : null,
        tier: tier && tiers.some((set) => set?.has(tier)) ? tier : null,
        doctorId: dentist ? (catalog.doctors.get(dentist) ?? null) : null,
      };
    });
}

export function parseBookingRequest(input: FormInput, catalog: Catalog): Parsed<BookingRequest> {
  const { fields } = input;
  const result = bookingSchema(catalog).safeParse({
    ...contactInput(fields),
    bookingGroup: fields[F.service] ?? '',
    serviceKey: fields[F.serviceKey] ?? '',
    tier: fields[F.tier] ?? '',
    dentist: fields[F.dentist] ?? '',
    preferredTime: fields[F.timePref] ?? '',
    formLocation: fields[F.location] ?? '',
  });
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: issuesToErrors(result.error) };
}

const triage = z
  .array(z.string())
  .transform((values) => TRIAGE.filter((value) => values.includes(value)))
  .refine((values) => values.length > 0, 'required');

const emergencySchema = z
  .object({ ...contactShape, triage })
  .transform(({ phone: number, ...rest }): EmergencyRequest => ({ ...rest, ...number }));

export function parseEmergencyRequest(input: FormInput): Parsed<EmergencyRequest> {
  const result = emergencySchema.safeParse({ ...contactInput(input.fields), triage: input.triage });
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: issuesToErrors(result.error) };
}
