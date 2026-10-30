import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '@/i18n/fa';
import { getClinic, getFeatures } from '@/lib/data/globals';
import type { Flash } from '@/lib/http/flash';
import { stubSiteEnv } from '@/lib/http/testEnv';
import type { Page } from '@/payload-types';

import { Emergency } from './Emergency';

vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn(), getFeatures: vi.fn() }));
// The dialog's own form is an async server component of the booking lane (tested there).
vi.mock('@/components/booking/BookingDialog', () => ({
  BookingDialog: (props: { emergencyLink?: boolean }) => (
    <dialog data-booking-dialog="" data-emergency-link={String(props.emergencyLink)}>
      <div data-booking-form="dialog" />
    </dialog>
  ),
}));
vi.mock('@/components/services/RichBody', () => ({
  RichBody: () => <p>نمونهٔ آزمایشی: کمپرس سرد</p>,
}));

const EVERY_DAY = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
let clinic: Record<string, unknown>;
let features: Record<string, unknown>;
const PAGE = { id: 1, key: 'emergency', title: 'درد شدید دندان دارید؟' } as unknown as Page;
const TOKENS = { csrf: 'csrf-token', ts: 'v1.abc.sig' };
// Tehran is UTC+3:30.
const OPEN = new Date('2026-10-14T08:00:00Z');
const CLOSED = new Date('2026-10-14T17:00:00Z');

async function render(
  clock: Date,
  over: { page?: Partial<Page>; flash?: Flash | null } = {},
): Promise<Document> {
  const html = renderToStaticMarkup(
    await Emergency({
      page: { ...PAGE, ...over.page } as Page,
      clock,
      tokens: TOKENS,
      flash: over.flash ?? null,
    }),
  );
  return new DOMParser().parseFromString(`<main>${html}</main>`, 'text/html');
}

const sections = (doc: Document) =>
  Array.from(doc.querySelectorAll('[data-section]'), (el) => el.getAttribute('data-section'));

afterEach(() => vi.unstubAllEnvs());

beforeEach(() => {
  stubSiteEnv();
  clinic = {
    phones: { landline: '+982155101054', whatsapp: '+989121234567', whatsappVerified: false },
    address: { fullFa: 'تهران، خانی‌آباد نو' },
    maps: { neshanUrl: 'https://neshan.org/maps/x' },
    hours: { weekly: [{ days: EVERY_DAY, open: '10:00', close: '20:00' }], holidays: [] },
    reception: { callbackMinutes: 10 },
    emergency: { priorityPromiseConfirmed: false, nearby24hCenter: null },
  };
  features = { emergencyEnabled: true };
  vi.mocked(getClinic).mockImplementation(async () => clinic as never);
  vi.mocked(getFeatures).mockImplementation(async () => features as never);
});

