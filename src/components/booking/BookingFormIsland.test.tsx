import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FormSession } from '@/components/chrome/formSession';
import { PHONE_ERRORS } from '@/lib/phone';
import { track } from '@/lib/track/track';

import { BookingFormIsland, type BookingLabels } from './BookingFormIsland';

const SESSION: FormSession = {
  csrf: 'csrf-token',
  ts: 'v1.abc.sig',
  ttlSeconds: 7200,
  hours: {
    state: 'open',
    callsAllowed: true,
    showClosedSheet: false,
    nextChangeAt: '2026-10-15T16:00:00.000Z',
    copy: {
      callback: 'پذیرش معمولاً تا ۱۰ دقیقهٔ دیگر با شما تماس می‌گیرد.',
      closedSheet: null,
      emergencyClosedLine: null,
    },
  },
};

vi.mock('@/components/chrome/formSession', () => ({
  getFormSession: vi.fn(() => Promise.resolve(SESSION)),
}));
vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));

const LABELS: BookingLabels = {
  phone: 'شمارهٔ موبایل',
  phoneHelp: 'مثلاً',
  submit: 'ثبت درخواست',
  submitting: 'در حال ثبت',
  done: 'درخواست شما ثبت شد',
  registered: 'شمارهٔ ثبت‌شده:',
  errors: { ...PHONE_ERRORS, noteTooLong: 'توضیح بیشتر از ۵۰۰ حرف است. آن را کوتاه‌تر کنید.' },
  failed: { network: 'ارسال انجام نشد.', server: 'مشکلی در سایت پیش آمد.' },
};

const FULL: BookingLabels = {
  ...LABELS,
  note: { summary: 'توضیح بیشتر', label: 'توضیح (اختیاری)', help: 'مثلاً' },
  fallback: { before: 'یا با', after: 'تماس بگیرید.', phone: '۰۲۱ ۵۵۱۰ ۱۰۵۴', href: 'tel:+98' },
};

function island(variant: 'compact' | 'full' = 'compact', instance = 'hero') {
  return (
    <BookingFormIsland
      variant={variant}
      instance={instance}
      action="/رزرو-نوبت"
      labels={variant === 'full' ? FULL : LABELS}
      header={<h2 id={`bk-${instance}-title`}>درخواست نوبت</h2>}
      hidden={<input type="hidden" name="location" defaultValue={instance} />}
      privacy={<p>privacy</p>}
      icons={{ error: <i data-icon="error" />, check: <i data-icon="check" /> }}
      success={<p>save</p>}
    />
  );
}

