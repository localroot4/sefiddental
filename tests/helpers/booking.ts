// Shared helpers of the booking and emergency e2e specs (phase 5 freeze G18). Every test that
// submits a form runs as its own client (a unique X-Forwarded-For, trusted by the e2e `app`
// server) with its own phone, so the per-IP and per-phone rules never see two tests as one
// visitor, and it waits out the 2 s time trap the server measures.
import { randomInt } from 'node:crypto';

import type { BrowserContext, Page, TestInfo } from '@playwright/test';

import { QA_CLOCK_HEADER } from '@/lib/hoursState';

const hex16 = () => randomInt(0x10000).toString(16);

/**
 * A unique client address for this test attempt: the documentation prefix 2001:db8::/32 with 32
 * random bits in the /64 (the limits count IPv6 per /64).
 */
export async function isolateClient(context: BrowserContext, extra?: Record<string, string>) {
  await context.setExtraHTTPHeaders({
    'X-Forwarded-For': `2001:db8:${hex16()}:${hex16()}::1`,
    ...extra,
  });
}

/**
 * A mobile number no other test attempt uses: 0999 and 7 digits mixed from the test id, the
 * retry and a random value (099x is a valid mobile prefix, conversion.md 5.1).
 */
export function uniquePhone(testInfo: TestInfo): string {
  let hash = 0;
  for (const char of `${testInfo.testId}:${testInfo.retry}`) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  const digits = (Math.abs(hash) + randomInt(10_000_000)) % 10_000_000;
  return `0999${String(digits).padStart(7, '0')}`;
}

/** Waits until 2.1 s after `sinceMs` (Date.now() when the token arrived): past the time trap. */
export async function pastTimeTrap(sinceMs: number): Promise<void> {
  const wait = sinceMs + 2100 - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

/**
 * A unique client (as isolateClient) whose requests also set the server-side hours clock
 * (QA-CLOCK, honored only with QA_ROUTES=1). Call it instead of isolateClient: extra HTTP headers
 * replace each other.
 */
export async function isolateClientAt(context: BrowserContext, at: Date) {
  await isolateClient(context, { [QA_CLOCK_HEADER]: at.toISOString() });
}

/**
 * The bodies the page hands to navigator.sendBeacon (the /api/events counter): Playwright reports
 * a beacon request without its body, so a wrapper installed before any page script records them.
 * Call it before the first navigation; the returned function reads what was sent so far.
 */
export async function recordBeacons(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const sent: string[] = [];
    (window as unknown as { __beacons: string[] }).__beacons = sent;
    const send = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      if (data instanceof Blob) void data.text().then((text) => sent.push(text));
      else sent.push(String(data));
      return send(url, data);
    };
  });
  return () => page.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons);
}

/**
 * Hydrated: every booking form island switched to its own validation (`noValidate`). A click
 * before that is the no-JS path, which posts the page away.
 */
export async function formsHydrated(page: Page): Promise<void> {
  await page.waitForLoadState('load');
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-booking-form] form')].every(
      (form) => (form as HTMLFormElement).noValidate,
    ),
  );
}

/**
 * Every measurement event with all its parameters: a `window.gtag` stand-in installed before any
 * page script, which track() calls when GA4 is loaded (GA4 itself is off in e2e). The beacon
 * carries only the four counter dimensions; this sees `duplicate`, `error_type`, `has_name`, ….
 */
export async function recordEvents(
  page: Page,
): Promise<() => Promise<Array<[string, Record<string, unknown>]>>> {
  await page.addInitScript(() => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const w = window as unknown as {
      __events: typeof calls;
      gtag: (...args: unknown[]) => void;
    };
    w.__events = calls;
    w.gtag = (kind, name, params) => {
      if (kind === 'event') calls.push([String(name), (params ?? {}) as Record<string, unknown>]);
    };
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { __events: Array<[string, Record<string, unknown>]> }).__events,
    );
}

/** Counts the booking POSTs (the form action /رزرو-نوبت) this page sends. */
export function countBookingPosts(page: Page): () => number {
  let posts = 0;
  page.on('request', (request) => {
    if (request.method() !== 'POST') return;
    if (decodeURI(new URL(request.url()).pathname) === '/رزرو-نوبت') posts += 1;
  });
  return () => posts;
}

/** «۰۹۹۹ ••• ۱۲۳۴», the masked number the success state shows for a national mobile number. */
export { maskNational as maskedPhone } from '@/components/booking/phoneInput';

/**
 * Runs `press` (a no-JS submit) and waits for the page the 303 lands on: the GET navigation to
 * `target` (decoded path) and its load. waitForURL alone would pass at once when the post comes
 * back to the same page.
 */
export async function landsOn(page: Page, target: string, press: () => Promise<void>) {
  const landed = page.waitForResponse(
    (response) =>
      response.request().isNavigationRequest() &&
      response.request().method() === 'GET' &&
      decodeURI(new URL(response.url()).pathname) === target,
  );
  await press();
  const response = await landed;
  await page.waitForLoadState('load');
  return response;
}

/**
 * A booking post as a no-JS form sends it (urlencoded, no JSON Accept), from the page's own
 * context so its cookies (the form sid, then the flash) are the browser's. The 303 is not
 * followed: the browser's next GET of its target reads the flash. Values never go in a URL.
 */
export function postBooking(page: Page, fields: Record<string, string>) {
  return page.request.post(encodeURI('/رزرو-نوبت'), {
    form: fields,
    maxRedirects: 0,
    headers: { origin: new URL(page.url()).origin },
  });
}
