import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renewFormSession, type FormSession } from '@/components/chrome/formSession';
import { submitClasses } from '@/components/ui/Button';
import { PHONE_ERRORS } from '@/lib/phone';
import { track } from '@/lib/track/track';

import {
  EmergencyFormIsland,
  type EmergencyInitial,
  type EmergencyLabels,
} from './EmergencyFormIsland';

vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));
vi.mock('@/components/chrome/formSession', () => ({ renewFormSession: vi.fn() }));

const TRIAGE_REQUIRED = 'یکی از موارد را انتخاب کنید. اگر هیچ‌کدام درست نیست، نوبت عادی بگیرید.';
const LABELS: EmergencyLabels = {
  legend: 'کدام مورد دربارهٔ شما درست است؟',
  triage: [
    ['severe_pain', 'درد شدید'],
    ['swelling', 'ورم'],
    ['broken', 'شکسته'],
    ['avulsion', 'درآمده'],
    ['bleeding', 'خونریزی'],
  ],
  phone: 'شمارهٔ موبایل',
  phoneHelp: 'مثلاً',
  name: 'نام (اختیاری)',
  note: { summary: 'توضیح بیشتر', label: 'توضیح (اختیاری)' },
  submit: 'ثبت درخواست فوری',
  submitting: 'در حال ثبت',
  done: 'درخواست فوری شما ثبت شد.',
  registered: 'شمارهٔ ثبت‌شده:',
  callbackGeneric: 'پذیرش در ساعات کاری با شما تماس می‌گیرد.',
  errors: {
    ...PHONE_ERRORS,
    noteTooLong: 'توضیح بلند است.',
    nameTooLong: 'نام بلند است.',
    triage: TRIAGE_REQUIRED,
  },
  notices: {
    expired: 'منقضی «ثبت درخواست فوری»',
    retry: 'دوباره',
    network: 'ارسال انجام نشد.',
    server: 'مشکلی در سایت پیش آمد.',
    neutral: 'امروز یک درخواست فوری با این شماره ثبت شده است.',
  },
};
const EMPTY: EmergencyInitial = {
  values: { phone: '', name: '', note: '' },
  triage: [],
  errors: {},
  notice: null,
  done: null,
};

function island(initial: EmergencyInitial = EMPTY) {
  return (
    <EmergencyFormIsland
      action="/اورژانس"
      openState="open"
      labels={LABELS}
      initial={initial}
      header={<h2 id="em-title">درخواست فوری</h2>}
      avulsion={<p>first aid</p>}
      none={<span>none</span>}
      hidden={
        <>
          <input type="hidden" name="csrf" defaultValue="csrf-1" />
          <input type="hidden" name="ts" defaultValue="v1.old.sig" />
        </>
      }
      privacy={<p>privacy</p>}
      aboveSubmit={null}
      icons={{
        error: <i />,
        info: <i />,
        check: <i />,
        chevron: <i />,
        spinner: <i />,
        tick: <i data-icon="tick" />,
      }}
      submitClass={submitClasses()}
      success={<p>safety again</p>}
      cardClassName="card"
    />
  );
}

const phone = () => screen.getByLabelText('شمارهٔ موبایل') as HTMLInputElement;
const box = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const form = () => phone().form!;
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // Fake time also runs with real time, so Testing Library's polling still settles.
  vi.useFakeTimers({ toFake: ['setTimeout', 'Date'], shouldAdvanceTime: true });
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
  vi.mocked(track).mockClear();
  vi.mocked(renewFormSession).mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** A valid form: one box and a phone, then the submit, past the 2 s hold. */
