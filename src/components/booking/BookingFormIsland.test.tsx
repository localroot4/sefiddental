import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  getFormSession,
  renewFormSession,
  type FormSession,
} from '@/components/chrome/formSession';
import { submitClasses } from '@/components/ui/Button';
import { MIN_AGE_MS } from '@/lib/formTokens';
import { PHONE_ERRORS } from '@/lib/phone';
import { track } from '@/lib/track/track';

import {
  BookingFormIsland,
  TOKEN_MIN_AGE_MS,
  type BookingInitial,
  type BookingLabels,
} from './BookingFormIsland';

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
  // Long past the time trap: no submit waits unless a test says so.
  receivedAt: 0,
};
const RENEWED: FormSession = { ...SESSION, csrf: 'csrf-renewed', ts: 'v1.def.sig' };
const SERVER_CALLBACK = 'پذیرش امروز از ساعت ۱۰ با شما تماس می‌گیرد.';

vi.mock('@/components/chrome/formSession', () => ({
  getFormSession: vi.fn(() => Promise.resolve(SESSION)),
  renewFormSession: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));

const LABELS: BookingLabels = {
  phone: 'شمارهٔ موبایل',
  phoneHelp: 'مثلاً',
  submit: 'ثبت درخواست',
  submitting: 'در حال ثبت',
  done: 'درخواست شما ثبت شد',
  registered: 'شمارهٔ ثبت‌شده:',
  callbackGeneric: 'پذیرش در ساعات کاری با شما تماس می‌گیرد.',
  errors: { ...PHONE_ERRORS, noteTooLong: 'توضیح بیشتر از ۵۰۰ حرف است. آن را کوتاه‌تر کنید.' },
  notices: {
    network: 'ارسال انجام نشد.',
    server: 'مشکلی در سایت پیش آمد.',
    expired: 'صفحه مدت زیادی باز مانده بود و درخواست ثبت نشد.',
    name: 'نام بیشتر از ۸۰ حرف است.',
    neutral: 'درخواست شما قبلاً ثبت شده است.',
    retry: 'درخواست هنوز ثبت نشده است.',
  },
};

const FULL: BookingLabels = {
  ...LABELS,
  note: { summary: 'توضیح بیشتر', label: 'توضیح (اختیاری)', help: 'مثلاً' },
  fallback: { before: 'یا با', after: 'تماس بگیرید.', phone: '۰۲۱ ۵۵۱۰ ۱۰۵۴', href: 'tel:+98' },
};

function island(
  variant: 'compact' | 'full' = 'compact',
  instance = 'hero',
  extra: { tokens?: { csrf: string; ts: string }; initial?: BookingInitial } = {},
) {
  return (
    <BookingFormIsland
      variant={variant}
      instance={instance}
      action="/رزرو-نوبت"
      labels={variant === 'full' ? FULL : LABELS}
      header={<h2 id={`bk-${instance}-title`}>درخواست نوبت</h2>}
      fields={
        variant === 'full' ? (
          <>
            <input name="name" aria-label="name" defaultValue="" />
            <input type="radio" name="time_pref" value="morning" aria-label="morning" />
          </>
        ) : null
      }
      hidden={
        <>
          <input type="hidden" name="location" defaultValue={instance} />
          <input type="hidden" name="tier" defaultValue="" />
        </>
      }
      privacy={<p>privacy</p>}
      icons={{
        error: <i data-icon="error" />,
        info: <i data-icon="info" />,
        check: <i data-icon="check" />,
        spinner: <i data-icon="spinner" />,
      }}
      submitClass={submitClasses()}
      success={<p>save</p>}
      {...extra}
    />
  );
}

const phone = () => screen.getByLabelText('شمارهٔ موبایل') as HTMLInputElement;
const submit = () => screen.getByRole('button', { name: /ثبت درخواست|در حال ثبت/ });
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
const calls = (event: string) => vi.mocked(track).mock.calls.filter(([name]) => name === event);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  vi.mocked(track).mockClear();
  vi.mocked(getFormSession).mockImplementation(() => Promise.resolve(SESSION));
  vi.mocked(renewFormSession).mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it('BF4d a shown error clears as soon as the value is valid, before the blur (no shift under a click)', () => {
    render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '021 5510 1054' } });
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
    // Still invalid while typing: the message stays until the blur says otherwise.
    fireEvent.change(phone(), { target: { value: '0912' } });
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    expect(screen.queryByText(PHONE_ERRORS.landline)).toBeNull();
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    const note = screen.getByLabelText('توضیح (اختیاری)');
    fireEvent.change(note, { target: { value: 'ا'.repeat(501) } });
    fireEvent.blur(note);
    expect(note.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(note, { target: { value: 'ا'.repeat(500) } });
    expect(note.hasAttribute('aria-invalid')).toBe(false);
  });

  it('BF4c the note skips blur validation while the submit is pressed too', () => {
    render(island('full', 'block'));
    const note = screen.getByLabelText('توضیح (اختیاری)');
    fireEvent.change(note, { target: { value: 'ا'.repeat(501) } });
    fireEvent.pointerDown(submit());
    fireEvent.blur(note);
    expect(note.hasAttribute('aria-invalid')).toBe(false);
    expect(calls('booking_error')).toEqual([]);
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

  it("BF6 success shows in place with the server's callback line and masked number", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({ ok: true, state: 'success', callback: SERVER_CALLBACK, masked: '۰۹۱۲ ••• ۰۰۰۰' }),
      );
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
    // The server's line at submit time (G6), never the session copy taken at mount.
    expect(root.textContent).toContain(SERVER_CALLBACK);
    expect(root.textContent).not.toContain(SESSION.hours.copy.callback);
    expect(root.textContent).toContain('۰۹۱۲ ••• ۰۰۰۰');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(decodeURI(new URL(url, 'http://x').pathname)).toBe('/رزرو-نوبت');
    expect(new Headers(init.headers).get('accept')).toBe('application/json');
    const body = init.body as FormData;
    expect(body.get('csrf')).toBe(SESSION.csrf);
    expect(body.get('ts')).toBe(SESSION.ts);
    expect(body.get('location')).toBe('hero');
    expect(calls('booking_success')).toEqual([
      ['booking_success', { location: 'hero', duplicate: false }],
    ]);
  });

  it('BF6b a success without a callback line shows the generic one and the local mask', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ok: true, callback: null })));
    const { container } = render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    const root = container.querySelector('#bk-hero') as HTMLElement;
    expect(root.textContent).toContain(LABELS.callbackGeneric);
    expect(root.textContent).toContain('۰۹۱۲ ••• ۶۷۸۹');
  });

  it('BF7 no answer is ever re-posted natively, a 404 or 405 included (X6)', async () => {
    const native = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    for (const status of [404, 405]) {
      const fetchMock = vi.fn().mockResolvedValue(new Response('<html>', { status }));
      vi.stubGlobal('fetch', fetchMock);
      const { unmount } = render(island());
      fireEvent.change(phone(), { target: { value: '09123456789' } });
      fireEvent.submit(phone().form!);
      expect((await screen.findByRole('alert')).textContent).toContain(LABELS.notices.server);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      unmount();
    }
    expect(native).not.toHaveBeenCalled();
  });

  it('BF7b a handler that answered is never posted again: the send failure shows instead', async () => {
    const native = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    const answers: Array<[() => Promise<Response>, string, string]> = [
      [() => Promise.resolve(new Response('', { status: 500 })), 'server', 'server'],
      [() => Promise.resolve(new Response(null, { status: 403 })), 'server', 'server'],
      [() => Promise.resolve(new Response(null, { status: 413 })), 'server', 'server'],
      // A followed redirect to an HTML page (PRG): not the JSON the handler answers.
      [() => Promise.resolve(new Response('<html>', { status: 200 })), 'server', 'server'],
      [() => Promise.reject(new TypeError('Failed to fetch')), 'network', 'network'],
    ];
    for (const [answer, notice, errorType] of answers) {
      vi.mocked(track).mockClear();
      const fetchMock = vi.fn(answer);
      vi.stubGlobal('fetch', fetchMock);
      const { unmount } = render(island());
      fireEvent.change(phone(), { target: { value: '09123456789' } });
      fireEvent.submit(phone().form!);
      expect((await screen.findByRole('alert')).textContent).toContain(
        LABELS.notices[notice as 'server' | 'network'] as string,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(submit().hasAttribute('aria-busy')).toBe(false);
      expect(phone().value).toBe('09123456789');
      expect(calls('booking_error')).toEqual([
        ['booking_error', { location: 'hero', error_type: errorType }],
      ]);
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
    const { container } = render(island('full', 'dialog'));
    const line = container.querySelector('p.min-h-\\[1lh\\]') as HTMLElement;
    expect(line.textContent).toBe('');
    await waitFor(() => expect(line.textContent).toContain('۰۲۱ ۵۵۱۰ ۱۰۵۴'));
    // BF-LOC: the call link counts for this instance, not a fixed one.
    expect(line.querySelector('a')?.getAttribute('data-location')).toBe('dialog');
  });

  it('BF10 a second submit while the first is in flight sends nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    fireEvent.submit(phone().form!);
    await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('BF11 a 419 shows its message, keeps the values, renews the token and waits for a press', async () => {
    vi.mocked(renewFormSession).mockImplementation(async () => {
      vi.mocked(getFormSession).mockImplementation(() => Promise.resolve(RENEWED));
      return RENEWED;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ ok: false, error: 'expired' }, 419))
      .mockResolvedValueOnce(json({ ok: true, callback: SERVER_CALLBACK }));
    vi.stubGlobal('fetch', fetchMock);
    render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'نمونه' } });
    fireEvent.submit(phone().form!);
    expect((await screen.findByRole('alert')).textContent).toContain(LABELS.notices.expired);
    expect(renewFormSession).toHaveBeenCalledWith(SESSION.ts);
    expect(phone().value).toBe('09123456789');
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('نمونه');
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(fetchMock).toHaveBeenCalledTimes(1); // no automatic resubmit
    expect(calls('booking_error')).toEqual([
      ['booking_error', { location: 'block', error_type: 'expired' }],
    ]);
    fireEvent.submit(phone().form!);
    await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = fetchMock.mock.calls[1]?.[1]?.body as FormData;
    expect(body.get('ts')).toBe(RENEWED.ts);
    expect(body.get('csrf')).toBe(RENEWED.csrf);
  });

  it('BF12 server field errors show inline with aria-invalid, focus the first, one event each', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          json({ ok: false, errors: { phone: 'landline', note: 'too_long' } }, 422),
        ),
    );
    render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    await screen.findByText(PHONE_ERRORS.landline, { selector: 'span' });
    expect(phone().getAttribute('aria-invalid')).toBe('true');
    expect(phone().getAttribute('aria-describedby')).toContain('bk-block-phone-error');
    const note = screen.getByLabelText('توضیح (اختیاری)');
    expect(note.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(phone());
    expect(calls('booking_error').map(([, params]) => params)).toEqual([
      { location: 'block', error_type: 'phone_landline' },
      { location: 'block', error_type: 'note_too_long' },
    ]);
  });

  it('BF13 a duplicate is an info state: values kept (full), in place (compact)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => json({ ok: true, state: 'neutral', duplicate: true })),
    );
    const { unmount } = render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain(LABELS.notices.neutral),
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(phone().value).toBe('09123456789');
    expect(submit().hasAttribute('aria-busy')).toBe(false);
    expect(calls('booking_success')).toEqual([
      ['booking_success', { location: 'block', duplicate: true }],
    ]);
    unmount();
    const { container } = render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    const root = container.querySelector('#bk-hero') as HTMLElement;
    await waitFor(() => expect(root.dataset.state).toBe('neutral'));
    expect(root.hasAttribute('data-booking-form')).toBe(false);
    expect(root.textContent).toContain('۰۹۱۲ ••• ۶۷۸۹');
    await waitFor(() => expect(document.activeElement?.textContent).toBe(LABELS.notices.neutral));
  });

  it('BF14 a token younger than 2 s holds the POST with the button loading (G5)', async () => {
    expect(TOKEN_MIN_AGE_MS).toBe(MIN_AGE_MS);
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    vi.mocked(getFormSession).mockImplementation(() =>
      Promise.resolve({ ...SESSION, receivedAt: Date.now() - 500 }),
    );
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    await act(async () => {
      fireEvent.submit(phone().form!);
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(submit().textContent).toBe(LABELS.submitting);
    await act(() => vi.advanceTimersByTimeAsync(600));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('BF15 the booking page keeps its own tokens and counts its view once', async () => {
    const tokens = { csrf: 'page-csrf', ts: 'v1.page.sig' };
    expect(renderToStaticMarkup(island('full', 'page', { tokens }))).toMatch(
      /name="ts" value="v1\.page\.sig"/,
    );
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    // Issued with the HTML, timed from hydration: the hold must not pass before 2 s.
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    render(island('full', 'page', { tokens }));
    expect(calls('booking_open')).toEqual([['booking_open', { location: 'page' }]]);
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    await act(async () => {
      fireEvent.submit(phone().form!);
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(TOKEN_MIN_AGE_MS));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get('csrf')).toBe('page-csrf');
    expect(body.get('ts')).toBe('v1.page.sig');
  });

  it('BF18 closing the dialog (Esc, «بستن») leaves no blur error and sends no booking_error', () => {
    const dialog = document.body.appendChild(document.createElement('dialog'));
    onTestFinished(() => dialog.remove());
    dialog.setAttribute('open', '');
    const close = dialog.appendChild(document.createElement('button'));
    close.setAttribute('command', 'close');
    render(island('full', 'dialog'), {
      container: dialog.appendChild(document.createElement('div')),
    });
    fireEvent.change(phone(), { target: { value: '0912' } });
    // A press on «بستن» takes the focus first (Chrome), then Esc-like: the dialog already closed.
    fireEvent.blur(phone(), { relatedTarget: close });
    dialog.removeAttribute('open');
    fireEvent.blur(phone());
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    expect(calls('booking_error')).toEqual([]);
    // Open, a blur that goes on to another field validates as anywhere else.
    dialog.setAttribute('open', '');
    fireEvent.blur(phone());
    expect(phone().getAttribute('aria-invalid')).toBe('true');
  });

  it('BF19 a server name error shows its line, focuses the name and sends one booking_error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ ok: false, errors: { name: 'too_long' } }, 422)),
    );
    render(island('full', 'block'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(phone().form!);
    expect((await screen.findByRole('alert')).textContent).toContain(LABELS.notices.name);
    expect(document.activeElement).toBe(screen.getByLabelText('name'));
    expect(calls('booking_error')).toEqual([
      ['booking_error', { location: 'block', error_type: 'name_too_long' }],
    ]);
  });

  it('BF16 a no-JS post comes back with its values, errors and message (the flash)', () => {
    const html = renderToStaticMarkup(
      island('full', 'page', {
        initial: { phone: '021 5510 1054', note: 'ا', phoneError: 'landline', notice: 'retry' },
      }),
    );
    expect(html).toMatch(/id="bk-page-phone"[^>]*value="021 5510 1054"/);
    expect(html).toMatch(
      /aria-invalid="true"[^>]*aria-describedby="bk-page-phone-help bk-page-phone-error"/,
    );
    expect(html).toContain(PHONE_ERRORS.landline);
    expect(html).toMatch(/<details[^>]*open=""/);
    expect(html).toMatch(/<div role="status"><div[^>]*>.*درخواست هنوز ثبت نشده است\./);
  });

  it('BF17 booking_submit once per press: instance, has_name, time_pref, tier; never the person', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    render(island('full', 'dialog'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'نمونه' } });
    fireEvent.click(screen.getByLabelText('morning'));
    fireEvent.submit(phone().form!);
    await screen.findByRole('heading', { name: 'درخواست شما ثبت شد' });
    expect(calls('booking_submit')).toEqual([
      [
        'booking_submit',
        { location: 'dialog', has_name: true, time_pref: 'morning', tier: 'none' },
      ],
    ]);
    const sent = JSON.stringify(vi.mocked(track).mock.calls);
    expect(sent).not.toMatch(/0912|۰۹۱۲|نمونه/);
  });
});
