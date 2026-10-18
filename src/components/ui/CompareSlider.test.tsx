import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { track } from '@/lib/track/track';

import { CompareSlider } from './CompareSlider';

vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));

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

  it('CM4 case_slider_use: once per slider, on the first move by pointer or keys, with the service key', () => {
    const html = renderToStaticMarkup(
      <CompareSlider before={<i />} after={<b />} handle={<s />} labels={labels} />,
    );
    // Not a click event: a click that does not move the divider is no use.
    expect(html).not.toContain('data-track');
    render(
      <div data-service-key="restoration">
        <CompareSlider before={<i />} after={<b />} handle={<s />} labels={labels} />
      </div>,
    );
    const range = screen.getByRole('slider');
    fireEvent.click(range);
    expect(track).not.toHaveBeenCalled();
    fireEvent.keyDown(range, { key: 'ArrowLeft' });
    fireEvent.change(range, { target: { value: '51' } }); // what the arrow key does
    fireEvent.change(range, { target: { value: '80' } }); // then a drag
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('case_slider_use', {
      location: 'section',
      serviceKey: 'restoration',
    });
  });

  it('CM5 every consent caption under a slider wraps pretty: no lone last word (screens 43)', () => {
    // A figcaption or span is not a <p>, so the base `p { text-wrap: pretty }` misses it.
    const dir = path.resolve('src/components');
    const files = readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter(
      (file) => file.endsWith('.tsx') && !file.endsWith('.test.tsx'),
    );
    const captions = files.flatMap((file) => [
      ...readFileSync(path.join(dir, file), 'utf8').matchAll(
        /className="([^"]*)"\s*>\s*\{t\('ui\.compare\.consent'\)\}/g,
      ),
    ]);
    expect(captions.length).toBeGreaterThanOrEqual(3); // service, dentist profile, home
    for (const [, cls] of captions) expect(cls!.split(' ')).toContain('text-pretty');
  });
});
