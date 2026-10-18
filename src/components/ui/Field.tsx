import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import { cx } from './cx';
import { Icon } from './Icon';

/**
 * Form fields (DESIGN.md Input, conversion.md 5.1 and 5.2): label above, control, help, then the
 * error under the help. No placeholders: examples live in the help text. `aria-describedby` lists
 * the help and the error, `aria-invalid` marks the error. Validation timing and focus belong to
 * the owning form island; these components only render a state, so islands and server
 * components share them.
 */

type FieldText = { id: string; label: ReactNode; help?: ReactNode; error?: ReactNode };

/** Ids of the help and error lines of a field, for `aria-describedby`. */
export function describedBy(props: FieldText): string | undefined {
  const ids = [props.help ? `${props.id}-help` : '', props.error ? `${props.id}-error` : ''];
  return ids.filter(Boolean).join(' ') || undefined;
}

export const CONTROL =
  'w-full rounded-input border-[1.5px] border-line-strong bg-surface-raised px-4 py-2 leading-[1.5] text-ink transition-colors hover:not-disabled:not-aria-invalid:border-ink-muted focus-visible:border-brand aria-invalid:border-danger aria-invalid:outline-danger disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-50';

function FieldShell(
  props: FieldText & { children: ReactNode; footer?: ReactNode; className?: string },
) {
  return (
    <div className={cx('grid content-start gap-2', props.className)}>
      <label htmlFor={props.id} className="text-small font-semibold">
        {props.label}
      </label>
      {props.children}
      {props.help || props.footer ? (
        <div className="flex items-start justify-between gap-3">
          {props.help ? (
            <p id={`${props.id}-help`} className="text-caption text-ink-muted">
              {props.help}
            </p>
          ) : null}
          {props.footer}
        </div>
      ) : null}
      {props.error ? (
        <p id={`${props.id}-error`} className="flex gap-1 text-small font-medium text-danger">
          <Icon name="warning-circle" size="sm" className="mt-[.15em]" />
          <span>{props.error}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Text or phone input. `tel` is an LTR island with a numeric keypad and `autocomplete="tel"`;
 * its text starts at the inline start of its LTR box. 44 px everywhere, the hero card too (F18).
 */
export function TextField({
  id,
  label,
  help,
  error,
  kind = 'text',
  className,
  ...input
}: FieldText & {
  kind?: 'text' | 'tel';
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type' | 'children'>) {
  const tel = kind === 'tel';
  return (
    <FieldShell id={id} label={label} help={help} error={error} className={className}>
      <input
        autoComplete={tel ? 'tel' : undefined}
        inputMode={tel ? 'numeric' : undefined}
        {...input}
        id={id}
        type={tel ? 'tel' : 'text'}
        dir={tel ? 'ltr' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, label, help, error })}
        className={cx(CONTROL, 'min-h-target', tel && 'text-start')}
      />
    </FieldShell>
  );
}

/** Multi-line field with an optional live counter («۰/۵۰۰», an LTR island the island updates). */
export function TextAreaField({
  id,
  label,
  help,
  error,
  counter,
  className,
  ...textarea
}: FieldText & { counter?: string; className?: string } & Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'id' | 'children'
  >) {
  return (
    <FieldShell
      id={id}
      label={label}
      help={help}
      error={error}
      className={className}
      footer={
        counter ? (
          <span id={`${id}-counter`} dir="ltr" className="shrink-0 text-caption text-ink-muted">
            {counter}
          </span>
        ) : null
      }
    >
      <textarea
        {...textarea}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy({ id, label, help, error })}
        className={cx(CONTROL, 'min-h-24 resize-y')}
      />
    </FieldShell>
  );
}

/**
 * One radio styled as a 44 px pill (DESIGN.md Chips): the native input covers the label at
 * opacity 0, so arrow keys move inside the group and the ring shows on the pill.
 */
export function Chip({
  label,
  className,
  ...input
}: { label: ReactNode; className?: string } & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'children'
>) {
  return (
    <label
      className={cx(
        'relative inline-flex min-h-target cursor-pointer items-center gap-1 rounded-pill border-[1.5px] border-line-strong bg-surface-raised px-4 text-small font-medium transition-colors',
        'hover:not-has-disabled:border-brand has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand-strong',
        'outline-offset-2 outline-focus has-focus-visible:outline-2 has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
    >
      <input
        {...input}
        type="radio"
        className="absolute inset-0 m-0 size-full cursor-pointer rounded-[inherit] opacity-0 disabled:cursor-not-allowed"
      />
      {label}
    </label>
  );
}

/** A radio group of chips in a fieldset with its legend. */
export function ChipGroup(props: {
  legend: ReactNode;
  name: string;
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <fieldset className={cx('min-w-0', props.className)}>
      <legend className="mb-2 text-small font-semibold">{props.legend}</legend>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => (
          <Chip
            key={option.value}
            name={props.name}
            value={option.value}
            label={option.label}
            disabled={option.disabled}
            defaultChecked={option.value === props.defaultValue}
          />
        ))}
      </div>
    </fieldset>
  );
}
