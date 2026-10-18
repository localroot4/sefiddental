'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { cx } from '@/components/ui/cx';
import { BOOKING_FIELDS as F, NOTE_MAX } from '@/components/booking/fields';
import { parseMobile } from '@/components/booking/phoneInput';
import { renewFormSession } from '@/components/chrome/formSession';
import type { FieldError, FieldErrors, Triage } from '@/lib/booking/request';
import type { HoursStateName } from '@/lib/hoursState';
import { toPersianDigits } from '@/lib/persianText';
import { track } from '@/lib/track/track';

// The TextField control of src/components/ui/Field.tsx, repeated as the booking island does: that
// module imports the icon code, which an island never ships (F2).
const CONTROL =
  'w-full rounded-input border-[1.5px] border-line-strong bg-surface-raised px-4 py-2 leading-[1.5] text-ink transition-colors hover:not-aria-invalid:border-ink-muted focus-visible:border-brand aria-invalid:border-danger';
const NAME_MAX = 80;
// The server's time trap (formTokens MIN_AGE_MS): a post younger than this is stored as suspicious.
const TOKEN_MIN_AGE_MS = 2000;

/** No-JS outcomes of the flash, plus the network failure of a JS post. */
export type Notice = 'expired' | 'retry' | 'server' | 'network' | 'neutral';

export interface EmergencyLabels {
  legend: string;
  /** The five boxes in the form's order (Bookings.triage values). */
  triage: ReadonlyArray<readonly [Triage, string]>;
  phone: string;
  phoneHelp: ReactNode;
  name: string;
  note: { summary: string; label: string };
  submit: string;
  submitting: string;
  done: string;
  registered: string;
  callbackGeneric: string;
  errors: Record<
    'empty' | 'invalid' | 'landline' | 'noteTooLong' | 'nameTooLong' | 'triage',
    string
  >;
  notices: Record<Notice, ReactNode>;
}

export interface EmergencyInitial {
  values: { phone: string; name: string; note: string };
  triage: readonly string[];
  errors: FieldErrors;
  notice: Notice | null;
  /** A no-JS success (the flash): the page shows the success state, never the form. */
  done: Done | null;
}

type Done = { callback: string | null; masked: string };
type Errors = Partial<Record<'phone' | 'name' | 'note' | 'triage', string>>;

const describe = (...ids: Array<string | false>) => ids.filter(Boolean).join(' ') || undefined;

function utmOf(search: string): string {
  const params = new URLSearchParams(search);
  return new URLSearchParams([...params].filter(([key]) => key.startsWith('utm_'))).toString();
}

/**
 * The emergency form's behaviour (docs/conversion.md 7.3, 5.1-5.4; emergency spec 6.2). The
 * server renders the same markup for the no-JS post (with the flash's values, errors and notice)
 * and every static part. With JS: validation on blur and submit, at least one triage box, the
 * POST held until 2 s after the tokens arrived (freeze G5), JSON answers: success with the
 * server's callback line, the repeat-emergency info state, 419 with a renewed token and the kept
 * values, 422 field errors, and the server and network failures, never re-posted.
 */