const phone = () => screen.getByLabelText('شمارهٔ موبایل') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: /ثبت درخواست|در حال ثبت/ });

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  vi.mocked(track).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('booking form island (conversion.md 5.1-5.4)', () => {
  it('BF1 server HTML: required phone LTR island, no novalidate, no token, no hours sentence', () => {
    const html = renderToStaticMarkup(island('full', 'block'));
    expect(html).toMatch(/<input[^>]*id="bk-block-phone"[^>]*required/);
    expect(html).toMatch(/type="tel"[^>]*inputMode="numeric"|inputMode="numeric"[^>]*type="tel"/);
    expect(html).toContain('dir="ltr"');
    expect(html).not.toContain('novalidate');
    expect(html).not.toContain(SESSION.csrf);
    expect(html).not.toContain('دقیقهٔ دیگر');
    expect(html).toContain('data-booking-form="block"');
    expect(html).toContain('action="/رزرو-نوبت"');
    expect(html).not.toMatch(/\sstyle=/);
    // Only the full form is a named landmark: home's two instances share the heading.
    expect(html).toMatch(/<form[^>]*aria-labelledby="bk-block-title"/);
    expect(renderToStaticMarkup(island())).not.toMatch(/<form[^>]*aria-labelledby/);
  });

  it('BF2 an empty submit shows the empty message, marks the field and focuses it', async () => {
    render(island());
    await act(() => Promise.resolve());
    fireEvent.submit(phone().form!);
    await screen.findByText(PHONE_ERRORS.empty, { selector: 'span' });
    expect(phone().getAttribute('aria-invalid')).toBe('true');
    expect(phone().getAttribute('aria-describedby')).toBe('bk-hero-phone-help bk-hero-phone-error');
    expect(document.activeElement).toBe(phone());
    expect(phone().form!.noValidate).toBe(true);
  });

  it('BF3 blur validates a typed value (landline, invalid) and skips an empty field', () => {
    render(island());
    fireEvent.blur(phone(), { target: { value: '' } });
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    fireEvent.change(phone(), { target: { value: '021 5510 1054' } });
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '0912' } });
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.invalid)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '۰۹۱۲ ۳۴۵ ۶۷۸۹' } });
    fireEvent.blur(phone());
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    expect(phone().getAttribute('aria-describedby')).toBe('bk-hero-phone-help');
  });

  it('BF4 no blur validation while the submit is pressed (the message would move the button)', () => {
    render(island());
    fireEvent.change(phone(), { target: { value: '0912' } });
    fireEvent.pointerDown(submit());
    fireEvent.blur(phone());
    expect(screen.queryByText(PHONE_ERRORS.invalid)).toBeNull();
  });

  it('BF4b a press dragged off the submit (no click on it) leaves blur validation on', () => {
    render(island());
    fireEvent.change(phone(), { target: { value: '0912' } });
    fireEvent.pointerDown(submit());
    // Released elsewhere: the browser clicks the common ancestor, not the button.
    fireEvent.click(document.body);
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.invalid)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '021 5510 1054' } });
    fireEvent.pointerDown(submit());
    // No click at all: the next press elsewhere ends it.
    fireEvent.pointerDown(document.body);
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
  });

  it('BF5 a note over 500 characters opens the note and shows its message', async () => {
    render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    const note = screen.getByLabelText('توضیح (اختیاری)');
    fireEvent.change(note, { target: { value: 'ا'.repeat(501) } });
    expect(screen.getByText('۵۰۱/۵۰۰')).toBeTruthy();
    fireEvent.submit(phone().form!);
    await screen.findByText(FULL.errors.noteTooLong, { selector: 'span' });
    expect((note.closest('details') as HTMLDetailsElement).open).toBe(true);
    expect(document.activeElement).toBe(note);
  });

  it('BF6 a JSON ok answer shows the success in place: heading focus, callback, masked number', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = render(island());
    await act(() => Promise.resolve());
    fireEvent.change(phone(), { target: { value: '0912 345 6789' } });
    fireEvent.submit(phone().form!);
    const heading = await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const root = container.querySelector('#bk-hero') as HTMLElement;
    expect(root.dataset.state).toBe('success');
    // The hero card leaves the chrome's booking route: «رزرو نوبت» now goes to the block.
    expect(root.hasAttribute('data-booking-form')).toBe(false);
    expect(root.textContent).toContain(SESSION.hours.copy.callback);
    expect(root.textContent).toContain('۰۹۱۲ ••• ۶۷۸۹');
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('csrf')).toBe(SESSION.csrf);
    expect(body.get('ts')).toBe(SESSION.ts);
    expect(body.get('location')).toBe('hero');
  });

  it('BF7 only a 404 or 405 (no handler yet) falls back to the native POST', async () => {
    const native = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    for (const status of [404, 405]) {
      native.mockClear();
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status })));
      const { unmount } = render(island());
      fireEvent.change(phone(), { target: { value: '09123456789' } });
      fireEvent.submit(phone().form!);
      await waitFor(() => expect(native).toHaveBeenCalledTimes(1));
      expect(submit().getAttribute('aria-busy')).toBe('true');
      unmount();
    }
  });

  it('BF7b a handler that answered is never posted again: the send failure shows instead', async () => {
    const native = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    const answers: Array<[() => Promise<Response>, string]> = [
      [() => Promise.resolve(new Response('', { status: 500 })), LABELS.failed.server as string],
      [() => Promise.resolve(new Response('', { status: 419 })), LABELS.failed.server as string],
      // A followed redirect to an HTML page (PRG): stored, but not the JSON phase 5 must answer.
      [
        () => Promise.resolve(new Response('<html>', { status: 200 })),
        LABELS.failed.server as string,
      ],
      [() => Promise.reject(new TypeError('Failed to fetch')), LABELS.failed.network as string],
    ];
    for (const [answer, message] of answers) {
      const fetchMock = vi.fn(answer);
      vi.stubGlobal('fetch', fetchMock);
      const { unmount } = render(island());
      fireEvent.change(phone(), { target: { value: '09123456789' } });
      fireEvent.submit(phone().form!);
      expect((await screen.findByRole('alert')).textContent).toContain(message);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(submit().hasAttribute('aria-busy')).toBe(false);
      expect(phone().value).toBe('09123456789');
      unmount();
    }
    expect(native).not.toHaveBeenCalled();
  });

  it('BF8 the hero field sends booking_open once, and never after a chrome CTA moved focus', () => {
    const { unmount } = render(island());
    fireEvent.focus(phone());
    fireEvent.blur(phone());
    fireEvent.focus(phone());
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('booking_open', { location: 'hero' });
    unmount();
    vi.mocked(track).mockClear();
    const { container } = render(island());
    container.querySelector('#bk-hero')!.setAttribute('data-booking-opened', '');
    fireEvent.focus(phone());
    expect(track).not.toHaveBeenCalled();
  });

  it('BF9 the phone fallback line shows only while calls are allowed, in a reserved box', async () => {
    const { container } = render(island('full', 'block'));
    const line = container.querySelector('p.min-h-\\[1lh\\]') as HTMLElement;
    expect(line.textContent).toBe('');
    await waitFor(() => expect(line.textContent).toContain('۰۲۱ ۵۵۱۰ ۱۰۵۴'));
  });

  it('BF10 a second submit while the first is in flight sends nothing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    fireEvent.submit(phone().form!);
    await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
