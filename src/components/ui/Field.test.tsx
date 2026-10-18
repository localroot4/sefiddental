import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PHONE_ERRORS } from '@/lib/phone';

import { ChipGroup, TextAreaField, TextField } from './Field';

describe('form fields (DESIGN.md Input and Chips; conversion.md 5.2)', () => {
  it('UF1 the label names the control; help is described; no error means valid', () => {
    render(
      <TextField
        id="hero-phone"
        name="phone"
        kind="tel"
        label="شمارهٔ موبایل"
        help="مثلاً ۰۹۱۲ ۳۴۵ ۶۷۸۹"
      />,
    );
    const input = screen.getByLabelText('شمارهٔ موبایل');
    expect(input.getAttribute('aria-describedby')).toBe('hero-phone-help');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('placeholder')).toBe(false);
  });

  it('UF2 an error is announced: aria-invalid and the error id after the help id', () => {
    render(
      <TextField
        id="block-phone"
        name="phone"
        kind="tel"
        label="شمارهٔ موبایل"
        help="مثلاً ۰۹۱۲ ۳۴۵ ۶۷۸۹"
        error={PHONE_ERRORS.invalid}
      />,
    );
    const input = screen.getByLabelText('شمارهٔ موبایل');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('block-phone-help block-phone-error');
    expect(document.getElementById('block-phone-error')?.textContent).toBe(PHONE_ERRORS.invalid);
  });

  it('UF2b an invalid control keeps a danger focus ring (the brand ring would hide the error)', () => {
    render(<TextField id="n" name="name" label="نام" error="نام بلند است." />);
    expect(screen.getByLabelText('نام').className.split(' ')).toContain(
      'aria-invalid:outline-danger',
    );
  });

  it('UF3 the phone field is an LTR island with a numeric keypad and tel autocomplete', () => {
    render(<TextField id="p" name="phone" kind="tel" label="شمارهٔ موبایل" />);
    const input = screen.getByLabelText('شمارهٔ موبایل');
    expect(input.getAttribute('type')).toBe('tel');
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('autocomplete')).toBe('tel');
  });

  it('UF4 inputs are 44 px everywhere, the hero card too (F18); disabled stays disabled', () => {
    render(<TextField id="a" name="a" label="الف" disabled />);
    const a = screen.getByLabelText('الف');
    expect(a.className.split(' ')).toContain('min-h-target');
    expect(a.className).not.toContain('min-h-target-lg');
    expect(a.hasAttribute('disabled')).toBe(true);
  });

  it('UF5 the textarea counter is an LTR island next to the help', () => {
    render(
      <TextAreaField id="note" name="note" label="توضیح (اختیاری)" help="کمک" counter="۰/۵۰۰" />,
    );
    const counter = document.getElementById('note-counter')!;
    expect(counter.getAttribute('dir')).toBe('ltr');
    expect(counter.textContent).toBe('۰/۵۰۰');
    expect(screen.getByLabelText('توضیح (اختیاری)').tagName).toBe('TEXTAREA');
  });

  it('UF6 chips: one radio group in a named fieldset, the default checked, disabled kept', () => {
    render(
      <ChipGroup
        legend="چه زمانی برای نوبت راحت‌ترید؟ (اختیاری)"
        name="time"
        defaultValue="morning"
        options={[
          { value: 'morning', label: 'صبح' },
          { value: 'evening', label: 'عصر' },
          { value: 'any', label: 'فرقی ندارد', disabled: true },
        ]}
      />,
    );
    expect(
      screen.getByRole('group', { name: 'چه زمانی برای نوبت راحت‌ترید؟ (اختیاری)' }),
    ).toBeTruthy();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.name)).toEqual(['time', 'time', 'time']);
    expect(radios.map((r) => r.checked)).toEqual([true, false, false]);
    expect(radios[2]?.disabled).toBe(true);
    expect(screen.getByRole('radio', { name: 'عصر' })).toBe(radios[1]);
  });
});
