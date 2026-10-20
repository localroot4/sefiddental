import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Media } from '@/payload-types';

import { PersonBox } from '@/components/ui/Article';

import { ArticleCta, ArticleList, CategoryChips, ShareLinks } from './articleParts';

const COVER = {
  id: 1,
  alt: 'نمای نزدیک لبخند',
  url: '/api/media/file/cover.jpg',
  width: 1600,
  height: 900,
} as Media;

const card = (id: number, slug: string) => ({
  id,
  title: slug.replaceAll('-', ' '),
  slug,
  excerpt: 'خلاصهٔ کوتاه مقاله.',
  cover: COVER,
  publishedAt: '2026-10-11T08:00:00.000Z',
  contentUpdatedAt: null,
  readingTime: 4,
});

describe('article parts (T-articles, T-article)', () => {
  it('AP1 no published article: one sentence and one action to the services, no card', () => {
    const { container } = render(<ArticleList articles={[]} />);
    expect(screen.getByText(/هنوز مقاله‌ای منتشر نشده است/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'همهٔ خدمات' }).getAttribute('href')).toBe('/خدمات');
    expect(container.querySelectorAll('article')).toHaveLength(0);
  });

  it('AP2 one card per article: title links the post, the cover keeps its alt and loads lazily', () => {
    const { container } = render(
      <ArticleList articles={[card(1, 'مقاله-اول'), card(2, 'مقاله-دوم')]} />,
    );
    expect(container.querySelectorAll('article')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'مقاله اول' }).getAttribute('href')).toBe(
      '/مقالات/مقاله-اول',
    );
    const img = container.querySelector('img:not([aria-hidden])');
    expect(img?.getAttribute('alt')).toBe(COVER.alt);
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('AP3 category chips: «همه» to the hub, each category to its page, the current one marked', () => {
    render(
      <CategoryChips
        categories={[
          { id: 4, title: 'جایگزینی دندان', slug: 'جایگزینی-دندان' },
          { id: 5, title: 'زیبایی لبخند', slug: 'زیبایی-لبخند' },
        ]}
        current={5}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'دسته‌های مقاله' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/مقالات',
      '/مقالات/دسته/جایگزینی-دندان',
      '/مقالات/دسته/زیبایی-لبخند',
    ]);
    expect(links.map((a) => a.getAttribute('aria-current'))).toEqual([null, null, 'page']);
  });

  it('AP4 share links are plain anchors with the encoded canonical URL, no clinic number', () => {
    // As absoluteUrl gives it: the percent-encoded href.
    const url = new URL('/مقالات/ایمپلنت', 'https://sefid.example').href;
    render(<ShareLinks url={url} title="ایمپلنت یا بریج" />);
    const telegram = screen.getByRole('link', { name: 'در تلگرام' }).getAttribute('href');
    const whatsapp = screen.getByRole('link', { name: 'در واتساپ' }).getAttribute('href');
    expect(telegram).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent('ایمپلنت یا بریج')}`,
    );
    expect(whatsapp).toBe(`https://wa.me/?text=${encodeURIComponent(`ایمپلنت یا بریج ${url}`)}`);
  });

  it('AP5 person boxes: a dentist links the profile, a staff author has no link, the review date is Jalali', () => {
    const { container, rerender } = render(
      <PersonBox
        role="بازبین پزشکی"
        name="دکتر نمونه"
        href="/پزشکان/دکتر-نمونه"
        date={{ label: 'تاریخ بازبینی:', value: '2026-10-10T08:30:00.000Z' }}
      />,
    );
    expect(screen.getByRole('link', { name: 'دکتر نمونه' }).getAttribute('href')).toBe(
      '/پزشکان/دکتر-نمونه',
    );
    const time = container.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-10-10T08:30:00.000Z');
    expect(time?.textContent).toBe('۱۸ مهر ۱۴۰۵');
    rerender(<PersonBox role="نویسنده" name="سارا رضایی" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('سارا رضایی')).toBeTruthy();
  });

  it('AP6 one CTA: the primary service box books that service; without one, pricing and booking', () => {
    const { container, rerender } = render(
      <ArticleCta
        service={{
          key: 'implant',
          navLabel: 'ایمپلنت دندان',
          slug: 'ایمپلنت-دندان',
          summary: 'یک جملهٔ کوتاه.',
        }}
      />,
    );
    const book = screen.getByRole('link', { name: 'رزرو نوبت' });
    expect(book.getAttribute('href')).toBe('/رزرو-نوبت?service=implant');
    expect(book.getAttribute('data-track')).toBe('booking_open');
    expect(book.getAttribute('data-location')).toBe('article');
    expect(screen.getByRole('link', { name: 'دربارهٔ ایمپلنت دندان' }).getAttribute('href')).toBe(
      '/خدمات/ایمپلنت-دندان',
    );
    expect(container.querySelectorAll('a[href^="/رزرو-نوبت"]')).toHaveLength(1);
    rerender(<ArticleCta service={null} />);
    expect(screen.getByRole('link', { name: 'رزرو نوبت' }).getAttribute('href')).toBe('/رزرو-نوبت');
    expect(screen.getByRole('link', { name: 'هزینه و پرداخت' }).getAttribute('href')).toBe(
      '/هزینه-و-پرداخت',
    );
  });
});
