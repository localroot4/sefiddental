import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CompareSlider } from './CompareSlider';

const labels = { before: 'قبل', after: 'بعد', slider: 'مقایسهٔ قبل و بعد', percent: 'درصد' };

describe('compare slider (DESIGN.md 3.21)', () => {
  it('CM1 server HTML: a named range at 50 with Persian value text, the clip in CSS, no style attribute', () => {
    const html = renderToStaticMarkup(
      <CompareSlider before={<i />} after={<b />} handle={<s />} labels={labels} />,
    );
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).toContain('[--pos:50]');
    expect(html).toContain('aria-label="مقایسهٔ قبل و بعد"');
    expect(html).toContain('aria-valuetext="۵۰ درصد"');
  });

  it('CM2 moving the range writes --pos through CSSOM and updates the value text', () => {
    const { container } = render(
      <CompareSlider before={<i />} after={<b />} handle={<s />} labels={labels} />,
    );
    const range = screen.getByRole('slider', { name: 'مقایسهٔ قبل و بعد' });
    fireEvent.change(range, { target: { value: '73' } });
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--pos')).toBe('73');
    expect(range.getAttribute('aria-valuetext')).toBe('۷۳ درصد');
  });

  it('CM3 labels sit at the start and end sides; the clip has an LTR counterpart', () => {
    const html = renderToStaticMarkup(
      <CompareSlider before={<i />} after={<b />} handle={<s />} labels={labels} />,
    );
    expect(html).toMatch(/start-3[^"]*">قبل</);
    expect(html).toMatch(/end-3[^"]*">بعد</);
    expect(html).toContain('[clip-path:inset(0_calc(var(--pos)*1%)_0_0)]');
    expect(html).toContain('ltr:[clip-path:inset(0_0_0_calc(var(--pos)*1%))]');
  });
});
