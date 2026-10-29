import type { Doctor } from '@/payload-types';

/*
 * Demo content of the client preview (DEMO_CONTENT, src/lib/env.ts, refused on the live site):
 * stand-ins for the dentists, the patient voices and a before/after pair, so the preview looks
 * complete before the clinic sends them. Nothing is stored: the home view model and the dentists
 * hub show these only while nothing of that kind is published, and the first published item
 * replaces them. Each one says what it is («فرضی», «طرح نمایشی»; never «نمونه», which reads as a
 * real case) and has no photo, council number, degree, profile, consent line, JSON-LD or booking
 * binding. The house photo placeholder (MediaPlaceholder) stands where each photo goes.
 */

/** Every demo line a visitor reads (the copy test of src/i18n/fa.test.ts reads them). */
export const DEMO_COPY = {
  label: 'طرح نمایشی',
  patient: 'بیمار فرضی',
  specialty: 'طرح نمایشی؛ نام و تخصص دندانپزشک اینجا می‌آید',
  caseText: 'اینجا عکس قبل و بعد یک درمان واقعی می‌آید، با نام خدمت و شرح کوتاه آن.',
  posterPhoto: 'تصویر اول ویدیوی یک بیمار واقعی، ۴:۵',
  beforePhoto: 'عکس پیش از درمان یک بیمار واقعی، ۱:۱',
  afterPhoto: 'عکس پس از درمان همان بیمار، ۱:۱',
} as const;

/**
 * Three dentists (one row of the three-column grid) in the fields DentistList reads; the site adds
 * «دکتر» to the name. The empty slug gives no profile path, so no link, JSON-LD entry or booking
 * binding; the empty council number hides the council line; no photo shows the placeholder.
 */
export const DEMO_DOCTORS: Array<
  Pick<Doctor, 'id' | 'name' | 'slug' | 'specialty' | 'councilNumber'> & { photo: null }
> = ['۱', '۲', '۳'].map((digit, i) => ({
  id: -(i + 1),
  name: `فرضی ${digit}`,
  slug: '',
  specialty: DEMO_COPY.specialty,
  councilNumber: '',
  photo: null,
}));

/** Three patient voices: each says a real patient's words go there; none claims a result. */
export const DEMO_VOICES = [
  'اینجا جملهٔ یک بیمار واقعی دربارهٔ ترمیم دندانش می‌آید.',
  'اینجا تجربهٔ یک بیمار واقعی از جرم‌گیری، به زبان خود او، می‌آید.',
  'اینجا سخن یک بیمار واقعی دربارهٔ لمینت سرامیکی می‌آید.',
];

/** Every visible demo string, for the copy test. */
export function demoCopy(): string[] {
  return [...Object.values(DEMO_COPY), ...DEMO_DOCTORS.map((d) => d.name), ...DEMO_VOICES];
}