export function EmergencyFormIsland(props: {
  action: string;
  openState: HoursStateName;
  labels: EmergencyLabels;
  initial: EmergencyInitial;
  header: ReactNode;
  /** Shown under the avulsion box; CSS reveals it when the box is checked (EM-D3). */
  avulsion: ReactNode;
  none: ReactNode;
  hidden: ReactNode;
  privacy: ReactNode;
  aboveSubmit: ReactNode;
  icons: {
    error: ReactNode;
    info: ReactNode;
    check: ReactNode;
    chevron: ReactNode;
    spinner: ReactNode;
  };
  /** The submit's classes from src/components/ui/Button.tsx `submitClasses`. */
  submitClass: { idle: string; busy: string };
  /** After the success lines, outside the card: the safety box again (7.3). */
  success: ReactNode;
  /** The card around the form and around the success lines (never around the safety box). */
  cardClassName: string;
}) {
  const { labels, initial } = props;
  const message = (field: keyof Errors, code: FieldError | undefined): string | undefined => {
    if (!code) return undefined;
    if (field === 'phone') {
      return code === 'empty' || code === 'invalid' || code === 'landline'
        ? labels.errors[code]
        : labels.errors.invalid;
    }
    if (field === 'triage') return labels.errors.triage;
    return field === 'note' ? labels.errors.noteTooLong : labels.errors.nameTooLong;
  };
  const toErrors = (codes: FieldErrors): Errors => ({
    phone: message('phone', codes.phone),
    name: message('name', codes.name),
    note: message('note', codes.note),
    triage: message('triage', codes.triage),
  });

  const form = useRef<HTMLFormElement>(null);
  const noteBox = useRef<HTMLDetailsElement>(null);
  const doneHeading = useRef<HTMLHeadingElement>(null);
  const pressingSubmit = useRef(false);
  const busy = useRef(false);
  // When the current tokens arrived (ms): the post waits until 2 s after it.
  const tokensAt = useRef(0);
  const [errors, setErrors] = useState<Errors>(() => toErrors(initial.errors));
  const [noteLength, setNoteLength] = useState(initial.values.note.length);
  const [notice, setNotice] = useState<Notice | null>(initial.notice);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState<Done | null>(initial.done);
  const p = 'em';

  useEffect(() => {
    // The server HTML keeps native checks for the no-JS post; with JS this island validates.
    if (form.current) form.current.noValidate = true;
    // The page rendered its tokens; they are at least as old as this mount.
    tokensAt.current = Date.now();
    const release = () => (pressingSubmit.current = false);
    const ends = ['pointerdown', 'pointercancel', 'click', 'keydown'] as const;
    for (const type of ends) document.addEventListener(type, release, true);
    return () => {
      for (const type of ends) document.removeEventListener(type, release, true);
    };
  }, []);

  const field = (name: string) => form.current?.elements.namedItem(name);
  const value = (name: string) => {
    const el = field(name);
    return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : '';
  };
  const setValue = (name: string, next: string) => {
    const el = field(name);
    if (el instanceof HTMLInputElement) el.value = next;
  };
  const checked = () =>
    Array.from(form.current?.querySelectorAll<HTMLInputElement>('input[name="triage"]') ?? [])
      .filter((box) => box.checked)
      .map((box) => box.value);

  const phoneMessage = (text: string) => {
    const parsed = parseMobile(text);
    return parsed.ok ? undefined : labels.errors[parsed.reason];
  };
  const clientErrors = (): Errors => ({
    triage: checked().length === 0 ? labels.errors.triage : undefined,
    phone: phoneMessage(value(F.phone)),
    name: value(F.name).trim().length > NAME_MAX ? labels.errors.nameTooLong : undefined,
    note: value(F.note).length > NOTE_MAX ? labels.errors.noteTooLong : undefined,
  });

  /** Shows the errors and moves focus to the first invalid control in form order. */
  function showErrors(next: Errors): boolean {
    setErrors(next);
    const first = (['triage', 'phone', 'name', 'note'] as const).find((key) => next[key]);
    if (!first) return false;
    if (first === 'note' && noteBox.current) noteBox.current.open = true;
    const target =
      first === 'triage'
        ? form.current?.querySelector<HTMLInputElement>('input[name="triage"]')
        : document.getElementById(`${p}-${first}`);
    target?.focus();
    setStatus(next[first] ?? '');
    return true;
  }

  async function renewTokens(oldTs: string) {
    // Null on failure: the next press answers 419 again and retries the renewal.
    const session = await renewFormSession(oldTs);
    if (!session) return;
    setValue(F.csrf, session.csrf);
    setValue(F.ts, session.ts);
    // The server may answer a fresh token instead of the pre-aged one (K-RENEW): wait from arrival.
    tokensAt.current = session.receivedAt ?? Date.now();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const el = event.currentTarget;
    if (busy.current) return;
    if (showErrors(clientErrors())) return;
    busy.current = true;
    setNotice(null);
    setLoading(true);
    setStatus(labels.submitting);
    const wait = tokensAt.current + TOKEN_MIN_AGE_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    setValue(F.sourceUrl, window.location.pathname);
    setValue(F.utm, utmOf(window.location.search));
    const ts = value(F.ts);
    let outcome: Notice | 'invalid' | 'done';
    let body: { state?: unknown; callback?: unknown; masked?: unknown; errors?: unknown } | null =
      null;
    try {
      const res = await fetch(el.action, {
        method: 'POST',
        body: new FormData(el),
        headers: { accept: 'application/json' },
        credentials: 'same-origin',
      });
      body = await res.json().catch(() => null);
      if (res.status === 419) outcome = 'expired';
      else if (res.status === 422 && body?.errors) outcome = 'invalid';
      else if (res.ok && body?.state === 'neutral') outcome = 'neutral';
      else if (res.ok && body?.state === 'success') outcome = 'done';
      else outcome = 'server';
    } catch {
      outcome = 'network';
    }
    if (outcome === 'expired') await renewTokens(ts);
    busy.current = false;
    setLoading(false);
    setStatus('');
    // A 422 without a field this form shows would leave the visitor stuck: the server message.
    if (outcome === 'invalid' && showErrors(toErrors(body?.errors as FieldErrors))) return;
    if (outcome === 'invalid') outcome = 'server';
    if (outcome !== 'done') {
      setNotice(outcome);
      return;
    }
    const items = checked().length;
    setDone({
      callback: typeof body?.callback === 'string' ? body.callback : null,
      masked: typeof body?.masked === 'string' ? body.masked : '',
    });
    track('emergency_submit', { open_state: props.openState, items_count: items });
  }

  useEffect(() => {
    // A JS success only: the no-JS success has the heading's autofocus.
    if (!done || done === initial.done) return;
    doneHeading.current?.focus({ preventScroll: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    doneHeading.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [done, initial.done]);

  if (done) {
    return (
      <div data-state="success" className="grid gap-8 md:gap-12">
        <div className={cx('grid justify-items-start gap-3', props.cardClassName)}>
          <span className="size-16">{props.icons.check}</span>
          <h2
            ref={doneHeading}
            id={`${p}-title`}
            tabIndex={-1}
            // The no-JS success after the 303: the browser focuses and scrolls to it (EM-F14).
            autoFocus={done === initial.done}
            className="text-heading font-semibold focus:outline-none"
          >
            {labels.done}
          </h2>
          <div className="grid gap-1 text-body text-ink-muted">
            <p>{done.callback ?? labels.callbackGeneric}</p>
            {done.masked ? (
              <p>
                {labels.registered} <bdi dir="ltr">{done.masked}</bdi>
              </p>
            ) : null}
          </div>
        </div>
        {props.success}
      </div>
    );
  }

  // A no-JS re-render focuses the first invalid control or the notice (autofocus works before
  // hydration); JS moves focus itself.
  const firstError = (['triage', 'phone', 'name', 'note'] as const).find((key) => errors[key]);
  const autoFocusOn = (key: keyof Errors) => !notice && firstError === key;
  const noticeTone = notice === 'neutral' ? 'info' : 'danger';
  return (
    <form
      ref={form}
      method="post"
      action={props.action}
      onSubmit={submit}
      aria-labelledby={`${p}-title`}
      data-emergency-form=""
      className={cx('grid content-start gap-6', props.cardClassName)}
    >
      {props.header}
      <fieldset
        aria-describedby={errors.triage ? `${p}-triage-error` : undefined}
        className="grid gap-1"
      >
        <legend className="mb-2 text-body font-semibold">{labels.legend}</legend>
        {labels.triage.map(([item, label], i) => {
          const box = (
            <label className="flex min-h-target cursor-pointer items-start gap-3 py-2 text-body">
              <input
                type="checkbox"
                name="triage"
                value={item}
                defaultChecked={initial.triage.includes(item)}
                autoFocus={i === 0 && autoFocusOn('triage')}
                onChange={() => setErrors((prev) => ({ ...prev, triage: undefined }))}
                className="mt-[.3em] size-[1.25rem] shrink-0 cursor-pointer"
              />
              <span>{label}</span>
            </label>
          );
          return item === 'avulsion' ? (
            // Shown only while its box is checked where :has() exists; an older browser drops
            // the rule as invalid and always shows the first aid (EM-D3).
            <div key={item} className="[&:not(:has(:checked))>[data-reveal]]:hidden">
              {box}
              <div data-reveal="" className="ms-8 mb-2 grid gap-3 text-small">
                {props.avulsion}
              </div>
            </div>
          ) : (
            <div key={item}>{box}</div>
          );
        })}
        {errors.triage ? (
          <p id={`${p}-triage-error`} className="flex gap-1 text-small font-medium text-danger">
            {props.icons.error}
            <span>{errors.triage}</span>
          </p>
        ) : null}
        <p className="pt-2 text-small text-ink-muted">{props.none}</p>
      </fieldset>

      <div className="grid content-start gap-2 md:max-w-[26rem]">
        <label htmlFor={`${p}-phone`} className="text-small font-semibold">
          {labels.phone}
        </label>
        <input
          id={`${p}-phone`}
          name={F.phone}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          required
          defaultValue={initial.values.phone}
          autoFocus={autoFocusOn('phone')}
          aria-invalid={errors.phone ? true : undefined}
          aria-describedby={describe(
            `${p}-phone-help`,
            Boolean(errors.phone) && `${p}-phone-error`,
          )}
          onChange={(event) => {
            // Reward early: a fixed number drops its message now, not at the blur, where the
            // layout would move under the pointer of the next click.
            const text = event.currentTarget.value;
            setErrors((prev) =>
              prev.phone && !phoneMessage(text) ? { ...prev, phone: undefined } : prev,
            );
          }}
          onBlur={(event) => {
            // A press on the submit validates on submit; a message here would move the button.
            if (pressingSubmit.current) return;
            const text = event.currentTarget.value;
            // Quiet on an empty field until submit, but a shown message always fits the value.
            setErrors((prev) =>
              !text.trim() && !prev.phone ? prev : { ...prev, phone: phoneMessage(text) },
            );
          }}
          className={cx(CONTROL, 'min-h-target text-start')}
        />
        <p id={`${p}-phone-help`} className="text-caption text-ink-muted">
          {labels.phoneHelp}
        </p>
        {errors.phone ? (
          <p id={`${p}-phone-error`} className="flex gap-1 text-small font-medium text-danger">
            {props.icons.error}
            <span>{errors.phone}</span>
          </p>
        ) : null}
      </div>

      <div className="grid content-start gap-2 md:max-w-[26rem]">
        <label htmlFor={`${p}-name`} className="text-small font-semibold">
          {labels.name}
        </label>
        <input
          id={`${p}-name`}
          name={F.name}
          type="text"
          autoComplete="name"
          defaultValue={initial.values.name}
          autoFocus={autoFocusOn('name')}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${p}-name-error` : undefined}
          onBlur={(event) => {
            if (pressingSubmit.current) return;
            const long = event.currentTarget.value.trim().length > NAME_MAX;
            setErrors((prev) => ({ ...prev, name: long ? labels.errors.nameTooLong : undefined }));
          }}
          className={cx(CONTROL, 'min-h-target')}
        />
        {errors.name ? (
          <p id={`${p}-name-error`} className="flex gap-1 text-small font-medium text-danger">
            {props.icons.error}
            <span>{errors.name}</span>
          </p>
        ) : null}
      </div>

      {/* Open from the server only with a note error; JS opens it itself (a changing `open` prop
          would close it under the visitor's typing). */}
      <details
        ref={noteBox}
        open={initial.errors.note ? true : undefined}
        className="group md:max-w-[36rem]"
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
            id={`${p}-note`}
            name={F.note}
            rows={3}
            defaultValue={initial.values.note}
            autoFocus={autoFocusOn('note')}
            aria-invalid={errors.note ? true : undefined}
            aria-describedby={describe(
              `${p}-note-counter`,
              Boolean(errors.note) && `${p}-note-error`,
            )}
            onChange={(event) => {
              const length = event.currentTarget.value.length;
              setNoteLength(length);
              setErrors((prev) =>
                prev.note && length <= NOTE_MAX ? { ...prev, note: undefined } : prev,
              );
            }}
            onBlur={(event) => {
              if (pressingSubmit.current) return;
              const long = event.currentTarget.value.length > NOTE_MAX;
              setErrors((prev) => ({
                ...prev,
                note: long ? labels.errors.noteTooLong : undefined,
              }));
            }}
            className={cx(CONTROL, 'min-h-24 resize-y')}
          />
          <span
            id={`${p}-note-counter`}
            dir="ltr"
            className="justify-self-end text-caption text-ink-muted"
          >
            {toPersianDigits(`${noteLength}/${NOTE_MAX}`)}
          </span>
          {errors.note ? (
            <p id={`${p}-note-error`} className="flex gap-1 text-small font-medium text-danger">
              {props.icons.error}
              <span>{errors.note}</span>
            </p>
          ) : null}
        </div>
      </details>

      {props.hidden}
      <input type="hidden" name={F.sourceUrl} defaultValue="" />
      <input type="hidden" name={F.utm} defaultValue="" />
      <div className="grid gap-3">
        {props.privacy}
        {props.aboveSubmit}
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
        {notice ? (
          <p
            role={noticeTone === 'info' ? 'status' : 'alert'}
            tabIndex={-1}
            autoFocus={Boolean(initial.notice) && notice === initial.notice}
            className={cx(
              'grid grid-cols-[auto_1fr] gap-2 text-small font-medium focus:outline-none',
              noticeTone === 'info'
                ? 'rounded-card border border-info-fill bg-[color-mix(in_srgb,var(--color-info-fill)_22%,var(--color-surface-raised))] p-4 text-ink'
                : 'text-danger',
            )}
          >
            {noticeTone === 'info' ? props.icons.info : props.icons.error}
            <span>{labels.notices[notice]}</span>
          </p>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {status}
      </p>
    </form>
  );
}
