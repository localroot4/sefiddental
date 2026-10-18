'use client';

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type FormEvent,
  type ReactNode,
} from 'react';

import { cx } from '@/components/ui/cx';
import type { ErrorType } from '@/lib/events/allowlist';
import { toPersianDigits } from '@/lib/persianText';
import { track } from '@/lib/track/track';

import { getFormSession, renewFormSession } from '@/components/chrome/formSession';

import { BOOKING_FIELDS as F, NOTE_MAX } from './fields';
import { maskNational, parseMobile } from './phoneInput';

/** MIN_AGE_MS of src/lib/formTokens.ts (a server module): a younger token is stored as suspicious. */
export const TOKEN_MIN_AGE_MS = 2000;

export type PhoneReason = 'empty' | 'invalid' | 'landline';
/** Messages under the button: `neutral` and `retry` are an info state, the rest errors. */
export type Notice = 'neutral' | 'retry' | 'expired' | 'network' | 'server' | 'name';
const INFO: readonly Notice[] = ['neutral', 'retry'];

/** What a no-JS post left (the flash, freeze G3): the server renders it, the island keeps it. */
export interface BookingInitial {
  phone?: string;
  note?: string;
  phoneError?: PhoneReason;
  noteError?: boolean;
  notice?: Notice;
}

export interface BookingLabels {
  phone: string;
  /** «مثلاً» and the sample number as an LTR island. */
  phoneHelp: ReactNode;
  submit: string;
  submitting: string;
  done: string;
  registered: string;
  /** The callback line when the server answered none (it could not read the hours). */
  callbackGeneric: string;
  errors: { empty: string; invalid: string; landline: string; noteTooLong: string };
  /** conversion.md 5.2: each send failure, the neutral and the retry line. */
  notices: Record<Notice, ReactNode>;
  /** Full variant only. */
  note?: { summary: string; label: string; help: string };
  /** Full variant only: «یا با … تماس بگیرید.», shown while calls are allowed. */
  fallback?: { before: string; after: string; phone: string; href: string };
}

type Done =
  { kind: 'success'; callback: string; masked: string } | { kind: 'neutral'; masked: string };

type Answer =
  | { kind: 'success'; callback: string | null; masked: string | null }
  | { kind: 'neutral' }
  | { kind: 'invalid'; errors: Record<string, unknown> }
  | { kind: 'expired' | 'server' | 'network' };

type Tokens = { csrf: string; ts: string; at: number };

const describe = (...ids: Array<string | false>) => ids.filter(Boolean).join(' ');
const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The UTM part of the landing query string (conversion.md 5.1 hidden fields). */
function utmOf(search: string): string {
  const params = new URLSearchParams(search);
  return new URLSearchParams([...params].filter(([key]) => key.startsWith('utm_'))).toString();
}

/** One POST asking for JSON (the handler's contract, src/lib/booking/handler.ts); never re-posted. */
async function send(form: HTMLFormElement): Promise<Answer> {
  let res: Response;
  try {
    res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
    });
  } catch {
    return { kind: 'network' };
  }
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok && body?.ok === true) {
    return body.state === 'neutral'
      ? { kind: 'neutral' }
      : { kind: 'success', callback: text(body.callback), masked: text(body.masked) };
  }
  if (res.status === 422 && typeof body?.errors === 'object' && body.errors !== null) {
    return { kind: 'invalid', errors: body.errors as Record<string, unknown> };
  }
  // 419: expired, or no token at all (the session fetch failed); a 403, 413 or 500 is a failure.
  return { kind: res.status === 419 ? 'expired' : 'server' };
}

/**
 * The booking form's behaviour (conversion.md 5.1-5.4, 6; freeze G5-G8): validation on blur and
 * submit, the tokens, one JSON POST to the form's action (the proxy hands it to /api/booking),
 * and every answer: the success in the same grid cell as the form (a card on the page never
 * changes height; the dialog fits the success), the neutral state, inline field errors, the 419
 * renewal, and the send failures. The server parent renders every static part and passes the
 * labels; without JavaScript the same markup posts to the booking page. Tokens: the booking page
 * renders its own (`tokens`, the no-JS path), every other form takes the shared session answered
 * after `load`. A submit waits until the token is 2 s old, so a quick autofill and tap never lands
 * as «مشکوک» (G5).
 */
