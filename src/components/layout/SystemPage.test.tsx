import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { CallBlock } from '@/components/layout/CallBlock';
import { NotFoundView } from '@/components/layout/NotFoundView';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { SystemPage } from '@/components/layout/SystemPage';

describe('system page components (spec 14, D-P6)', () => {
  it('SC1 the 404 body: one H1, lead, service links, call block, emergency link', () => {
    const html = renderToStaticMarkup(<NotFoundView />);
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('این صفحه پیدا نشد');
    expect(html).toContain('href="/خدمات/زیبایی"');
    expect(html).toContain('href="/خدمات/جراحی-و-جایگزینی-دندان"');
    expect(html).toContain('href="/خدمات/درمان-دندان"');
    expect(html).toContain('href="/خدمات"');
    expect(html).toContain('href="/اورژانس"');
    expect(html).toContain('href="tel:+982155101054"');
    expect(html).toContain('<span dir="ltr" class="font-bold text-ink">۰۲۱ ۵۵۱۰ ۱۰۵۴</span>');
    expect(html).toContain('هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.');
  });

  it('SC2 no style attribute in server HTML (the public CSP blocks it)', () => {
    for (const html of [
      renderToStaticMarkup(<NotFoundView />),
      renderToStaticMarkup(<SystemPage heading="h" lead="l" showLinks showUrgent />),
      renderToStaticMarkup(<SiteFooter now={new Date('2026-10-13T08:30:00Z')} />),
    ]) {
      expect(html).not.toMatch(/\sstyle=/);
    }
  });

  it('SC3 the call link is tracked; the 500 variant has no emergency link', () => {
    expect(renderToStaticMarkup(<CallBlock location="footer" />)).toContain(
      'data-track="call_click" data-location="footer"',
    );
    const html = renderToStaticMarkup(<SystemPage heading="مشکلی پیش آمد" lead="l" showLinks />);
    expect(html).not.toContain('/اورژانس');
  });

  it('SC4 footer year is the Jalali year in Persian digits', () => {
    const html = renderToStaticMarkup(<SiteFooter now={new Date('2026-10-13T08:30:00Z')} />);
    expect(html).toContain('© ۱۴۰۵');
  });
});
