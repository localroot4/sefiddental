/**
 * Measurement allowlists (docs/conversion.md 380-409, spec-data 4.2). Stored as text plus this
 * code list, not a select: a select is a Postgres enum, so every new value would need a
 * migration. Dependency-free: the client tracker imports the names.
 */

export const EVENT_NAMES = [
  'booking_open',
  'booking_submit',
  'booking_success',
  'booking_error',
  'call_click',
  'closed_sheet_view',
  'whatsapp_click',
  'directions_click',
  'emergency_submit',
  'tier_select',
  'case_slider_use',
  'save_contact',
  'content_to_service',
  'theme_toggle',
] as const;

export const EVENT_LOCATIONS = [
  'header',
  'hero',
  'sticky',
  'section',
  'tier',
  'aside',
  'article',
  'page',
  'block',
  'dialog',
  'footer',
  'drawer',
  'mega_menu',
  'faq',
  'success',
  'closed_sheet',
  'none',
  'other',
] as const;

export const PAGE_TYPES = [
  'home',
  'service',
  'category',
  'services_hub',
  'dentist',
  'dentists_hub',
  'cases',
  'pricing',
  'guide',
  'guide_hub',
  'article',
  'articles',
  'address',
  'emergency',
  'booking',
  'booking_success',
  'about',
  'legal',
  'system',
  'other',
] as const;

/*
 * GA4-only parameter values (docs/analytics.md): the counter never stores them, so they need no
 * normalization; the lists keep the senders on one vocabulary.
 */
/** `open_state` of `call_click` and `emergency_submit`: the hours state, else unknown. */
export const OPEN_STATES = [
  'before-open',
  'open',
  'closing-soon',
  'closed',
  'holiday',
  'unknown',
] as const;
/** `provider` of `directions_click`. */
export const PROVIDERS = ['google', 'neshan', 'balad', 'waze'] as const;

export type EventName = (typeof EVENT_NAMES)[number];
export type EventLocation = (typeof EVENT_LOCATIONS)[number];
export type PageType = (typeof PAGE_TYPES)[number];
export type OpenState = (typeof OPEN_STATES)[number];
export type Provider = (typeof PROVIDERS)[number];

export interface EventRow {
  date: string;
  event: EventName;
  location: EventLocation;
  pageType: PageType;
  serviceKey: string;
}

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

/**
 * One beacon to one counter row. Unknown event: null (dropped). Location: missing 'none',
 * unknown 'other'. Page type: unknown or missing 'other'. Service key outside the published
 * keys: 'none'. A NULL dimension would never conflict in the unique index, so sentinels are used.
 */
export function normalizeEvent(
  raw: unknown,
  date: string,
  serviceKeys: ReadonlySet<string>,
): EventRow | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { event, location, pageType, serviceKey } = raw as Record<string, unknown>;
  if (!isOneOf(EVENT_NAMES, event)) return null;
  return {
    date,
    event,
    location:
      location === undefined || location === null || location === ''
        ? 'none'
        : isOneOf(EVENT_LOCATIONS, location)
          ? location
          : 'other',
    pageType: isOneOf(PAGE_TYPES, pageType) ? pageType : 'other',
    serviceKey: typeof serviceKey === 'string' && serviceKeys.has(serviceKey) ? serviceKey : 'none',
  };
}
