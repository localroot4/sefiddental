import type { ReactNode } from 'react';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BOOKING_DIALOG_ID } from '@/components/chrome/ids';
import { t } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import { getPublished } from '@/lib/data/published';
import { stubSiteEnv } from '@/lib/http/testEnv';
import { log } from '@/lib/log/logger';
import { readYaml } from '@/seed/sources';
import { clinicYaml } from '@/seed/schemas';
import { globalsData } from '@/seed/transforms';

import { BookingDialog } from './BookingDialog';
import { BookingPageView } from './BookingPage';
import { BookingSuccessExtras } from './BookingSuccess';
import { BookingSuccessView } from './BookingSuccessPage';

vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getFeatures: vi.fn() }));
vi.mock('@/lib/data/published', () => ({ getPublished: vi.fn() }));
vi.mock('@/lib/log/logger', () => ({ log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const seeded = globalsData(readYaml(process.cwd(), 'docs/content/clinic.yaml', clinicYaml).data);
const CLINIC = { id: 1, ...seeded.clinic };

/** Server HTML of a tree with async server components (renderToStaticMarkup cannot wait). */
async function html(node: ReactNode): Promise<string> {
  const { prelude } = await prerender(node);
  return new Response(prelude).text();
}

const count = (markup: string, pattern: RegExp) => markup.match(pattern)?.length ?? 0;

beforeEach(() => {
  stubSiteEnv();
  vi.mocked(log.warn).mockClear();
  vi.mocked(getClinic).mockResolvedValue(CLINIC as never);
  vi.mocked(getFeatures).mockResolvedValue({ id: 1, ...seeded.features } as never);
  vi.mocked(getPublished).mockResolvedValue([] as never);
});
afterEach(() => vi.unstubAllEnvs());

describe('booking views (conversion.md 5, 5.4; freeze G7, G9)', () => {
  it('BV1 the dialog is named by its form heading and closes through its own button', async () => {
    const markup = await html(await BookingDialog({}));
    expect(markup).toMatch(
      new RegExp(`<dialog id="${BOOKING_DIALOG_ID}" aria-labelledby="bk-dialog-title"`),
    );
    expect(markup).toMatch(/<h2[^>]*id="bk-dialog-title"/);
    expect(markup).toMatch(
      new RegExp(`<button[^>]*command="close"[^>]*commandfor="${BOOKING_DIALOG_ID}"`),
    );
    expect(count(markup, /<form/g)).toBe(1);
    expect(markup).toContain('data-booking-form="dialog"');
    expect(markup).not.toMatch(/\sstyle=/);
  });

  it('BV2 with the database down the dialog renders nothing, so the 404 still answers', async () => {
    vi.mocked(getClinic).mockRejectedValue(new Error('db down'));
    expect(await BookingDialog({})).toBeNull();
    expect(log.warn).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'booking_dialog_unavailable' }),
    );
  });

  it('BV3 success extras: the call fallback opts into the sheet; WhatsApp only once verified', async () => {
    const full = await html(await BookingSuccessExtras({ full: true }));
    expect(full).toMatch(/<a data-call-sheet="" href="tel:\+98\d+"/);
    expect(full).toContain(t('call.label'));
    expect(full).toContain('download="sefid-dental.vcf"');
    expect(full).not.toContain('wa.me');
    const compact = await html(await BookingSuccessExtras({ full: false }));
    expect(compact).not.toContain('data-call-sheet');
    expect(compact).not.toContain(t('booking.bringHeading'));
    vi.mocked(getClinic).mockResolvedValue({
      ...CLINIC,
      phones: { ...CLINIC.phones, whatsapp: '+989121234567', whatsappVerified: true },
    } as never);
    expect(await html(await BookingSuccessExtras({ full: true }))).toContain(
      'href="https://wa.me/989121234567?text=',
    );
  });

  it('BV4 the booking page holds one form with its tokens and no dialog', async () => {
    const markup = await html(
      await BookingPageView({
        title: 'رزرو نوبت',
        tokens: { csrf: 'page-csrf', ts: 'v1.page.sig' },
        inputs: { restore: null } as never,
      }),
    );
    expect(count(markup, /data-booking-form=/g)).toBe(1);
    expect(markup).toContain('data-booking-form="page"');
    expect(markup).not.toContain('data-booking-dialog');
    expect(markup).toMatch(/name="ts" value="v1\.page\.sig"/);
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(markup)?.[1];
    expect(JSON.parse(ld ?? '{}')['@graph']).toMatchObject([
      { '@type': 'BreadcrumbList', itemListElement: [{ name: 'خانه' }, { name: 'رزرو نوبت' }] },
    ]);
  });

  it('BV5 the success page focuses its heading without JavaScript and opens CTAs in a dialog', async () => {
    const markup = await html(
      BookingSuccessView({ callback: 'پذیرش با شما تماس می‌گیرد.', masked: '۰۹۱۲ *** ۶۷۸۹' }),
    );
    expect(markup).toMatch(/<h1[^>]*tabindex="-1"[^>]*autofocus=""/i);
    expect(markup).toContain('پذیرش با شما تماس می‌گیرد.');
    expect(markup).toMatch(/<bdi dir="ltr">۰۹۱۲ \*\*\* ۶۷۸۹<\/bdi>/);
    expect(count(markup, /data-booking-dialog/g)).toBe(1);
    expect(markup).toMatch(/data-call-sheet=""/);
  });

  it('BV6 the clinic number in a send failure or the neutral line is a call link, through the sheet', async () => {
    for (const notice of ['server', 'neutral'] as const) {
      const markup = await html(
        await BookingPageView({
          title: 'رزرو نوبت',
          tokens: null,
          inputs: { restore: { values: {}, nameError: false, initial: { notice } } } as never,
        }),
      );
      const doc = new DOMParser().parseFromString(markup, 'text/html');
      const box = doc.querySelector(notice === 'server' ? '[role="alert"]' : '[role="status"]')!;
      const link = box.querySelector('a[href^="tel:+98"]');
      expect(link, notice).not.toBeNull();
      expect(link!.getAttribute('dir')).toBe('ltr');
      expect(link!.hasAttribute('data-call-sheet')).toBe(true);
      expect(link!.getAttribute('data-track')).toBe('call_click');
      expect(link!.getAttribute('data-location')).toBe('page');
      expect(link!.querySelector('.underline')).not.toBeNull();
    }
  });

  it('BV7 the success page centres its card in the column (no empty half from 820 px)', async () => {
    const markup = await html(BookingSuccessView({ callback: 'پذیرش', masked: null }));
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    expect(doc.querySelector('h1')!.parentElement!.className.split(' ')).toContain('mx-auto');
  });

  it('BV8 the dialog keeps the panel padding under the last control while the form scrolls', async () => {
    const markup = await html(await BookingDialog({}));
    const dialog = new DOMParser().parseFromString(markup, 'text/html').querySelector('dialog')!;
    const band = dialog.lastElementChild!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    // It sits over the content while the sheet scrolls: clicks pass through to the control below.
    expect(band.className.split(' ')).toEqual(
      expect.arrayContaining(['sticky', 'bottom-0', 'pointer-events-none']),
    );
    // The band is the padding: the sheet keeps none of its own under the content.
    expect(dialog.className).not.toMatch(/(^|\s)(lg:)?pb-/);
    // Focus and scrollIntoView stop above the band, so a focused control and its ring stay clear.
    expect(dialog.className.split(' ')).toEqual(
      expect.arrayContaining([
        'scroll-pb-[calc(var(--space-6)+env(safe-area-inset-bottom))]',
        'lg:scroll-pb-6',
      ]),
    );
  });

  it('BV9 the booking page shows one title: the card keeps its form name for screen readers only', async () => {
    const markup = await html(
      await BookingPageView({
        title: 'رزرو نوبت',
        tokens: null,
        inputs: { restore: null } as never,
      }),
    );
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    const title = doc.getElementById('bk-page-title')!;
    expect(title.textContent).toBe(t('booking.heading'));
    expect(title.className.split(' ')).toContain('sr-only');
    expect(doc.querySelector('form')!.getAttribute('aria-labelledby')).toBe('bk-page-title');
    // Every other instance keeps its visible title (the dialog is named by it).
    const dialog = new DOMParser().parseFromString(
      await html(await BookingDialog({})),
      'text/html',
    );
    expect(dialog.getElementById('bk-dialog-title')!.className.split(' ')).not.toContain('sr-only');
  });
});
