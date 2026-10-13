import { scrubPhones } from '@/lib/log/redact';
import { EVENT_NAMES, type EventName } from '@/lib/track/eventsStub';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export const EVENTS_ENDPOINT = '/api/events';

type Params = Record<string, string | number | boolean>;

/** Keys that could carry a person; such params never leave the page (conversion.md 409). */
const PERSONAL_KEY = /^(?:phone\w*|mobile|tel|e164|(?:full_?|first_?|last_?)?name|note\w*|email)$/i;

const EVENT_SET: ReadonlySet<string> = new Set(EVENT_NAMES);

export function isEventName(value: unknown): value is EventName {
  return typeof value === 'string' && EVENT_SET.has(value);
}

function clean(params: Params): Params {
  const out: Params = {};
  for (const [key, value] of Object.entries(params)) {
    if (PERSONAL_KEY.test(key)) continue;
    out[key] = typeof value === 'string' ? scrubPhones(value) : value;
  }
  return out;
}

const asText = (value: Params[string] | undefined) =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** Page type of the current page: `data-page-type` on the page's main element (conversion 9). */
function pageTypeOfDocument(): string | undefined {
  return document.querySelector('[data-page-type]')?.getAttribute('data-page-type') ?? undefined;
}

/**
 * Sends one measurement event (spec 11.2): the first-party beacon with the four stored
 * dimensions (`location`, `pageType`, `serviceKey`; the server maps unknown values to
 * `other`/`none`), and the GA4 event with every param when GA4 is loaded. No cookies are sent;
 * failures are silent (a lost beacon never breaks the page).
 */
export function track(event: EventName, params: Params = {}): void {
  if (typeof window === 'undefined' || !isEventName(event)) return;
  const safe = clean(params);
  const body = JSON.stringify({
    event,
    location: asText(safe.location),
    pageType: asText(safe.pageType) ?? pageTypeOfDocument(),
    serviceKey: asText(safe.serviceKey),
  });
  try {
    const sent =
      typeof navigator.sendBeacon === 'function' &&
      navigator.sendBeacon(EVENTS_ENDPOINT, new Blob([body], { type: 'text/plain' }));
    if (!sent) {
      void fetch(EVENTS_ENDPOINT, {
        method: 'POST',
        body,
        headers: { 'content-type': 'text/plain' },
        keepalive: true,
        credentials: 'omit',
      }).catch(() => undefined);
    }
  } catch {
    // Measurement never breaks the page.
  }
  if (typeof window.gtag === 'function') window.gtag('event', event, safe);
}
