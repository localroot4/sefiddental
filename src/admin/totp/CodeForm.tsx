'use client';

import { toast } from '@payloadcms/ui';
import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';

import { codeDigits } from './code';
import styles from './totp.module.css';

interface Props {
  /** The plugin's endpoint: `/api/setup-totp` or `/api/verify-totp`. */
  action: string;
  /** Checked on the server (safeBackPath): where an accepted code leads. */
  back: string;
  clearLabel: string;
  failedMessage: string;
  /** One accessible name per box; their count is the code's length. */
  labels: string[];
}

/**
 * The code input of the TOTP screens: one box per digit, left to right as the code reads. Takes
 * Persian and Arabic-Indic digits, a pasted or autofilled code (spaces dropped) and submits once
 * the boxes are full. A refused code empties the boxes and focuses the first.
 */
export function CodeForm({ action, back, clearLabel, failedMessage, labels }: Props) {
  const length = labels.length;
  const empty = () => Array<string>(length).fill('');
  const [digits, setDigits] = useState(empty);
  const [pending, setPending] = useState(false);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  const focus = (index: number) => {
    const box = boxes.current[Math.max(0, Math.min(index, length - 1))];
    box?.focus();
    box?.select();
  };

  const submit = async (code: string) => {
    setPending(true);
    let message: string | undefined;
    try {
      const response = await fetch(action, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        errors?: { message?: string }[];
      };
      // A full navigation: the auth strategy must run again with the new cookie.
      if (data.ok) {
        location.replace(back);
        return;
      }
      // The plugin's refusal, or the proxy's and Payload's error shape (429: too many attempts).
      message = data.message ?? data.errors?.[0]?.message;
    } catch (error) {
      // Network or a body that is not JSON: the toast below says so; the console keeps the cause.
      console.error(`TOTP code: ${action} failed`, error);
    }
    toast.error(message || failedMessage);
    flushSync(() => {
      setPending(false);
      setDigits(empty());
    });
    focus(0);
  };

  /** Writes `text`'s digits from box `start` on; a full code always starts at the first box. */
  const fill = (start: number, text: string) => {
    const typed = codeDigits(text).slice(0, length);
    if (!typed) return;
    const from = typed.length === length ? 0 : start;
    const next = [...digits];
    for (const [offset, digit] of [...typed].entries()) {
      if (from + offset < length) next[from + offset] = digit;
    }
    setDigits(next);
    if (next.every(Boolean)) void submit(next.join(''));
    else focus(from + typed.length);
  };

  const clear = () => {
    setDigits(empty());
    focus(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
    } else if (event.key === 'Backspace' && !digits[index] && index > 0) {
      // On an empty box, Backspace deletes the digit before it, not only moves there.
      event.preventDefault();
      setDigits(digits.map((d, i) => (i === index - 1 ? '' : d)));
      focus(index - 1);
    } else if (
      digits[index] &&
      event.key.length === 1 &&
      codeDigits(event.key) &&
      !(event.ctrlKey || event.metaKey || event.altKey)
    ) {
      // A digit on a filled box replaces it wherever the caret is; maxLength would drop it.
      event.preventDefault();
      fill(index, event.key);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      focus(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>, index: number) => {
    event.preventDefault();
    fill(index, event.clipboardData.getData('text'));
  };

  return (
    <form className={styles.form} aria-busy={pending} onSubmit={(e) => e.preventDefault()}>
      {/* For autofill (autocomplete="one-time-code"); the boxes are what people type in. */}
      <input
        aria-hidden="true"
        autoComplete="one-time-code"
        className={styles.autofill}
        inputMode="numeric"
        onChange={(e) => {
          fill(0, e.currentTarget.value);
          e.currentTarget.value = '';
        }}
        tabIndex={-1}
      />
      <div className={styles.boxes} dir="ltr">
        {labels.map((label, index) => (
          <input
            // Keeps password managers (1Password) from filling a single box.
            data-1p-ignore
            aria-label={label}
            autoComplete="off"
            // The page's only task.
            autoFocus={index === 0}
            disabled={pending}
            inputMode="numeric"
            key={label}
            maxLength={1}
            onChange={(e) => {
              const value = e.currentTarget.value;
              if (value) fill(index, value);
              else setDigits(digits.map((d, i) => (i === index ? '' : d)));
            }}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => onKeyDown(e, index)}
            onPaste={(e) => onPaste(e, index)}
            ref={(el) => {
              boxes.current[index] = el;
            }}
            type="text"
            value={digits[index]}
          />
        ))}
      </div>
      <button className={styles.action} disabled={pending} onClick={clear} type="button">
        {clearLabel}
      </button>
    </form>
  );
}

/** Copies the setup secret, named in words (Payload's CopyToClipboard has only an icon). */
export function CopyButton({ value, label, done }: { value: string; label: string; done: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(value).then(
      () => setCopied(true),
      (error: unknown) => {
        // No clipboard (an insecure origin, a denied permission): the code stays selectable.
        console.error('TOTP setup: copying the secret failed', error);
      },
    );
  return (
    <button className={styles.action} onClick={() => void copy()} type="button">
      {copied ? done : label}
    </button>
  );
}
