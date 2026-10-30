import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import type { NavTree } from '@/lib/data/catalog';
import type { FooterData } from '@/lib/data/footer';

import { ClosedSheet } from './ClosedSheet';
import { StickyBar } from './StickyBar';

// The route the client leaves (NavLink, SectionButton) read; null as outside the App Router.
const route = vi.hoisted(() => ({ pathname: null as string | null }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
// The fallbacks live next to the readers; no Payload in a component test.
vi.mock('@/lib/data/published', () => ({ getPublished: vi.fn() }));
vi.mock('@/lib/data/globals', () => ({ getClinic: vi.fn() }));
vi.mock('@/lib/data/content', () => ({ getGuides: vi.fn() }));
const { NAV_FALLBACK } = await import('@/lib/data/catalog');
const { FOOTER_FALLBACK } = await import('@/lib/data/footer');

const NAV: NavTree = {
  groups: [
    {
      key: 'cosmetic',
      label: 'زیبایی',
      title: 'زیبایی دندان',
      path: '/خدمات/زیبایی',
      items: [{ key: 'veneers', label: 'لمینت سرامیکی', path: '/خدمات/لمینت-سرامیکی' }],
    },
    // Database down: a category without its services.
    {
      key: 'restorative',
      label: 'درمان و نگهداری',
      title: 'درمان',
      path: '/خدمات/درمان-دندان',
      items: [],
    },
  ],
  others: [{ key: 'ortho', label: 'ارتودنسی', path: '/خدمات/ارتودنسی' }],
};

const CONTACT: FooterData = {
  name: 'کلینیک دندانپزشکی سفید',
  line: 'یک خط معرفی',
  address: 'تهران، خانی‌آباد نو',
  phones: { landline: '+982155101054', mobile: '+989205451054' },
  whatsapp: null,
  hours: 'هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.',
  hoursNote: 'یادداشت ساعات',
  maps: [],
  social: [],
  legal: { licenseNumber: null, technicalSupervisor: null },
  popular: [{ key: 'veneers', label: 'لمینت سرامیکی', path: '/خدمات/لمینت-سرامیکی' }],
  guides: [],
};

const html = (node: React.ReactElement) => renderToStaticMarkup(node);

describe('chrome markup (nav spec 1, ia.md 3)', () => {
  it('CM1 header: one-line desktop items, mega menu by Popover API, drawer by Invoker Commands', () => {
    const out = html(<SiteHeader nav={NAV} contact={CONTACT} />);
    expect(out).not.toMatch(/\sstyle=/);
    expect(out).toContain('popoverTarget="mega-menu"');
    expect(out).toMatch(/<div id="mega-menu" popover="auto"/);
    expect(out).toMatch(
      /aria-controls="site-drawer" aria-expanded="false"[^>]*command="show-modal" commandfor="site-drawer"/,
    );
    expect(out).toContain('command="close" commandfor="site-drawer"');
    // showModal() focuses «بستن منو» natively, also before hydration (nav spec 1.4).
    expect(out).toMatch(/aria-label="بستن منو"[^>]*autofocus=""/);
    for (const label of ['پزشکان', 'هزینه و پرداخت', 'آدرس و ساعات', 'سایر خدمات']) {
      expect(out).toContain(`>${label}<`);
    }
    // No cases page exists before launch: neither the bar nor the drawer links one.
    expect(out).not.toContain('قبل و بعد');
    expect(out).not.toContain('href="/قبل-و-بعد"');
    // Every booking CTA is a real link; the header's is routed and tracked.
    expect(out).toMatch(
      /<a data-booking-cta="" data-track="booking_open" data-location="header" href="\/رزرو-نوبت"/,
    );
    // Call controls go through the closed-hours sheet.
    expect(out).toMatch(/<div data-call-sheet=""[^>]*>.*href="tel:\+982155101054"/);
    // A group with services is a disclosure; without them it links its category page.
    expect(out).toMatch(/<details[^>]*><summary[^>]*>زیبایی/);
    expect(out).toMatch(
      /<a href="\/خدمات\/درمان-دندان" class="[^"]*font-semibold[^"]*">درمان و نگهداری/,
    );
    // WhatsApp only once verified (F12).
    expect(out).not.toContain('wa.me');
    expect(
      html(<SiteHeader nav={NAV} contact={{ ...CONTACT, whatsapp: '+989205451054' }} />),
    ).toContain('https://wa.me/989205451054?text=');
  });

  it('CM2 sticky bar: two cells, three once WhatsApp is verified, with the generic prefill', () => {
    const two = html(<StickyBar phone="+982155101054" whatsapp={null} />);
    expect(two).toContain('data-sticky-bar=""');
    expect(two).toContain('grid-cols-2');
    expect(two.match(/<a /g)).toHaveLength(2);
    expect(two).not.toMatch(/\sstyle=/);
    const three = html(<StickyBar phone="+982155101054" whatsapp="+989205451054" />);
    expect(three).toContain('grid-cols-3');
    expect(three).toContain(
      `https://wa.me/989205451054?text=${encodeURIComponent('سلام، از سایت کلینیک سفید پیام می‌دهم. سؤالی دربارهٔ نوبت دارم.').replace(/'/g, '&#x27;')}`,
    );
    expect(three).toMatch(/>واتساپ</);
  });

  it('CM2b open states reach CSS without :has(): the caret from aria-expanded, the bar from html data-modal and data-intro', () => {
    const dom = document.createElement('div');
    dom.innerHTML =
      html(<SiteHeader nav={NAV} contact={CONTACT} />) +
      html(<StickyBar phone="+982155101054" whatsapp={null} />);
    const caret = dom.querySelector('[popovertarget="mega-menu"] > svg')!;
    expect(caret.getAttribute('class')?.split(' ')).toEqual(
      expect.arrayContaining([
        '[[aria-expanded=true]>&]:rotate-180',
        'noscript:group-has-[:popover-open]/mega:rotate-180',
      ]),
    );
    expect(dom.querySelector('[data-sticky-bar]')!.className.split(' ')).toEqual(
      expect.arrayContaining([
        'in-data-modal:translate-y-[120%]',
        'in-data-[intro=playing]:translate-y-[120%]',
        'noscript:[body:has(dialog[open])_&]:translate-y-[120%]',
      ]),
    );
    // Every :has() class of the chrome exists only without JavaScript (scripts/check-has.mjs).
    const classes = [...dom.querySelectorAll('[class]')].flatMap((el) =>
      (el.getAttribute('class') ?? '').split(' '),
    );
    const hasClasses = classes.filter((c) => c.includes('has-') || c.includes(':has('));
    expect(hasClasses.length).toBeGreaterThan(0);
    expect(hasClasses.filter((c) => !c.startsWith('noscript:'))).toEqual([]);
  });

  it('CM3 the closed-hours sheet carries no hours sentence in the server HTML', () => {
    const out = html(<ClosedSheet phone="+982155101054" />);
    expect(out).toMatch(/<p id="closed-sheet-text" data-sheet-text="" class="[^"]*"><\/p>/);
    expect(out).toContain('aria-labelledby="closed-sheet-text"');
    expect(out).toContain('data-location="closed_sheet"');
  });

  it('CM4 footer: line, note only without the weekly sentence, guide link only when published, legal once provided', () => {
    const out = html(<SiteFooter contact={CONTACT} now={new Date('2026-10-13T08:30:00Z')} />);
    expect(out).not.toMatch(/\sstyle=/);
    expect(out).toContain('یک خط معرفی');
    expect(out).toContain('هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.');
    expect(out).not.toContain('یادداشت ساعات');
    expect(out).not.toContain('اولین مراجعه');
    expect(out).not.toContain('قبل و بعد');
    expect(out).not.toContain('شمارهٔ پروانه');
    expect(out).toContain('© ۱۴۰۵ کلینیک دندانپزشکی سفید');
    // The NAP phones dial directly: no closed-hours sheet around them. They share the icon
    // column of the address and the hours, so the three lines start at one edge.
    expect(out).not.toContain('data-call-sheet');
    expect(out).toMatch(/#phone"><\/use><\/svg><span><span[^>]*><a href="tel:\+982155101054"/);
    expect(out).toContain('data-sticky-hide=""');
    for (const group of ['خدمات پرطرفدار', 'کلینیک', 'راهنما']) {
      expect(out).toMatch(new RegExp(`<summary[^>]*>${group}`));
    }

    const filled = html(
      <SiteFooter
        contact={{
          ...CONTACT,
          hours: null,
          guides: [{ key: 'guide-first-visit', path: '/راهنمای-بیمار/اولین-مراجعه' }],
          legal: { licenseNumber: '12345', technicalSupervisor: 'نام مسئول' },
        }}
      />,
    );
    expect(filled).toContain('یادداشت ساعات');
    expect(filled).toContain('href="/راهنمای-بیمار/اولین-مراجعه"');
    expect(filled).toContain('شمارهٔ پروانه: <span dir="ltr">12345</span>');
    expect(filled).toContain('مسئول فنی: نام مسئول');

    // ia.md 3: «راهنما» ends with «درد شدید دارید؟» then «حریم خصوصی»; the bottom row is
    // socials, legal, © in fixed columns, so © stays at the end while the others are empty.
    const order = [
      '/راهنمای-بیمار',
      '/راهنمای-بیمار/اولین-مراجعه',
      '/مقالات',
      '/اورژانس',
      '/حریم-خصوصی',
    ];
    const at = order.map((path) => filled.indexOf(`href="${path}"`));
    expect(at.every((index, i) => index > (at[i - 1] ?? 0))).toBe(true);
    expect(out).toMatch(/<p class="md:col-start-3">© /);
  });

  it('CM6 the «خدمات» button carries the active bar on the hub and every page under it', () => {
    const trigger = (pathname: string) => {
      route.pathname = encodeURI(pathname);
      const out = html(<SiteHeader nav={NAV} contact={CONTACT} />);
      return /<button[^>]*popoverTarget="mega-menu"[^>]*>/.exec(out)?.[0] ?? '';
    };
    expect(trigger('/خدمات')).toContain('aria-current="true"');
    expect(trigger('/خدمات/زیبایی')).toContain('aria-current="true"');
    expect(trigger('/خدمات/لمینت-سرامیکی')).toContain('aria-current="true"');
    expect(trigger('/پزشکان')).not.toContain('aria-current=');
    expect(trigger('/')).not.toContain('aria-current=');
    route.pathname = null;
  });

  it('CM5 with the database down the chrome renders from the reader fallbacks (CC-7)', () => {
    const header = html(<SiteHeader nav={NAV_FALLBACK} contact={FOOTER_FALLBACK} />);
    // The categories link their pages; the call still dials the clinic.
    expect(header).toContain('href="/خدمات/زیبایی"');
    expect(header).toContain('href="tel:+982155101054"');
    const footer = html(<SiteFooter contact={FOOTER_FALLBACK} />);
    expect(footer).toContain('هر روز ۱۰ تا ۲۰، به‌جز تعطیلات رسمی.');
    expect(footer).toContain('href="/خدمات"');
    expect(html(<StickyBar phone={FOOTER_FALLBACK.phones.landline} whatsapp={null} />)).toContain(
      'tel:+982155101054',
    );
  });
});
