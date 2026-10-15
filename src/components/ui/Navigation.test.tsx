import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Breadcrumbs, pageItems, Pagination } from './Navigation';

describe('breadcrumbs and pagination (DESIGN.md 3.26, 3.27)', () => {
  it('UN1 pageItems: all pages up to seven, then first, last, neighbours and gaps', () => {
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
    expect(pageItems(1, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10]);
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageItems(7, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
    // Near the ends five pages stay: a gap always hides two pages or more.
    expect(pageItems(5, 8)).toEqual([1, 'gap', 4, 5, 6, 7, 8]);
    expect(pageItems(4, 9)).toEqual([1, 2, 3, 4, 5, 'gap', 9]);
    // Out of range and broken input stay safe.
    expect(pageItems(99, 10)).toEqual([1, 'gap', 6, 7, 8, 9, 10]);
    expect(pageItems(Number.NaN, 2)).toEqual([1, 2]);
    expect(pageItems(1, 0)).toEqual([]);
  });

  it('UN2 pagination: Persian digits, the current page marked, prev and next named', () => {
    render(<Pagination current={2} total={3} href={(n) => `?page=${n}`} />);
    const nav = screen.getByRole('navigation', { name: 'صفحه‌بندی' });
    const current = within(nav).getByRole('link', { name: 'صفحهٔ ۲' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.textContent).toBe('۲');
    expect(within(nav).getByRole('link', { name: 'صفحهٔ قبل' }).getAttribute('href')).toBe(
      '?page=1',
    );
    expect(within(nav).getByRole('link', { name: 'صفحهٔ بعد' }).getAttribute('href')).toBe(
      '?page=3',
    );
  });

  it('UN3 on the first page «صفحهٔ قبل» is no link at all (D-3); one page renders nothing', () => {
    const { container } = render(<Pagination current={1} total={2} href={(n) => `?page=${n}`} />);
    expect(screen.queryByRole('link', { name: 'صفحهٔ قبل' })).toBeNull();
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
    const single = render(<Pagination current={1} total={1} href={(n) => `?page=${n}`} />);
    expect(single.container.innerHTML).toBe('');
  });

  it('UN4 RTL: prev uses the back glyph and next the forward glyph, both mirrored (D-2)', () => {
    render(<Pagination current={2} total={3} href={(n) => `?page=${n}`} />);
    const prev = screen.getByRole('link', { name: 'صفحهٔ قبل' }).querySelector('svg')!;
    const next = screen.getByRole('link', { name: 'صفحهٔ بعد' }).querySelector('svg')!;
    expect(prev.querySelector('use')!.getAttribute('href')).toMatch(/#caret-back$/);
    expect(next.querySelector('use')!.getAttribute('href')).toMatch(/#caret-forward$/);
    expect(prev.getAttribute('class')).toContain('rtl:-scale-x-100');
    expect(next.getAttribute('class')).toContain('rtl:-scale-x-100');
  });

  it('UN7 more than five items: phones swap the numbers for «صفحهٔ ۵ از ۱۲» (fits 358 px)', () => {
    const { container } = render(<Pagination current={5} total={12} href={(n) => `?page=${n}`} />);
    const status = screen.getByText('صفحهٔ ۵ از ۱۲');
    expect(status.className).toContain('md:hidden');
    const numbered = [...container.querySelectorAll('li')].filter((li) => li !== status);
    // Seven numbers and gaps hide on phones; the two arrows stay.
    expect(numbered.filter((li) => li.className.includes('max-md:hidden'))).toHaveLength(7);
    expect(numbered.filter((li) => !li.className.includes('max-md:hidden'))).toHaveLength(2);
    const short = render(<Pagination current={2} total={5} href={(n) => `?page=${n}`} />);
    expect(short.container.innerHTML).not.toContain('max-md:hidden');
    expect(within(short.container).queryByText(/ از /)).toBeNull();
  });

  it('UN6 a broken current page (NaN, a fraction) is clamped the same way in every link', () => {
    const nan = render(<Pagination current={Number('abc')} total={3} href={(n) => `?page=${n}`} />);
    expect(nan.getByRole('link', { name: 'صفحهٔ ۱' }).getAttribute('aria-current')).toBe('page');
    expect(nan.getByRole('link', { name: 'صفحهٔ بعد' }).getAttribute('href')).toBe('?page=2');
    nan.unmount();
    render(<Pagination current={2.5} total={3} href={(n) => `?page=${n}`} />);
    expect(screen.getByRole('link', { name: 'صفحهٔ ۲' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'صفحهٔ قبل' }).getAttribute('href')).toBe('?page=1');
    expect(screen.getByRole('link', { name: 'صفحهٔ بعد' }).getAttribute('href')).toBe('?page=3');
  });

  it('UN5 breadcrumbs: links up the path, the page as aria-current, only the parent on phones', () => {
    render(
      <Breadcrumbs
        items={[
          { label: 'خانه', href: '/' },
          { label: 'خدمات', href: '/خدمات' },
          { label: 'زیبایی', href: '/خدمات/زیبایی' },
          { label: 'لمینت سرامیکی' },
        ]}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'مسیر صفحه' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/', '/خدمات', '/خدمات/زیبایی']);
    expect(within(nav).getByText('لمینت سرامیکی').getAttribute('aria-current')).toBe('page');
    const items = within(nav).getAllByRole('listitem');
    // Hidden under 744 px except the parent, which carries the back chevron.
    expect(items.map((li) => li.className.includes('hidden md:inline-flex'))).toEqual([
      true,
      true,
      false,
      true,
    ]);
    expect(items[2]!.querySelector('use')!.getAttribute('href')).toMatch(/#caret-back$/);
  });
});
