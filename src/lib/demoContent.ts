import type { Doctor } from '@/payload-types';

import { DEMO_HERO, DEMO_PHOTOS, type DemoPhotoKey } from './demoPhotos';

/*
 * Demo content of the client preview (DEMO_CONTENT, src/lib/env.ts, refused on the live site):
 * stand-ins for the dentists, the patient voices, the digital workflow steps and a before/after
 * pair, so the preview looks complete before the clinic sends them. Nothing is stored: the home
 * view model and the dentists hub show these only while nothing of that kind is published, and
 * the first published item replaces them. Each one says what it is («فرضی», «طرح نمایشی»; never
 * «نمونه», which reads as a real case) and has no council number, degree, profile, consent line,
 * JSON-LD or booking binding. The dentists, voices and steps show a stock photo of
 * src/lib/demoPhotos.ts, each alt ending in «عکس نمایشی»; the before/after pair keeps the house
 * placeholder, as two stock photos would claim a treatment result.
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

/** The stock photo of each demo dentist and voice, by position. */
export const DEMO_DOCTOR_PHOTOS = ['dentist-1', 'dentist-2', 'dentist-3'] as const;
export const DEMO_VOICE_PHOTOS = ['voice-1', 'voice-2', 'voice-3'] as const;

/**
 * Home scene 5 while no `workflow` block is published (gap 48 open): four steps of the shot list
 * rows ۲۱، ۲۲، ۲۴ and ۲۵ in the fields WorkflowSection reads, each line saying the clinic's own
 * text goes there, and the section's heading when the page has no `workflow` row.
 */
export const DEMO_WORKFLOW_HEADING = 'روش دیجیتال درمان';
export const DEMO_WORKFLOW: Array<{
  id: string;
  title: string;
  text: string;
  photo: null;
  demo: DemoPhotoKey;
}> = [
  ['اسکن و تصویر سه‌بعدی', 'workflow-scan'],
  ['طراحی روی صفحه', 'workflow-design'],
  ['ساخت در لابراتوار', 'workflow-make'],
  ['لبخند نهایی', 'workflow-smile'],
].map(([title, demo], i) => ({
  id: `demo-${i + 1}`,
  title: title as string,
  text: `${DEMO_COPY.label}؛ شرح این گام به زبان کلینیک اینجا می‌آید.`,
  photo: null,
  demo: demo as DemoPhotoKey,
}));

/** Every visible demo string, for the copy test. */
export function demoCopy(): string[] {
  return [
    ...Object.values(DEMO_COPY),
    ...DEMO_DOCTORS.map((d) => d.name),
    ...DEMO_VOICES,
    DEMO_WORKFLOW_HEADING,
    ...DEMO_WORKFLOW.flatMap((s) => [s.title, s.text]),
    DEMO_HERO.alt,
    ...Object.values(DEMO_PHOTOS).map((p) => p.alt),
  ];
}
