import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import SiteError from '@/app/(site)/error';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { CallBlock } from '@/components/layout/CallBlock';
import { NotFoundView } from '@/components/layout/NotFoundView';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { CLINIC_FALLBACK, SYSTEM_LINKS, t, type MessageKey } from '@/i18n/fa';
import * as system from '@/i18n/fa-system';
import { getFooterData, type FooterData } from '@/lib/data/footer';

// No Payload in a component test: the 404 reads the clinic through this reader only.
vi.mock('@/lib/data/footer', () => ({ getFooterData: vi.fn() }));
// An async server component does not render in renderToStaticMarkup; the dialog has its own tests.
vi.mock('@/components/booking/BookingDialog', () => ({ BookingDialog: () => null }));

const CONTACT: FooterData = {
  name: 'کلینیک دندانپزشکی سفید',
  line: null,
  address: null,
  phones: { landline: '+982155101054', mobile: null },
  whatsapp: null,
  hours: 'هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.',
  hoursNote: null,
  maps: [],
  social: [],
  legal: { licenseNumber: null, technicalSupervisor: null },
  popular: [],
  guides: [],
  hubs: { dentists: true, articles: true },
};

const notFound = async (contact: FooterData = CONTACT) => {
  vi.mocked(getFooterData).mockResolvedValue(contact);
  return renderToStaticMarkup(await NotFoundView());
};
const serverError = (digest?: string) =>
  renderToStaticMarkup(
    <SiteError error={Object.assign(new Error('x'), { digest })} retry={() => {}} />,
  );

/** Local modules a file reaches through value imports (`import type` is erased). */
function graph(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const [, spec = ''] of readFileSync(file, 'utf8').matchAll(
    /^import (?!type )[^;]*? from '([^']+)'/gms,
  )) {
    const base = spec.startsWith('@/')
      ? path.join('src', spec.slice(2))
      : spec.startsWith('.')
        ? path.join(path.dirname(file), spec)
        : null;
    const next = base && ['.ts', '.tsx'].map((ext) => base + ext).find((f) => existsSync(f));
    if (next) graph(next, seen);
  }
  return seen;
}

describe('system page components (spec 14, D-P6)', () => {
  it('SC1 the 404 body: one H1, lead, «رزرو نوبت» then the live call, service links, emergency link', async () => {
    const html = await notFound({
      ...CONTACT,
      phones: { landline: '+982155101099', mobile: null },
      hours: null,
      hoursNote: 'این هفته ساعات کاری تغییر کرده است.',
    });
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('این صفحه پیدا نشد');
    expect(html).toContain('href="/خدمات/زیبایی"');
    expect(html).toContain('href="/خدمات/جراحی-و-جایگزینی-دندان"');
    expect(html).toContain('href="/خدمات/درمان-دندان"');
    expect(html).toContain('href="/خدمات"');
    expect(html).toContain('href="/اورژانس"');
    // design-components 3.9: the clinic's own number and hours, not the static fallback.
    expect(html).toContain('href="tel:+982155101099"');
    expect(html).toMatch(/<span dir="ltr" class="[^"]*">۰۲۱ ۵۵۱۰ ۱۰۹۹<\/span>/);
    expect(html).toContain('این هفته ساعات کاری تغییر کرده است.');
    expect(html).not.toContain(CLINIC_FALLBACK.hoursLine);
    // C8: booking is the primary action, the call the secondary one, in that order.
    const booking = html.indexOf('href="/رزرو-نوبت"');
    const call = html.indexOf('href="tel:+982155101099"');
    expect(booking).toBeGreaterThan(-1);
    expect(booking).toBeLessThan(call);
    expect(html.slice(call, call + 600)).toContain('border-brand text-brand-strong');
    expect(html).toContain('data-call-sheet=""');
  });

  it('SC2 no style attribute in server HTML (the public CSP blocks it)', async () => {
    for (const html of [
      await notFound(),
      serverError('d1'),
      renderToStaticMarkup(<SiteFooter contact={CONTACT} now={new Date('2026-10-13T08:30:00Z')} />),
    ]) {
      expect(html).not.toMatch(/\sstyle=/);
    }
  });

  it('SC3 the call link is tracked; the 500 keeps the call as its primary action and no emergency link', () => {
    expect(
      renderToStaticMarkup(
        <CallBlock
          label="c"
          phoneE164="+982155101054"
          phoneDisplay="d"
          hoursLine={null}
          location="footer"
        />,
      ),
    ).toContain('data-track="call_click" data-location="footer"');
    const html = serverError('d1');
    expect(html).toContain(`>${t('error.heading')}</h1>`);
    expect(html).toContain('href="tel:+982155101054"');
    expect(html).toContain(CLINIC_FALLBACK.hoursLine);
    expect(html).toContain('href="/خدمات/زیبایی"');
    expect(html).toContain('d1</span>');
    expect(html).not.toContain('/اورژانس');
    expect(html).not.toContain('/رزرو-نوبت');
    expect(html).toContain('bg-brand text-on-brand');
  });

  it('SC4 footer year is the Jalali year in Persian digits', () => {
    const html = renderToStaticMarkup(
      <SiteFooter contact={CONTACT} now={new Date('2026-10-13T08:30:00Z')} />,
    );
    expect(html).toContain('© ۱۴۰۵');
  });

  it('SC5 the 500 boundary, loaded on every page, reaches neither fa.ts nor icon code (F1, F2)', () => {
    const reached = graph(path.join('src', 'app', '(site)', 'error.tsx'));
    expect(reached).toContain(path.join('src', 'components', 'layout', 'SystemPage.tsx'));
    for (const heavy of [
      'src/i18n/fa.ts',
      'src/components/ui/Icon.tsx',
      'src/components/ui/icons.ts',
    ]) {
      expect(reached).not.toContain(path.join(...heavy.split('/')));
    }
  });

  it('SC6 the 500 copy in fa-system.ts matches the messages of fa.ts (one wording)', () => {
    for (const [key, value] of Object.entries(system.SYSTEM_MESSAGES)) {
      expect(t(key as MessageKey)).toBe(value);
    }
    expect(system.CLINIC_FALLBACK).toEqual(CLINIC_FALLBACK);
    expect(system.SYSTEM_LINKS).toEqual(SYSTEM_LINKS);
  });
});

describe('brand logo', () => {
  it('BL1 the outer viewBox starts at 0 0: <use> draws the symbol there, an offset crops it', () => {
    const html = renderToStaticMarkup(<BrandLogo label="کلینیک" />);
    expect(html).toContain('viewBox="0 0 1052.6 280.0"');
    expect(html).toMatch(/<use href="\/brand\/lockup\.svg\?v=[0-9a-f]{8}#lockup"/);
  });
});
