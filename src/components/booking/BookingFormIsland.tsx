'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { toPersianDigits } from '@/lib/persianText';
import { track } from '@/lib/track/track';

import { getFormSession, type FormSession } from '@/components/chrome/formSession';

import { BOOKING_FIELDS as F, NOTE_MAX } from './fields';
import { maskNational, parseMobile } from './phoneInput';

// The TextField control of src/components/ui/Field.tsx: that module imports the icon code, which
// an island never ships (F2), so the two fields this island owns repeat its classes.
const CONTROL =
  'w-full rounded-input border-[1.5px] border-line-strong bg-surface-raised px-4 py-2 leading-[1.5] text-ink transition-colors hover:not-aria-invalid:border-ink-muted focus-visible:border-brand aria-invalid:border-danger-fill';

export interface BookingLabels {
  phone: string;
  /** «مثلاً» and the sample number as an LTR island. */
  phoneHelp: ReactNode;
  submit: string;
  submitting: string;
  done: string;
  registered: string;
  errors: { empty: string; invalid: string; landline: string; noteTooLong: string };
  /** Send failures (conversion.md 5.2), each ending with the clinic number as an LTR island. */
  failed: { network: ReactNode; server: ReactNode };
  /** Full variant only. */
  note?: { summary: string; label: string; help: string };
  /** Full variant only: «یا با … تماس بگیرید.», shown while calls are allowed. */
  fallback?: { before: string; after: string; phone: string; href: string };
}

type Done = { callback: string; masked: string };

const describe = (...ids: Array<string | false>) => ids.filter(Boolean).join(' ');

/** The UTM part of the landing query string (conversion.md 5.1 hidden fields). */
function utmOf(search: string): string {
  const params = new URLSearchParams(search);
  return new URLSearchParams([...params].filter(([key]) => key.startsWith('utm_'))).toString();
}

/**
 * The booking form's behaviour (conversion.md 5.1-5.4, 6): validation on blur and submit, the
 * shared form session after `load`, the submit, and the success state in the same grid cell as
 * the form, so the card never changes height. The server parent renders every static part and
 * passes the labels; without JavaScript the same markup posts to the booking page.
 * Submit: one POST to the form's action asking for JSON; `{ ok: true }` shows the success. Only a
 * 404 or 405 (no handler yet, so nothing was stored) falls back to the native POST, the no-JS
 * path; any other answer shows the server message and is never re-posted. Phase 5 answers JSON
 * and adds the 419 and duplicate states of 5.2.
 */
