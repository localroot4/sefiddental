import { fireEvent, render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TierComparison, type TierColumn } from './Tiers';

const TIERS: TierColumn[] = ['standard', 'vip', 'cip'].map((key) => ({
  key,
  name: key.toUpperCase(),
  summary: `${key} line`,
  rows: [],
}));

const choice = {
  name: 'restoration-tier',
  legend: 'سطح ترمیم',
  badge: 'انتخاب شما',
  action: (key: string | null) => <a href={`/book${key ? `?tier=${key}` : ''}`}>رزرو نوبت</a>,
};

describe('tier choice mode (freeze G13, F24)', () => {
  it('TC1 server HTML: a named radio per card, none checked, the group named by its legend', () => {
    const html = renderToStaticMarkup(
      <TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />,
    );
    expect(html).not.toMatch(/<input[^>]*checked/);
    expect(html).not.toContain('انتخاب این سطح'); // banned label (conversion.md 2)
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const group = screen.getByRole('group', { name: 'سطح ترمیم' });
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => [r.getAttribute('name'), (r as HTMLInputElement).value])).toEqual([
      ['restoration-tier', 'standard'],
      ['restoration-tier', 'vip'],
      ['restoration-tier', 'cip'],
    ]);
    expect(group.contains(radios[0]!)).toBe(true);
    // Each radio is named by its tier, inside the card heading.
    expect(screen.getByRole('radio', { name: 'VIP' }).closest('h3')).not.toBeNull();
  });

  it('TC2 the checked card turns warm and shows its badge through CSS alone', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const card = screen.getByRole('radio', { name: 'VIP' }).closest('article')!;
    expect(card.className).toContain('has-[input:checked]:bg-warm-soft');
    expect(card.className).toContain('has-[input:checked]:border-warm');
    expect(card.className).not.toMatch(/(^|\s)bg-warm-soft/);
    const badge = [...card.querySelectorAll('span')].findLast(
      (s) => s.textContent === 'انتخاب شما',
    );
    expect(badge?.parentElement?.className).toMatch(/^hidden group-has-\[input:checked\]\/card:/);
    fireEvent.click(card.querySelector('label')!); // the label covers the card (::after)
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked);
    expect(checked.map((r) => (r as HTMLInputElement).value)).toEqual(['vip']);
  });

  it('TC3 one CTA for no tier and one per tier; CSS shows the no-tier one until a choice', () => {
    const { container } = render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/book',
      '/book?tier=standard',
      '/book?tier=vip',
      '/book?tier=cip',
    ]);
    const wrappers = links.map((a) => a.parentElement!.className);
    expect(wrappers[0]).toBe('group-has-[input:checked]/tiers:hidden');
    expect(wrappers.slice(1)).toEqual([
      'hidden group-has-[article:nth-of-type(1)_input:checked]/tiers:block',
      'hidden group-has-[article:nth-of-type(2)_input:checked]/tiers:block',
      'hidden group-has-[article:nth-of-type(3)_input:checked]/tiers:block',
    ]);
    // The radios and the CTAs share the group the CSS reads.
    expect(container.querySelector('.group\\/tiers')?.querySelectorAll('input')).toHaveLength(3);
  });

  it('TC5 the card fades with the motion tokens, so reduced motion makes the change instant', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const card = screen.getByRole('radio', { name: 'VIP' }).closest('article')!;
    expect(card.className).toMatch(/(^|\s)transition-colors(\s|$)/);
    // A literal duration ignores --dur-* (globals.css), which reduced motion sets to 0.
    expect(card.className).not.toMatch(/(^|\s)duration-/);
  });

  it('TC4 without choice the comparison stays static and keyboard-scrollable (phase 4)', () => {
    const html = renderToStaticMarkup(<TierComparison label="سطح‌ها" tiers={TIERS} />);
    expect(html).not.toContain('<input');
    expect(html).toContain('tabindex="0"');
  });
});