describe('/اورژانس page (conversion.md 7, emergency spec 4)', () => {
  it('T-EM1 open: H1, lead, the call button, safety box, form, then address', async () => {
    const doc = await render(OPEN);
    expect(sections(doc)).toEqual(['hero', 'call', 'safety', 'form', 'address']);
    expect(doc.querySelector('h1')?.textContent).toBe('درد شدید دندان دارید؟');
    expect(doc.querySelector('[data-section="hero"] p')?.textContent).toBe(
      t('emergency.lead.open'),
    );
    const call = doc.querySelector('[data-section="call"] a');
    expect(call?.getAttribute('href')).toBe('tel:+982155101054');
    expect(call?.textContent).toBe('تماس با کلینیک');
    expect(call?.getAttribute('data-track')).toBe('call_click');
    expect(call?.getAttribute('data-location')).toBe('hero');
    expect(doc.querySelector('[data-section="form"]')?.textContent).toContain(
      t('emergency.form.intro'),
    );
  });

  it('T-EM1 closed: the 115 call, then the safety box, the closed lead, no clinic call, no form intro', async () => {
    const doc = await render(CLOSED);
    expect(sections(doc)).toEqual(['hero', 'call-115', 'safety', 'form', 'address']);
    const call = doc.querySelector('[data-section="call-115"]')!;
    expect(call.getAttribute('href')).toBe('tel:115');
    expect(call.closest('[data-call-sheet], [data-track]')).toBeNull();
    expect(doc.querySelector('[data-section="hero"] p')?.textContent).toBe(
      t('emergency.lead.closed'),
    );
    expect(doc.body.textContent).not.toContain(t('emergency.form.intro'));
    // EM-F9: the plain callback line above the button while gap 19 is open.
    expect(doc.body.textContent).toContain('پذیرش فردا از ساعت ۱۰ با شما تماس می‌گیرد.');
    expect(doc.body.textContent).not.toContain('پیش از بقیهٔ');
    clinic.emergency = { priorityPromiseConfirmed: true };
    expect((await render(CLOSED)).body.textContent).toContain(
      'پذیرش فردا از ساعت ۱۰، پیش از بقیهٔ درخواست‌ها، با شما تماس می‌گیرد.',
    );
  });

  it('T-EM5 tel:115 is untracked and outside every call sheet; every clinic tel: is inside one', async () => {
    for (const clock of [OPEN, CLOSED]) {
      const doc = await render(clock);
      const ems = [...doc.querySelectorAll('a[href="tel:115"]')];
      // Closed: the 115 button above the safety box too (JURY 5).
      expect(ems.map((a) => a.textContent)).toEqual(
        clock === OPEN ? ['اورژانس ۱۱۵'] : [t('emergency.call115'), 'اورژانس ۱۱۵'],
      );
      for (const a of ems) {
        expect(a.closest('[data-call-sheet]')).toBeNull();
        expect(a.hasAttribute('data-track')).toBe(false);
      }
      for (const a of doc.querySelectorAll('a[href^="tel:+98"]')) {
        expect(a.closest('[data-call-sheet]')).not.toBeNull();
      }
    }
  });

  it('T-EM5b the safety box: a labelled section with four signs, never an alert, never red', async () => {
    const doc = await render(CLOSED);
    const box = doc.querySelector('[data-section="safety"]')!;
    expect(box.tagName).toBe('SECTION');
    expect(doc.getElementById(box.getAttribute('aria-labelledby')!)?.tagName).toBe('H2');
    expect(box.querySelectorAll('li')).toHaveLength(4);
    expect(box.textContent).toContain(t('emergency.safety.sameDay'));
    expect(doc.querySelector('[role="alert"]')).toBeNull();
    expect(box.outerHTML).not.toMatch(/danger/);
    expect(box.outerHTML).toMatch(/warning/);
  });

  it('T-EM16 the avulsion text follows its box, with the call in open and the closed text after', async () => {
    const open = await render(OPEN);
    const box = open.querySelector('input[value="avulsion"]')!;
    const reveal = box.closest('div')!.querySelector('[data-reveal]')!;
    expect(reveal.textContent).toContain(t('emergency.avulsion.text'));
    expect(reveal.textContent).toContain(t('emergency.avulsion.open'));
    expect(reveal.querySelector('[data-call-sheet] a')?.getAttribute('data-location')).toBe(
      'section',
    );
    // CSS shows it while the box is checked, as a later sibling of the box (`peer-checked:`):
    // with JavaScript or without, before hydration too, and without :has().
    expect(reveal.parentElement).toBe(box.parentElement);
    expect(box.compareDocumentPosition(reveal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.className.split(' ')).toContain('peer');
    expect(reveal.className.split(' ')).toEqual(
      expect.arrayContaining(['hidden', 'peer-checked:grid']),
    );
    expect(open.querySelector(`label[for="${box.id}"]`)?.textContent).toBe(
      t('emergency.triage.avulsion'),
    );
    const closed = (await render(CLOSED)).querySelector('[data-reveal]')!;
    expect(closed.textContent).toContain(t('emergency.avulsion.closed'));
    expect(closed.querySelector('a')).toBeNull();
  });

  it('T-EM5c the safety box keeps a warm warning surface in dark, and its heading wraps pretty', async () => {
    const box = (await render(OPEN)).querySelector('[data-section="safety"]')!;
    // Orange mixed into the navy surface is grey: dark mixes it into the warm surface instead.
    expect(box.className).toContain(
      'dark:bg-[color-mix(in_srgb,var(--color-warning-fill)_22%,var(--color-warm-soft))]',
    );
    expect(box.querySelector('h2')!.className.split(' ')).toContain('text-pretty');
  });

  it('T-EM16b the avulsion first aid sits in the warning box with its icon, never red or an alert', async () => {
    for (const clock of [OPEN, CLOSED]) {
      const reveal = (await render(clock)).querySelector('[data-reveal]')!;
      const box = reveal.firstElementChild!;
      const safety = (await render(clock)).querySelector('[data-section="safety"]')!;
      for (const token of ['border-warning-fill', 'rounded-card']) {
        expect(box.className.split(' ')).toContain(token);
      }
      expect(box.className).toContain(safety.className.match(/dark:bg-\S+/)![0]);
      expect(box.querySelector('svg use')?.getAttribute('href')).toMatch(/#warning$/);
      expect(box.textContent).toContain(t('emergency.avulsion.text'));
      expect(box.outerHTML).not.toMatch(/danger|role="alert"/);
    }
  });

  it('T-EM19 the clinic number in a failure or the repeat line is a call link, through the sheet', async () => {
    for (const outcome of ['server', 'neutral'] as const) {
      const doc = await render(OPEN, {
        flash: { form: 'emergency', to: '/اورژانس', outcome, at: 0, values: {}, triage: [] },
      });
      const notice = doc.querySelector('[data-section="form"] p[tabindex="-1"]')!;
      const link = notice.querySelector('a[href="tel:+982155101054"]');
      expect(link, outcome).not.toBeNull();
      expect(link!.getAttribute('dir')).toBe('ltr');
      expect(link!.closest('[data-call-sheet]')).not.toBeNull();
      expect(link!.getAttribute('data-track')).toBe('call_click');
      expect(link!.getAttribute('data-location')).toBe('section');
    }
  });

  it('T-EM3b the form: five boxes without `required`, tokens, honeypot, no booking-form marker', async () => {
    const doc = await render(OPEN);
    const form = doc.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('post');
    expect(form.getAttribute('action')).toBe('/اورژانس');
    const boxes = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="triage"]'));
    expect(boxes.map((b) => b.value)).toEqual([
      'severe_pain',
      'swelling',
      'broken',
      'avulsion',
      'bleeding',
    ]);
    expect(boxes.some((b) => b.hasAttribute('required'))).toBe(false);
    expect(form.querySelector<HTMLInputElement>('input[name="csrf"]')?.value).toBe('csrf-token');
    expect(form.querySelector<HTMLInputElement>('input[name="ts"]')?.value).toBe('v1.abc.sig');
    expect(form.querySelector('input[name="extra_7"]')?.closest('[aria-hidden="true"]')).not.toBe(
      null,
    );
    expect(doc.querySelector('[data-booking-form]:not([data-booking-form="dialog"])')).toBeNull();
    expect(form.querySelector('button[type="submit"]')?.textContent).toBe('ثبت درخواست فوری');
    expect(doc.querySelector('a[href="/رزرو-نوبت"]')?.textContent).toBe('نوبت عادی بگیرید');
    expect(doc.body.innerHTML).not.toMatch(/\sstyle=/);
  });

  it('T-EM15b a no-JS triage error keeps the values and focuses the first box', async () => {
    const doc = await render(CLOSED, {
      flash: {
        form: 'emergency',
        to: '/اورژانس',
        outcome: 'invalid',
        at: 0,
        values: { phone: '09121234567', name: 'نمونه', note: 'درد' },
        triage: [],
        errors: { triage: 'required' },
      },
    });
    expect(doc.body.textContent).toContain(t('emergency.triage.required'));
    const first = doc.querySelector('input[name="triage"]')!;
    expect(first.hasAttribute('autofocus')).toBe(true);
    expect(doc.querySelector('fieldset')?.getAttribute('aria-describedby')).toBe('em-triage-error');
    expect(doc.querySelector<HTMLInputElement>('#em-phone')?.value).toBe('09121234567');
    expect(doc.querySelector<HTMLTextAreaElement>('#em-note')?.textContent).toBe('درد');
  });

  it('T-EM18 a no-JS success: the heading, the server line, the number and the safety box again', async () => {
    const doc = await render(OPEN, {
      flash: {
        form: 'emergency',
        to: '/اورژانس',
        outcome: 'success',
        at: 0,
        callback: 'پذیرش معمولاً تا ۱۰ دقیقهٔ دیگر با شما تماس می‌گیرد.',
        masked: '۰۹۱۲ *** ۶۷۸۹',
      },
    });
    const form = doc.querySelector('[data-section="form"]')!;
    expect(form.querySelector('form')).toBeNull();
    expect(form.querySelector('h2')?.textContent).toBe('درخواست فوری شما ثبت شد.');
    expect(form.textContent).toContain('دقیقهٔ دیگر');
    expect(form.querySelector('bdi[dir="ltr"]')?.textContent).toBe('۰۹۱۲ *** ۶۷۸۹');
    expect(form.querySelector('a[href="tel:115"]')).not.toBeNull();
    // Focused and scrolled to by the browser after the 303 (EM-F14), before any script.
    expect(form.querySelector('h2')?.hasAttribute('autofocus')).toBe(true);
    // One named safety region: the repeat is no second landmark with the same name.
    expect(doc.querySelectorAll('[data-section="safety"]')).toHaveLength(2);
    expect(doc.querySelectorAll('[data-section="safety"][aria-labelledby]')).toHaveLength(1);
    // A direct GET always shows the form (EM-F15).
    expect((await render(OPEN)).querySelector('[data-section="form"] form')).not.toBeNull();
  });

  it('T-EM11 the booking dialog is on the page, without its link back here (G7, Q11)', async () => {
    for (const clock of [OPEN, CLOSED]) {
      const dialogs = (await render(clock)).querySelectorAll('dialog[data-booking-dialog]');
      expect(dialogs).toHaveLength(1);
      expect(dialogs[0]!.getAttribute('data-emergency-link')).toBe('false');
    }
  });

  it('EM-D8 with the form switched off the information stays and the form becomes a booking link', async () => {
    features = { emergencyEnabled: false };
    const doc = await render(OPEN);
    expect(sections(doc)).toEqual(['hero', 'call', 'safety', 'form', 'address']);
    expect(doc.querySelector('form')).toBeNull();
    expect(doc.querySelector('[data-section="form"] a')?.getAttribute('href')).toBe('/رزرو-نوبت');
  });

  it('EM-S1 self-care renders only with its blocks and a reviewing dentist', async () => {
    const blocks = [{ blockType: 'content', body: { root: { children: [] } } }];
    expect(sections(await render(OPEN, { page: { blocks } as never }))).not.toContain('self-care');
    const doc = await render(OPEN, {
      page: {
        blocks,
        reviewer: { id: 2, name: 'نمونه' },
        sources: [{ title: 'NHS', url: 'https://www.nhs.uk/' }],
      } as never,
    });
    expect(sections(doc)).toEqual(['hero', 'call', 'safety', 'form', 'self-care', 'address']);
    expect(doc.querySelector('[data-section="self-care"]')?.textContent).toContain('دکتر نمونه');
  });

  it('SEO: one H1 and a BreadcrumbList of home and this page', async () => {
    const doc = await render(OPEN);
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    const ld = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    const crumbs = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'BreadcrumbList');
    expect(crumbs.itemListElement.map((i: { name: string }) => i.name)).toEqual([
      'خانه',
      'درد شدید دندان دارید؟',
    ]);
  });
});
