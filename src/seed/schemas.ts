import { z } from 'zod';

/** zod shapes of the seed sources (spec-data 8.2-8.5). Unknown keys are allowed (context notes). */

const key = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const text = z.string().min(1);
/** 'TODO' marks copy written in phase 6: stored as null (spec-data 9.1). */
const todo = z
  .string()
  .nullish()
  .transform((v) =>
    v === undefined || v === null || v.trim() === '' || v.trim() === 'TODO' ? null : v,
  );
const e164 = z.string().regex(/^\+98\d{10}$/);
const faq = z.object({ question: text, answer: text });
const faqs = z.array(faq).max(8);
const steps = z.object({
  type: z.literal('steps'),
  items: z
    .array(z.object({ title: text, text }))
    .min(1)
    .max(8),
});
const content = z.object({ type: z.literal('content'), text });
const callout = z.object({
  type: z.literal('callout'),
  tone: z.enum(['info', 'warning']).optional(),
  text,
});
/** Body blocks (src/blocks): `content` text is the small Markdown subset of `lexicalFrom`. */
const serviceBlocks = z.array(z.discriminatedUnion('type', [content, steps, callout]));
const pageBlocks = z.array(
  z.discriminatedUnion('type', [
    content,
    steps,
    callout,
    z.object({ type: z.literal('faq'), items: faqs.min(1) }),
  ]),
);
/** Payload's publisher options (src/fields/factories.ts sourcesArray); a test keeps them equal. */
export const PUBLISHER_VALUES = [
  'ADA',
  'AAPD',
  'AAP',
  'Cochrane',
  'NHS',
  'IADT',
  'journal',
  'other',
] as const;
/** H27: a source the copy lane opened, with its published title and the day it was read. */
const source = z.object({
  title: text,
  publisher: z.enum(PUBLISHER_VALUES),
  url: z.string().regex(/^https:\/\/[^\s/]+\.[^\s]+$/),
  accessed_on: z.string().regex(/^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
});
const sources = z.array(source).max(20);
/**
 * H26: only null, with `# NEEDS_CLIENT: reviewer dentist (gap 42)` after it. The admin sets the
 * reviewer in the panel; the seeder writes no key, so a sync never clears that choice.
 */
const pendingClientFact = z.null().optional();
const table = z
  .object({
    type: z.literal('table'),
    caption: text,
    head: z.array(text).min(2).max(4),
    rows: z.array(z.array(text)).min(1),
  })
  .refine((t) => t.rows.every((row) => row.length === t.head.length), {
    message: 'every row needs one cell per heading',
    path: ['rows'],
  });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const weekday = z.enum(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']);

export const servicesYaml = z.object({
  categories: z
    .array(
      z.object({
        key,
        title: text,
        nav_label: text.optional(),
        slug: z.string().min(1).nullable(),
        standalone: z.boolean().optional(),
        accent: z.enum(['warm', 'brand', 'green', 'sky', 'yellow']),
        icon: key.optional(),
        order: z.number().int().min(0),
        summary: todo.optional(),
        intro: todo.optional(),
        faqs: faqs.optional(),
        seo_title: text.optional(),
        seo_description: text.optional(),
      }),
    )
    .min(1),
  services: z
    .array(
      z.object({
        key,
        category: key,
        nav_label: text,
        h1: text,
        seo_title: text,
        slug: text,
        booking_group: z.enum([
          'exam',
          'cosmetic',
          'implant',
          'restore',
          'root_canal',
          'ortho',
          'kids',
          'other',
        ]),
        priority: z.number().int().min(1).max(3),
        search_terms: z.array(text).max(10),
        summary: todo.optional(),
        sessions: todo.optional(),
        duration: todo.optional(),
        anesthesia: todo.optional(),
        recovery: todo.optional(),
        seo_description: text.optional(),
        body: serviceBlocks.optional(),
        faqs: faqs.optional(),
        related: z.array(key).max(3).optional(),
        sources: sources.optional(),
        reviewed_by: pendingClientFact,
        price_from: z.number().int().min(0).nullable(),
        emergency_link: z.boolean().optional(),
        scope_to_verify: z.string().optional(),
        alias: z.string().startsWith('/').optional(),
        tiers: z
          .array(
            z.object({
              key,
              name: text,
              description: text,
              price_from: z.number().int().min(0).nullable(),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
});

export const clinicYaml = z.object({
  name_fa: text,
  name_short_fa: text.nullish(),
  name_en: text.nullish(),
  tagline_fa: text.nullish(),
  contact_headline_fa: text.nullish(),
  footer_line_fa: text.nullish(),
  domain: z.string().regex(/^([a-z0-9-]+\.)+[a-z]{2,}$/),
  address: z.object({
    full_fa: text,
    city: text,
    district: text.nullish(),
    postal_code: z
      .string()
      .regex(/^\d{10}$/)
      .nullish(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    access_notes_fa: text.nullish(),
  }),
  phones: z.object({
    landline: e164,
    mobile: e164.nullish(),
    whatsapp: e164.nullish(),
    telegram: e164.nullish(),
  }),
  social: z.object({
    instagram: z.string().nullish(),
    telegram_channel: z.string().nullish(),
    aparat: z.string().nullish(),
  }),
  hours: z.object({
    note_fa: text.nullish(),
    weekly: z.array(z.object({ days: z.array(weekday).min(1), open: hhmm, close: hhmm })).min(1),
    timezone: z.literal('Asia/Tehran'),
  }),
  stats: z.object({
    years_active: z.number().int().min(0).nullish(),
    specialist_dentists: z.number().int().min(0).nullish(),
    specialty_clinics: z.number().int().min(0).nullish(),
    insurances: z.number().int().min(0).nullish(),
  }),
  insurances: z.object({ featured: z.array(text) }).optional(),
  financing: z.array(
    z.object({
      key,
      title_fa: text,
      provider: text.nullish(),
      max_amount_toman: z.number().int().min(0).nullish(),
      who_applies_fa: text.nullish(),
      surcharge_note_fa: text.nullish(),
      status: z.string().regex(/^(approved_\d{4}-\d{2}-\d{2}|pending)$/),
      enabled: z.boolean().optional(),
    }),
  ),
  emergency: z.object({ offered: z.boolean(), policy_fa: text.nullish() }),
  legal: z.object({ license_number: text.nullish(), technical_supervisor: text.nullish() }),
  market: z.object({ target_areas_fa: z.array(text), secondary_areas_fa: z.array(text) }),
  seo: z.object({ default_description_fa: text.nullish() }).optional(),
});

export const insurancesYaml = z.object({
  featured: z.array(z.object({ name_fa: text, logo: z.string() })),
  others: z.array(z.object({ name_fa: text, logo: z.string().optional() })).nullish(),
});

export const doctorsYaml = z.object({
  doctors: z.array(
    z.object({
      slug: z.string(),
      name_fa: z.string(),
      specialty_fa: z.string(),
      council_number: z.union([z.string(), z.number()]).transform(String),
      degrees_fa: z.array(z.string()).nullish(),
      years_experience: z.number().int().min(0).max(60).nullish(),
      bio_fa: z.string().nullish(),
      services: z.array(key).nullish(),
      photo: z.string().nullish(),
      order: z.number().int().min(0).nullish(),
    }),
  ),
});

export const testimonialsYaml = z.object({
  testimonials: z.array(
    z.object({
      patient_label_fa: z.string(),
      service: z.string().nullish(),
      type: z.enum(['video', 'text']),
      media: z.string().nullish(),
      poster: z.string().nullish(),
      quote_fa: z.string().nullish(),
      consent_confirmed: z.boolean(),
    }),
  ),
});

export const caseYaml = z.object({
  title_fa: text,
  service: key,
  notes_fa: z.string().nullish(),
  consent_confirmed: z.boolean(),
});

export const pagesYaml = z.object({
  pages: z
    .array(
      z.object({
        key: z.string(),
        slug: z.string(),
        title: text,
        seo_title: text.optional(),
        seo_description: text.optional(),
        lead: text.optional(),
        noindex: z.boolean().optional(),
        /** Home only: the hero subtext without the flag sentence (freeze F7). */
        subtext: text.optional(),
        /** Home only: section headings (Pages `sections`, keys checked by Payload). */
        sections: z.array(z.object({ key, heading: text, intro: text.optional() })).optional(),
        blocks: pageBlocks.optional(),
        /** Guides (H29, C5): the body is `blocks` with a `faq` block; these two are new. */
        sources: sources.optional(),
        reviewed_by: pendingClientFact,
      }),
    )
    .min(1),
});

/**
 * src/seed/data/articles.yaml (H29). Strict entries: a misspelled key stops the run instead of
 * being dropped. Categories and tags are matched by slug; an article names them by slug.
 */
export const articlesYaml = z.object({
  categories: z.array(z.strictObject({ slug: text, title: text, description: text.optional() })),
  tags: z.array(z.strictObject({ slug: text, title: text })),
  articles: z.array(
    z.strictObject({
      slug: text,
      title: text,
      /** The search-title topic; the site suffix is added (V-TITLE). */
      seo_title: text,
      seo_description: text,
      excerpt: text,
      category: text,
      tags: z.array(text).max(8).optional(),
      /** A services key, or null for an article without one (H21, article 6). */
      primary_service: key.nullable(),
      is_medical: z.boolean(),
      body: z.array(z.discriminatedUnion('type', [content, callout, table])).min(1),
      faqs: faqs.optional(),
      sources: sources.optional(),
      reviewed_by: pendingClientFact,
      /** Gap 58: the cover photo and the author are client answers, set in the admin. */
      cover: pendingClientFact,
      author: pendingClientFact,
    }),
  ),
});

export type ServicesYaml = z.infer<typeof servicesYaml>;
export type ClinicYaml = z.infer<typeof clinicYaml>;
export type InsurancesYaml = z.infer<typeof insurancesYaml>;
export type PagesYaml = z.infer<typeof pagesYaml>;
export type ArticlesYaml = z.infer<typeof articlesYaml>;