async function send(boxes = ['ورم']) {
  for (const name of boxes) fireEvent.click(box(name));
  fireEvent.change(phone(), { target: { value: '۰۹۱۲ ۳۴۵ ۶۷۸۹' } });
  fireEvent.submit(form());
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

describe('emergency form island (conversion.md 7.3, 5.1-5.4)', () => {
  it('EF1 no box: the triage message, focus on the first box, nothing posted', async () => {
    render(island());
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(form());
    // The message, and the same text in the polite status line.
    await screen.findByText(TRIAGE_REQUIRED, { selector: 'span' });
    expect(document.activeElement).toBe(box('درد شدید'));
    expect(form().querySelector('fieldset')?.getAttribute('aria-describedby')).toBe(
      'em-triage-error',
    );
    expect(fetchMock).not.toHaveBeenCalled();
    // A ticked box clears it.
    fireEvent.click(box('ورم'));
    expect(screen.queryByText(TRIAGE_REQUIRED, { selector: 'span' })).toBeNull();
  });

  it('EF2 the POST waits until 2 s after the tokens arrived (freeze G5)', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { ok: true, state: 'success', callback: 'x', masked: 'y' }),
    );
    render(island());
    fireEvent.click(box('ورم'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(form());
    await act(() => vi.advanceTimersByTimeAsync(1900));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button').textContent).toBe('در حال ثبت');
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(decodeURI(String(url))).toContain('/اورژانس');
    expect((init as RequestInit).headers).toEqual({ accept: 'application/json' });
    const body = (init as RequestInit).body as FormData;
    expect(body.getAll('triage')).toEqual(['swelling']);
    expect(body.get('csrf')).toBe('csrf-1');
  });

  it('EF3 success: the server line, the masked number, the safety box, one emergency_submit', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { ok: true, state: 'success', callback: 'پذیرش فردا', masked: '۰۹۱۲ *** ۶۷۸۹' }),
    );
    render(island());
    await send(['ورم', 'درآمده']);
    const heading = await screen.findByRole('heading', { name: 'درخواست فوری شما ثبت شد.' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText('پذیرش فردا')).toBeTruthy();
    expect(screen.getByText('۰۹۱۲ *** ۶۷۸۹').getAttribute('dir')).toBe('ltr');
    expect(screen.getByText('safety again')).toBeTruthy();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('emergency_submit', { open_state: 'open', items_count: 2 });
  });

  it('EF4 a success without a callback line shows the generic line', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { ok: true, state: 'success', callback: null, masked: 'm' }),
    );
    render(island());
    await send();
    expect(await screen.findByText(LABELS.callbackGeneric)).toBeTruthy();
  });

  it('EF5 a second emergency: the info state, values kept, no event, no error role', async () => {
    fetchMock.mockResolvedValue(answer(200, { ok: true, state: 'neutral', duplicate: true }));
    render(island());
    await send();
    const info = await screen.findByRole('status', { name: '' });
    await waitFor(() => expect(info.textContent).toContain(LABELS.notices.neutral as string));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(phone().value).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
    expect(box('ورم').checked).toBe(true);
    expect(track).not.toHaveBeenCalled();
  });

  it('EF6 419: the message, a renewed token, values kept, the next press 2 s after its arrival', async () => {
    fetchMock
      .mockResolvedValueOnce(answer(419, { ok: false, error: 'expired' }))
      .mockResolvedValueOnce(
        answer(200, { ok: true, state: 'success', callback: 'c', masked: 'm' }),
      );
    // The server may answer a fresh token, not the pre-aged one (K-RENEW): the hold restarts.
    vi.mocked(renewFormSession).mockImplementation(async () => ({
      ...({} as FormSession),
      csrf: 'csrf-2',
      ts: 'v1.new.sig',
      receivedAt: Date.now(),
    }));
    render(island());
    await send();
    expect((await screen.findByRole('alert')).textContent).toContain('«ثبت درخواست فوری»');
    expect(renewFormSession).toHaveBeenCalledWith('v1.old.sig');
    expect((form().elements.namedItem('ts') as HTMLInputElement).value).toBe('v1.new.sig');
    expect(phone().value).toBe('۰۹۱۲ ۳۴۵ ۶۷۸۹');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no automatic resubmit
    fireEvent.submit(form());
    await act(() => vi.advanceTimersByTimeAsync(1900));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(((fetchMock.mock.calls[1]![1] as RequestInit).body as FormData).get('csrf')).toBe(
      'csrf-2',
    );
  });

  it('EF7 422: the server field errors in place, focus on the first', async () => {
    fetchMock.mockResolvedValue(answer(422, { ok: false, errors: { phone: 'landline' } }));
    render(island());
    await send();
    await screen.findByText(PHONE_ERRORS.landline, { selector: 'span' });
    expect(phone().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(phone());
  });

  it.each([
    ['server', () => Promise.resolve(answer(500, { ok: false, error: 'server' })), 'مشکلی در سایت'],
    ['network', () => Promise.reject(new TypeError('offline')), 'ارسال انجام نشد.'],
  ])('EF8 %s failure: its message, the button back, never re-posted', async (_, reply, text) => {
    fetchMock.mockImplementation(reply);
    render(island());
    await send();
    expect((await screen.findByRole('alert')).textContent).toContain(text);
    expect(screen.getByRole('button').textContent).toBe('ثبت درخواست فوری');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('EF9 a double press posts once', async () => {
    fetchMock.mockResolvedValue(
      answer(200, { ok: true, state: 'success', callback: 'c', masked: 'm' }),
    );
    render(island());
    fireEvent.click(box('ورم'));
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    fireEvent.submit(form());
    fireEvent.submit(form());
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('EF10 blur validates the phone, never while the submit is pressed', () => {
    render(island());
    fireEvent.change(phone(), { target: { value: '021 5510 1054' } });
    fireEvent.pointerDown(screen.getByRole('button'));
    fireEvent.blur(phone());
    expect(screen.queryByText(PHONE_ERRORS.landline)).toBeNull();
    fireEvent.click(document.body);
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
  });

  it('EF10c a shown phone message clears as soon as the number is valid, before the blur', () => {
    render(island());
    fireEvent.change(phone(), { target: { value: '021 5510 1054' } });
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '0912' } });
    expect(screen.getByText(PHONE_ERRORS.landline)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '09123456789' } });
    expect(screen.queryByText(PHONE_ERRORS.landline)).toBeNull();
  });

  it('EF10b no blur message while the submit is pressed; an emptied phone keeps no old message', () => {
    render(island());
    const name = screen.getByLabelText('نام (اختیاری)');
    const note = screen.getByLabelText('توضیح (اختیاری)');
    fireEvent.change(name, { target: { value: 'ن'.repeat(81) } });
    fireEvent.change(note, { target: { value: 'ت'.repeat(501) } });
    fireEvent.pointerDown(screen.getByRole('button'));
    fireEvent.blur(name);
    fireEvent.blur(note);
    expect(screen.queryByText(LABELS.errors.nameTooLong)).toBeNull();
    expect(screen.queryByText(LABELS.errors.noteTooLong)).toBeNull();
    fireEvent.click(document.body);
    fireEvent.blur(name);
    fireEvent.blur(note);
    expect(screen.getByText(LABELS.errors.nameTooLong)).toBeTruthy();
    expect(screen.getByText(LABELS.errors.noteTooLong)).toBeTruthy();

    // An untouched empty phone stays quiet; once a message shows it follows the value.
    fireEvent.blur(phone());
    expect(phone().hasAttribute('aria-invalid')).toBe(false);
    fireEvent.change(phone(), { target: { value: '0912' } });
    fireEvent.blur(phone());
    expect(screen.getByText(PHONE_ERRORS.invalid)).toBeTruthy();
    fireEvent.change(phone(), { target: { value: '' } });
    fireEvent.blur(phone());
    expect(screen.queryByText(PHONE_ERRORS.invalid)).toBeNull();
    expect(screen.getByText(PHONE_ERRORS.empty)).toBeTruthy();
  });

  it("EF12 the submit keeps its width: the column's, never the label's (EM-F7)", () => {
    render(island());
    const button = screen.getByRole('button');
    expect(button.className).toContain('w-full');
    expect(button.className).not.toMatch(/(^|\s)(\w+:)*w-auto/);
  });

  it('EF13 a no-JS success focuses its heading from the server HTML (EM-F14)', () => {
    const initial = { ...EMPTY, done: { callback: null, masked: '۰۹۱۲ *** ۶۷۸۹' } };
    expect(renderToStaticMarkup(island(initial))).toMatch(
      /<h2 id="em-title" tabindex="-1" autofocus=""/,
    );
  });

  it('EF11 a no-JS notice from the flash shows with its kept values and takes focus', () => {
    const initial = {
      ...EMPTY,
      values: { ...EMPTY.values, phone: '0912' },
      notice: 'retry' as const,
    };
    // The browser focuses it from the server HTML, before any script runs.
    expect(renderToStaticMarkup(island(initial))).toMatch(
      /<p role="alert" tabindex="-1" autofocus=""/,
    );
    render(island(initial));
    expect(screen.getByRole('alert').textContent).toContain('دوباره');
    expect(phone().value).toBe('0912');
  });

  it('EF14 the note counter turns the danger colour over the limit', () => {
    render(island());
    const note = screen.getByLabelText('توضیح (اختیاری)');
    fireEvent.change(note, { target: { value: 'ا'.repeat(500) } });
    expect(screen.getByText('۵۰۰/۵۰۰').className).toContain('text-ink-muted');
    fireEvent.change(note, { target: { value: 'ا'.repeat(501) } });
    const counter = screen.getByText('۵۰۱/۵۰۰');
    expect(counter.className).toContain('text-danger');
    expect(counter.className).not.toContain('text-ink-muted');
  });

  it('EF15 an invalid field keeps a danger focus ring (the brand ring would hide the error)', () => {
    render(island());
    for (const label of ['شمارهٔ موبایل', 'نام (اختیاری)', 'توضیح (اختیاری)']) {
      expect(screen.getByLabelText(label).className, label).toContain(
        'aria-invalid:outline-danger',
      );
    }
  });

  it('EF16 the triage boxes are drawn with the input border and the brand fill in both themes', () => {
    render(island());
    const input = box('ورم');
    const classes = input.className.split(' ');
    expect(classes).toEqual(
      expect.arrayContaining([
        'appearance-none',
        'border-line-strong',
        'bg-surface-raised',
        'checked:border-brand',
        'checked:bg-brand',
      ]),
    );
    // The tick shows over the checked box only; the label still names the native control.
    const tick = input.nextElementSibling!;
    expect(tick.querySelector('[data-icon="tick"]')).not.toBeNull();
    expect(tick.className.split(' ')).toEqual(
      expect.arrayContaining(['hidden', 'peer-checked:block']),
    );
    expect(classes).toContain('peer');
    expect(input.getAttribute('type')).toBe('checkbox');
  });

  it('EF17 one content width: the form caps every part at the measure, none sets its own', () => {
    render(island({ ...EMPTY, notice: 'neutral' }));
    expect(form().className.split(' ')).toContain('md:*:max-w-measure');
    expect(form().querySelectorAll('[class*="max-w-"]')).toHaveLength(0);
  });
});