export function BookingFormIsland(props: {
  variant: 'compact' | 'full';
  /** `hero`, `block`, `dialog`, `page`: the id prefix `bk-<instance>`, the events' location. */
  instance: string;
  action: string;
  labels: BookingLabels;
  header: ReactNode;
  fields?: ReactNode;
  hidden: ReactNode;
  privacy: ReactNode;
  icons: {
    error: ReactNode;
    info: ReactNode;
    check: ReactNode;
    chevron?: ReactNode;
    spinner: ReactNode;
  };
  /** The submit's classes from src/components/ui/Button.tsx `submitClasses`. */
  submitClass: { idle: string; busy: string };
  /**
   * `CONTROL` of src/components/ui/Field.tsx and `alertBoxClass('info')` of Alert.tsx (Q3's info
   * state): those modules import the icon code, which an island never ships (F2).
   */
  controlClass: string;
  infoClass: string;
  /** Success lines after the callback and the registered number (items 4-6). */
  success: ReactNode;
  /** Tokens in the page HTML (booking page only). */
  tokens?: { csrf: string; ts: string } | null;
  initial?: BookingInitial;
}) {
  const { labels, instance } = props;
  const initial = props.initial ?? {};
  const p = `bk-${instance}`;
  const full = props.variant === 'full';
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const phone = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLTextAreaElement>(null);
  const noteBox = useRef<HTMLDetailsElement>(null);
  const doneHeading = useRef<HTMLHeadingElement & HTMLParagraphElement>(null);
  const pressingSubmit = useRef(false);
  const openSent = useRef(false);
  // In flight: a ref, so a second submit in the same tick is blocked too.
  const busy = useRef(false);
  // The page's own tokens, timed from hydration (they were issued before it), until a 419.
  const pageTokens = useRef<Tokens | null>(props.tokens ? { ...props.tokens, at: 0 } : null);
  const shown = useRef({ phone: initial.phoneError ?? null, note: Boolean(initial.noteError) });
  const [phoneError, setPhoneError] = useState<PhoneReason | null>(initial.phoneError ?? null);
  const [noteError, setNoteError] = useState(Boolean(initial.noteError));
  const [noteLength, setNoteLength] = useState(initial.note?.length ?? 0);
  const [callsAllowed, setCallsAllowed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const [notice, setNotice] = useState<Notice | null>(initial.notice ?? null);

  useEffect(() => {
    // The server HTML keeps `required` for the no-JS check; with JS this island validates.
    if (form.current) form.current.noValidate = true;
    if (pageTokens.current) pageTokens.current.at = Date.now();
    // A view of the booking page is one booking_open (G8); StrictMode runs effects twice in dev.
    if (instance === 'page' && !openSent.current) {
      openSent.current = true;
      track('booking_open', { location: 'page' });
    }
    let live = true;
    // One shared request per page view, after `load` (the chrome's closed-hours sheet reads it too).
    void getFormSession().then((value) => {
      if (live) setCallsAllowed(value?.hours.callsAllowed ?? false);
    });
    // As design/hero-directions/b.html: a press on the submit counts until that press's click or
    // the next press or key (a touch tap moves focus after pointerup), so a press dragged off the
    // button never leaves blur validation off.
    const release = () => (pressingSubmit.current = false);
    const ends = ['pointerdown', 'pointercancel', 'click', 'keydown'] as const;
    for (const type of ends) document.addEventListener(type, release, true);
    return () => {
      live = false;
      for (const type of ends) document.removeEventListener(type, release, true);
    };
  }, [instance]);

  useEffect(() => {
    if (!done) return;
    doneHeading.current?.focus({ preventScroll: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [done]);

  const report = (type: ErrorType) =>
    track('booking_error', { location: instance, error_type: type });

  /** Sets the field errors; booking_error goes once per message that appears (not per key). */
  function showErrors(next: { phone?: PhoneReason | null; note?: boolean }): void {
    if (next.phone !== undefined) {
      if (next.phone && next.phone !== shown.current.phone) report(`phone_${next.phone}`);
      shown.current.phone = next.phone;
      setPhoneError(next.phone);
    }
    if (next.note !== undefined) {
      if (next.note && !shown.current.note) report('note_too_long');
      shown.current.note = next.note;
      setNoteError(next.note);
    }
  }

  const phoneReason = (value: string): PhoneReason | null => {
    const parsed = parseMobile(value);
    return parsed.ok ? null : parsed.reason;
  };
  const noteTooLong = (value: string) => value.length > NOTE_MAX;
  /**
   * A blur that is no step to the next field: a press on this form's submit takes the focus first
   * (submit validation runs then, and a message here would move the button under the press,
   * conversion.md 5.2), or the dialog closes (Esc, «بستن»), which leaves no error behind.
   */
  const passing = (event: ReactFocusEvent<HTMLElement>) => {
    const dialog = event.currentTarget.closest('dialog');
    const to = event.relatedTarget;
    return (
      pressingSubmit.current ||
      (dialog !== null &&
        (!dialog.open || (to instanceof Element && to.matches('[command="close"]'))))
    );
  };

  /** Focus the first invalid field (conversion.md 5.2); the note's <details> opens for its error. */
  function focusFirst(which: 'phone' | 'note' | 'name'): void {
    if (which === 'phone') phone.current?.focus();
    else if (which === 'note') {
      if (noteBox.current) noteBox.current.open = true;
      note.current?.focus();
    } else {
      const name = form.current?.elements.namedItem(F.name);
      if (name instanceof HTMLElement) name.focus();
    }
  }

  async function tokens(): Promise<Tokens | null> {
    if (pageTokens.current) return pageTokens.current;
    // A submit before the token answer waits for it (conversion.md 6).
    const session = await getFormSession();
    return session
      ? { csrf: session.csrf, ts: session.ts, at: session.receivedAt ?? Date.now() }
      : null;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    if (busy.current) return;
    const phoneErr = phoneReason(phone.current?.value ?? '');
    const noteErr = full && noteTooLong(note.current?.value ?? '');
    showErrors({ phone: phoneErr, note: noteErr });
    if (phoneErr || noteErr) {
      focusFirst(phoneErr ? 'phone' : 'note');
      setStatus(phoneErr ? labels.errors[phoneErr] : labels.errors.noteTooLong);
      return;
    }
    busy.current = true;
    setNotice(null);
    setLoading(true);
    setStatus(labels.submitting);
    const set = (name: string, value: string) => {
      const input = el.elements.namedItem(name);
      if (input instanceof HTMLInputElement) input.value = value;
    };
    const value = (name: string) => {
      const input = el.elements.namedItem(name);
      return input instanceof HTMLInputElement || input instanceof RadioNodeList ? input.value : '';
    };
    const current = await tokens();
    if (current) {
      const wait = current.at + TOKEN_MIN_AGE_MS - Date.now();
      if (wait > 0) await sleep(wait);
    }
    // After the last await: a render while waiting resets each hidden input to its defaultValue.
    set(F.sourceUrl, window.location.pathname);
    set(F.utm, utmOf(window.location.search));
    if (current) {
      set(F.csrf, current.csrf);
      set(F.ts, current.ts);
    }
    track('booking_submit', {
      location: instance,
      has_name: value(F.name).trim() !== '',
      time_pref: value(F.timePref) || 'none',
      tier: value(F.tier) || 'none',
    });
    const answer = await send(el);
    busy.current = false;
    setLoading(false);
    setStatus('');
    const parsed = parseMobile(phone.current?.value ?? '');
    const masked = parsed.ok ? maskNational(parsed.national) : '';
    switch (answer.kind) {
      case 'success':
        track('booking_success', { location: instance, duplicate: false });
        setDone({
          kind: 'success',
          callback: answer.callback ?? labels.callbackGeneric,
          masked: answer.masked ?? masked,
        });
        return;
      case 'neutral':
        track('booking_success', { location: instance, duplicate: true });
        // The compact card shows it in place of the form, so the hero keeps its height.
        if (full) setNotice('neutral');
        else setDone({ kind: 'neutral', masked });
        return;
      case 'invalid': {
        const { phone: phoneCode, note: noteCode, name: nameCode } = answer.errors;
        const reason = phoneCode
          ? ((['empty', 'invalid', 'landline'] as const).find((r) => r === phoneCode) ?? 'invalid')
          : null;
        showErrors({ phone: reason, note: Boolean(noteCode) });
        if (nameCode) {
          report('name_too_long');
          setNotice('name');
        }
        focusFirst(reason ? 'phone' : noteCode ? 'note' : 'name');
        return;
      }
      case 'expired':
        report('expired');
        setNotice('expired');
        // A new token for the next press, values kept; never an automatic resubmit (5.2).
        pageTokens.current = null;
        void renewFormSession(current?.ts ?? '');
        return;
      default:
        report(answer.kind);
        setNotice(answer.kind);
    }
  }

  const fallback = labels.fallback;
  const info = notice !== null && INFO.includes(notice);
  // A no-JS post's message sits below the first screen: autofocus brings it there before any
  // script runs (as the emergency form's).
  const fromFlash = Boolean(initial.notice) && notice === initial.notice;
  return (
    // `data-booking-form` is the chrome's booking-route target (src/components/chrome/ids.ts); the
    // hero card drops it once done, so «رزرو نوبت» then scrolls to the scene 10 block.
    <div
      ref={root}
      id={p}
      data-booking-form={done && !full ? undefined : instance}
      data-state={done ? done.kind : 'form'}
      className="grid"
    >
      <form
        ref={form}
        method="post"
        action={props.action}
        onSubmit={submit}
        // Named by its heading only in the full variant: on home both instances share the heading,
        // and two form landmarks with one name are ambiguous (axe landmark-unique).
        aria-labelledby={full ? `${p}-title` : undefined}
        inert={done !== null}
        className={cx(
          'col-start-1 row-start-1 grid content-start',
          full ? 'gap-4' : 'gap-2 md:gap-3',
          // The dialog is a modal: it fits the success, as nothing on the page moves under it.
          done && (instance === 'dialog' ? 'hidden' : 'invisible'),
        )}
      >
        {props.header}
        <div className="grid content-start gap-2">
          <label htmlFor={`${p}-phone`} className="text-small font-semibold">
            {labels.phone}
          </label>
          <input
            ref={phone}
            id={`${p}-phone`}
            name={F.phone}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            dir="ltr"
            required
            defaultValue={initial.phone}
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={describe(
              `${p}-phone-help`,
              Boolean(phoneError) && `${p}-phone-error`,
            )}
            onFocus={() => {
              // At most one per page view; a chrome CTA that moved focus here already sent its own
              // (it marks the card with data-booking-opened).
              if (instance !== 'hero' || openSent.current) return;
              openSent.current = true;
              if (!root.current?.hasAttribute('data-booking-opened')) {
                track('booking_open', { location: 'hero' });
              }
            }}
            onChange={(event) => {
              // Reward early: a fixed value drops its message now, not at the blur, where the
              // layout would move under the pointer of the next click.
              if (phoneError && !phoneReason(event.currentTarget.value))
                showErrors({ phone: null });
            }}
            onBlur={(event) => {
              if (passing(event) || !event.currentTarget.value.trim()) return;
              showErrors({ phone: phoneReason(event.currentTarget.value) });
            }}
            className={cx(props.controlClass, 'min-h-target text-start')}
          />
          <p id={`${p}-phone-help`} className="text-caption text-ink-muted">
            {labels.phoneHelp}
          </p>
          {phoneError ? (
            <p id={`${p}-phone-error`} className="flex gap-1 text-small font-medium text-danger">
              {props.icons.error}
              <span>{labels.errors[phoneError]}</span>
            </p>
          ) : null}
        </div>
        {props.fields}
        {full && labels.note ? (
          <details
            ref={noteBox}
            className="group"
            open={Boolean(initial.note) || Boolean(initial.noteError)}
          >
            <summary className="flex min-h-target w-fit cursor-pointer list-none items-center gap-2 text-small font-semibold text-brand-strong [&::-webkit-details-marker]:hidden">
              {labels.note.summary}
              {props.icons.chevron}
            </summary>
            <div className="grid content-start gap-2 pt-2">
              <label htmlFor={`${p}-note`} className="text-small font-semibold">
                {labels.note.label}
              </label>
              <textarea
                ref={note}
                id={`${p}-note`}
                name={F.note}
                rows={3}
                defaultValue={initial.note}
                aria-invalid={noteError ? true : undefined}
                aria-describedby={describe(
                  `${p}-note-help`,
                  `${p}-note-counter`,
                  noteError && `${p}-note-error`,
                )}
                onChange={(event) => {
                  setNoteLength(event.currentTarget.value.length);
                  if (noteError && !noteTooLong(event.currentTarget.value)) {
                    showErrors({ note: false });
                  }
                }}
                onBlur={(event) => {
                  if (!passing(event)) showErrors({ note: noteTooLong(event.currentTarget.value) });
                }}
                className={cx(props.controlClass, 'min-h-24 resize-y')}
              />
              <div className="flex items-start justify-between gap-3">
                <p id={`${p}-note-help`} className="text-caption text-ink-muted">
                  {labels.note.help}
                </p>
                <span
                  id={`${p}-note-counter`}
                  dir="ltr"
                  className={cx(
                    'shrink-0 text-caption',
                    noteLength > NOTE_MAX ? 'text-danger' : 'text-ink-muted',
                  )}
                >
                  {toPersianDigits(`${noteLength}/${NOTE_MAX}`)}
                </span>
              </div>
              {noteError ? (
                <p id={`${p}-note-error`} className="flex gap-1 text-small font-medium text-danger">
                  {props.icons.error}
                  <span>{labels.errors.noteTooLong}</span>
                </p>
              ) : null}
            </div>
          </details>
        ) : null}
        {props.hidden}
        <input type="hidden" name={F.sourceUrl} defaultValue="" />
        <input type="hidden" name={F.utm} defaultValue="" />
        <input type="hidden" name={F.csrf} defaultValue={props.tokens?.csrf ?? ''} />
        <input type="hidden" name={F.ts} defaultValue={props.tokens?.ts ?? ''} />
        {props.privacy}
        <div className="grid">
          {/* Button's markup (src/components/ui/Button.tsx): the spinner replaces no icon. */}
          <button
            type="submit"
            aria-busy={loading || undefined}
            data-loading={loading || undefined}
            className={loading ? props.submitClass.busy : props.submitClass.idle}
            onPointerDown={() => (pressingSubmit.current = true)}
          >
            {loading ? props.icons.spinner : null}
            {loading ? labels.submitting : labels.submit}
          </button>
          {notice && !info ? (
            <p
              role="alert"
              tabIndex={-1}
              autoFocus={fromFlash}
              className="mt-3 flex gap-1 text-small font-medium text-danger focus:outline-none"
            >
              {props.icons.error}
              <span>{labels.notices[notice]}</span>
            </p>
          ) : null}
          {/* Present before it fills, so the info state is announced (Q3: not an error). */}
          <div role="status">
            {notice && info ? (
              <div
                tabIndex={-1}
                autoFocus={fromFlash}
                className={cx(props.infoClass, 'mt-3 focus:outline-none')}
              >
                {props.icons.info}
                <p>{labels.notices[notice]}</p>
              </div>
            ) : null}
          </div>
        </div>
        {fallback ? (
          // The line box is reserved, so the hours answer never shifts the block (P4 AC).
          <p className="min-h-[1lh] text-small text-ink-muted">
            {callsAllowed ? (
              <>
                {fallback.before}{' '}
                <a
                  href={fallback.href}
                  dir="ltr"
                  data-track="call_click"
                  data-location={instance}
                  className="font-semibold whitespace-nowrap text-brand-strong underline decoration-line-strong underline-offset-[.22em]"
                >
                  {fallback.phone}
                </a>{' '}
                {fallback.after}
              </>
            ) : null}
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only">
          {status}
        </p>
      </form>
      <div
        inert={done === null}
        className={cx(
          'col-start-1 row-start-1 grid content-start justify-items-start gap-2',
          !done && 'invisible',
        )}
      >
        {done?.kind === 'neutral' ? (
          // The neutral answer in the compact card (conversion.md 5.2): not a success, no check.
          <>
            <div className={props.infoClass}>
              {props.icons.info}
              <p ref={doneHeading} tabIndex={-1} className="focus:outline-none">
                {labels.notices.neutral}
              </p>
            </div>
            <p className="text-small text-ink-muted">
              {labels.registered} <bdi dir="ltr">{done.masked}</bdi>
            </p>
          </>
        ) : (
          <>
            <span className={full ? 'size-16' : 'size-12'}>{done ? props.icons.check : null}</span>
            <h2
              ref={doneHeading}
              id={`${p}-done`}
              tabIndex={-1}
              className="text-heading font-semibold focus:outline-none"
            >
              {labels.done}
            </h2>
            <div className="text-small text-ink-muted">
              <p>{done?.kind === 'success' ? done.callback : null}</p>
              <p>
                {labels.registered} <bdi dir="ltr">{done?.masked}</bdi>
              </p>
            </div>
            {props.success}
          </>
        )}
      </div>
    </div>
  );
}
