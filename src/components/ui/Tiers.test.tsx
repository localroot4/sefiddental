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
    expect(html).not.toMatch(/<input[^>]*\schecked=/); // the attribute, not a checked: class
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

  it('TC2 the checked card turns warm and shows its badge: data-checked with JavaScript, :has() only without', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const card = screen.getByRole('radio', { name: 'VIP' }).closest('article')!;
    expect(card.hasAttribute('data-choice-item')).toBe(true);
    const cls = card.className.split(' ');
    expect(cls).toContain('data-checked:bg-warm-soft');
    expect(cls).toContain('data-checked:border-warm');
    expect(cls).toContain('noscript:has-[input:checked]:bg-warm-soft');
    expect(cls).toContain('noscript:has-[input:checked]:border-warm');
    expect(card.className).not.toMatch(/(^|\s)bg-warm-soft/);
    const badge = [...card.querySelectorAll('span')].findLast(
      (s) => s.textContent === 'انتخاب شما',
    );
    expect(badge?.parentElement?.className).toBe(
      'hidden group-data-checked/card:block noscript:group-has-[input:checked]/card:block',
    );
    fireEvent.click(card.querySelector('label')!); // the label covers the card (::after)
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked);
    expect(checked.map((r) => (r as HTMLInputElement).value)).toEqual(['vip']);
  });

  it('TC3 one CTA for no tier and one per tier; CSS shows the no-tier one until a choice (data-choice, :has() only without JavaScript)', () => {
    const { container } = render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const links = [...container.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/book',
      '/book?tier=standard',
      '/book?tier=vip',
      '/book?tier=cip',
    ]);
    const wrappers = links.map((a) => a.parentElement!.className);
    expect(wrappers[0]).toBe(
      'group-data-choice/tiers:hidden noscript:group-has-[input:checked]/tiers:hidden',
    );
    expect(wrappers.slice(1)).toEqual([
      'hidden group-data-[choice=1]/tiers:block noscript:group-has-[article:nth-of-type(1)_input:checked]/tiers:block',
      'hidden group-data-[choice=2]/tiers:block noscript:group-has-[article:nth-of-type(2)_input:checked]/tiers:block',
      'hidden group-data-[choice=3]/tiers:block noscript:group-has-[article:nth-of-type(3)_input:checked]/tiers:block',
    ]);
    // The radios and the CTAs share the group the CSS reads; choices.ts finds it by data-choices.
    const group = container.querySelector('.group\\/tiers');
    expect(group?.hasAttribute('data-choices')).toBe(true);
    expect(group?.hasAttribute('data-choice')).toBe(false); // none chosen in the server HTML
    expect(group?.querySelectorAll('input')).toHaveLength(3);
  });

  it('TC5 the card fades with the motion tokens, so reduced motion makes the change instant', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const card = screen.getByRole('radio', { name: 'VIP' }).closest('article')!;
    expect(card.className).toMatch(/(^|\s)transition-colors(\s|$)/);
    // A literal duration ignores --dur-* (globals.css), which reduced motion sets to 0.
    expect(card.className).not.toMatch(/(^|\s)duration-/);
  });

  it('TC6 three columns from 744 px: the scroller is only for phones (screens 21)', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const scroller = screen.getByRole('region', { name: 'سطح‌ها' }).className.split(' ');
    for (const cls of [
      'md:mx-0',
      'md:grid-flow-row',
      'md:grid-cols-3',
      'md:overflow-visible',
      'md:px-0',
    ]) {
      expect(scroller).toContain(cls);
    }
    expect(scroller.filter((cls) => cls.startsWith('lg:'))).toEqual([]);
  });

  it('TC6b a narrow card moves the badge under the name instead of breaking it in two', () => {
    const { container } = render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const badge = screen.getAllByText('انتخاب شما')[0]!;
    expect(badge.className.split(' ')).toContain('whitespace-nowrap');
    const row = container.querySelector('h3, h4')?.parentElement as HTMLElement;
    expect(row.className.split(' ')).toContain('flex-wrap');
  });

  it('TC7 the radio is drawn: 20 px, the input border, a brand ring when checked, in both themes (screens 23)', () => {
    render(<TierComparison label="سطح‌ها" tiers={TIERS} choice={choice} />);
    const radio = screen.getByRole('radio', { name: 'VIP' }).className.split(' ');
    for (const cls of [
      'appearance-none',
      'size-[1.25rem]',
      'rounded-full',
      'border-line-strong',
      'bg-surface-raised',
      'checked:border-brand',
    ]) {
      expect(radio).toContain(cls);
    }
    // size-5 is not on the spacing scale (globals.css), so it drew a native 13 px radio.
    expect(radio).not.toContain('size-5');
  });

  it('TC4 without choice the comparison stays static and keyboard-scrollable (phase 4)', () => {
    const html = renderToStaticMarkup(<TierComparison label="سطح‌ها" tiers={TIERS} />);
    expect(html).not.toContain('<input');
    expect(html).toContain('tabindex="0"');
  });
});