export function BookingFormIsland(props: {
  variant: 'compact' | 'full';
  /** `hero`, `block`, `page`, ...: the id prefix `bk-<instance>` and the chrome's route target. */
  instance: string;
  action: string;
  labels: BookingLabels;
  header: ReactNode;
  fields?: ReactNode;
  hidden: ReactNode;
  privacy: ReactNode;
  icons: { error: ReactNode; check: ReactNode; chevron?: ReactNode };
  /** Success lines after the callback and the registered number (items 4-6). */
  success: ReactNode;
}) {
  const { labels } = props;
  const p = `bk-${props.instance}`;
  const full = props.variant === 'full';
  const root = useRef<HTMLDivElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const phone = useRef<HTMLInputElement>(null);
  const note = useRef<HTMLTextAreaElement>(null);
  const noteBox = useRef<HTMLDetailsElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const pressingSubmit = useRef(false);
  const openSent = useRef(false);
  // In flight: a ref, so a second submit in the same tick is blocked too.
  const busy = useRef(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteLength, setNoteLength] = useState(0);
  const [session, setSession] = useState<FormSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState<Done | null>(null);
  const [failed, setFailed] = useState<keyof BookingLabels['failed'] | null>(null);

  useEffect(() => {
    // The server HTML keeps `required` for the no-JS check; with JS this island validates.
    if (form.current) form.current.noValidate = true;
    let live = true;
    // One shared request per page view, after `load` (the chrome's closed-hours sheet reads it too).
    void getFormSession().then((value) => {
      if (live) setSession(value);
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
  }, []);

  useEffect(() => {
    if (!done) return;
    doneHeading.current?.focus({ preventScroll: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  }, [done]);

  const phoneMessage = (value: string): string | null => {
    const parsed = parseMobile(value);
    return parsed.ok ? null : labels.errors[parsed.reason];
  };
  const noteMessage = (value: string): string | null =>
    value.length > NOTE_MAX ? labels.errors.noteTooLong : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    if (busy.current) return;
    const phoneMsg = phoneMessage(phone.current?.value ?? '');
    const noteMsg = full ? noteMessage(note.current?.value ?? '') : null;
    setPhoneError(phoneMsg);
    setNoteError(noteMsg);
    if (phoneMsg || noteMsg) {
      if (phoneMsg) phone.current?.focus();
      else {
        if (noteBox.current) noteBox.current.open = true;
        note.current?.focus();
      }
      setStatus(phoneMsg ?? noteMsg ?? '');
      return;
    }
    busy.current = true;
    setFailed(null);
    setLoading(true);
    setStatus(labels.submitting);
    // A submit before the token answer waits for it (conversion.md 6).
    const current = session ?? (await getFormSession());
    const set = (name: string, value: string) => {
      const input = el.elements.namedItem(name);
      if (input instanceof HTMLInputElement) input.value = value;
    };
    set(F.sourceUrl, window.location.pathname);
    set(F.utm, utmOf(window.location.search));
    if (current) {
      set(F.csrf, current.csrf);
      set(F.ts, current.ts);
    }
    let outcome: 'ok' | 'native' | keyof BookingLabels['failed'];
    try {
      const res = await fetch(el.action, {
        method: 'POST',
        body: new FormData(el),
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
      });
      const body: unknown = res.ok ? await res.json().catch(() => null) : null;
      if ((body as { ok?: unknown } | null)?.ok === true) outcome = 'ok';
      else outcome = res.status === 404 || res.status === 405 ? 'native' : 'server';
    } catch {
      outcome = 'network';
    }
    if (outcome === 'native') {
      el.submit();
      return;
    }
    busy.current = false;
    setLoading(false);
    setStatus('');
    if (outcome !== 'ok') {
      setFailed(outcome);
      return;
    }
    const parsed = parseMobile(phone.current?.value ?? '');
    setDone({
      callback: current?.hours.copy.callback ?? '',
      masked: parsed.ok ? maskNational(parsed.national) : '',
    });
  }

  const fallback = labels.fallback;
  return (
    // `data-booking-form` is the chrome's booking-route target (src/components/chrome/ids.ts); the
    // hero card drops it on success, so «رزرو نوبت» then scrolls to the scene 10 block.
    <div
      ref={root}
      id={p}
      data-booking-form={done && !full ? undefined : props.instance}
      data-state={done ? 'success' : 'form'}
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
          done && 'invisible',
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
            aria-invalid={phoneError ? true : undefined}
            aria-describedby={describe(
              `${p}-phone-help`,
              Boolean(phoneError) && `${p}-phone-error`,
            )}
            onFocus={() => {
              // At most one per page view; a chrome CTA that moved focus here already sent its own
              // (it marks the card with data-booking-opened).
              if (props.instance !== 'hero' || openSent.current) return;
              openSent.current = true;
              if (!root.current?.hasAttribute('data-booking-opened')) {
                track('booking_open', { location: 'hero' });
              }
            }}
            onBlur={(event) => {
              // A press on this form's submit takes the focus first: submit validation runs then,
              // and a message here would move the button under the press (conversion.md 5.2).
              if (pressingSubmit.current || !event.currentTarget.value.trim()) return;
              setPhoneError(phoneMessage(event.currentTarget.value));
            }}
            className={cx(CONTROL, 'min-h-target text-start')}
          />
          <p id={`${p}-phone-help`} className="text-caption text-ink-muted">
            {labels.phoneHelp}
          </p>
          {phoneError ? (
            <p id={`${p}-phone-error`} className="flex gap-1 text-small font-medium text-danger">
              {props.icons.error}
              <span>{phoneError}</span>
            </p>
          ) : null}
        </div>
        {props.fields}
        {full && labels.note ? (
          <details ref={noteBox} className="group">
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
                aria-invalid={noteError ? true : undefined}
                aria-describedby={describe(
                  `${p}-note-help`,
                  `${p}-note-counter`,
                  Boolean(noteError) && `${p}-note-error`,
                )}
                onChange={(event) => setNoteLength(event.currentTarget.value.length)}
                onBlur={(event) => setNoteError(noteMessage(event.currentTarget.value))}
                className={cx(CONTROL, 'min-h-24 resize-y')}
              />
              <div className="flex items-start justify-between gap-3">
                <p id={`${p}-note-help`} className="text-caption text-ink-muted">
                  {labels.note.help}
                </p>
                <span
                  id={`${p}-note-counter`}
                  dir="ltr"
                  className="shrink-0 text-caption text-ink-muted"
                >
                  {toPersianDigits(`${noteLength}/${NOTE_MAX}`)}
                </span>
              </div>
              {noteError ? (
                <p id={`${p}-note-error`} className="flex gap-1 text-small font-medium text-danger">
                  {props.icons.error}
                  <span>{noteError}</span>
                </p>
              ) : null}
            </div>
          </details>
        ) : null}
        {props.hidden}
        <input type="hidden" name={F.sourceUrl} defaultValue="" />
        <input type="hidden" name={F.utm} defaultValue="" />
        <input type="hidden" name={F.csrf} defaultValue="" />
        <input type="hidden" name={F.ts} defaultValue="" />
        {props.privacy}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={loading}
          onPointerDown={() => (pressingSubmit.current = true)}
        >
          {loading ? labels.submitting : labels.submit}
        </Button>
        {failed ? (
          <p role="alert" className="flex gap-1 text-small font-medium text-danger">
            {props.icons.error}
            <span>{labels.failed[failed]}</span>
          </p>
        ) : null}
        {fallback ? (
          // The line box is reserved, so the hours answer never shifts the block (P4 AC).
          <p className="min-h-[1lh] text-small text-ink-muted">
            {session?.hours.callsAllowed ? (
              <>
                {fallback.before}{' '}
                <a
                  href={fallback.href}
                  dir="ltr"
                  data-track="call_click"
                  data-location="block"
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
          'col-start-1 row-start-1 grid content-center justify-items-start gap-2',
          !done && 'invisible',
        )}
      >
        <span className={full ? 'size-16' : 'size-12'}>{done ? props.icons.check : null}</span>
        <h2
          ref={doneHeading}
          id={`${p}-done`}
          tabIndex={-1}
          className="text-heading font-semibold focus:outline-none"
        >
          {labels.done}
        </h2>
        {/* Four lines: the longest callback line (holiday, weekday and date) takes three at 320 px,
            then the registered number; the slack falls below the pair. */}
        <div className="min-h-[4lh] text-small text-ink-muted">
          <p>{done?.callback}</p>
          <p>
            {labels.registered} <bdi dir="ltr">{done?.masked}</bdi>
          </p>
        </div>
        {props.success}
      </div>
    </div>
  );
}
