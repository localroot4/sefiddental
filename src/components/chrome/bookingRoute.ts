import { isPlainClick } from './closedSheet';
import { closeModals } from './dialogs';

/** Any part of `rect` between the bottom of the header and the top of the sticky bar (Q4). */
export function inView(rect: DOMRect, top: number, bottom: number): boolean {
  return rect.height > 0 && rect.bottom > top && rect.top < bottom;
}

const visible = (el: Element | null | undefined): el is HTMLElement =>
  el instanceof HTMLElement && (el.checkVisibility?.() ?? true);

export type BookingRoute =
  { kind: 'hero'; field: HTMLElement } | { kind: 'block'; block: HTMLElement } | null;

/**
 * Where a «رزرو نوبت» CTA goes on this page (nav spec 1.6 and 4): the home hero card's phone
 * field while it shows between the bars (not in its success state, when the field is gone), else
 * the page's full booking form, else nowhere (the link navigates to /رزرو-نوبت).
 */
export function bookingRoute(doc: Document, viewportHeight: number): BookingRoute {
  const field = doc.querySelector('[data-booking-form="hero"] input[type="tel"]');
  if (visible(field)) {
    const top = doc.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const bar = doc.querySelector('[data-sticky-bar]')?.getBoundingClientRect();
    const bottom = bar && bar.height > 0 ? Math.min(bar.top, viewportHeight) : viewportHeight;
    if (inView(field.getBoundingClientRect(), top, bottom)) return { kind: 'hero', field };
  }
  const block = doc.querySelector('[data-booking-form]:not([data-booking-form="hero"])');
  return visible(block) ? { kind: 'block', block } : null;
}

/**
 * Routes the chrome's «رزرو نوبت» links (header, sticky bar, drawer, closed-hours sheet). The
 * CTA's own `data-track` has already sent booking_open with its location; `data-booking-opened`
 * tells the hero form not to send a second one when the field takes focus. Smooth scroll, instant
 * under reduced motion. After a scroll, a fine pointer or a keyboard gets the phone field and touch
 * gets the heading, so no keyboard opens over the form (Q5).
 */
export function setupBookingRoute(doc: Document, win: Window = window): () => void {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || !isPlainClick(event)) return;
    const cta =
      event.target instanceof Element ? event.target.closest('a[data-booking-cta]') : null;
    if (!cta) return;
    const route = bookingRoute(doc, win.innerHeight);
    if (!route) return;
    event.preventDefault();
    closeModals(doc);
    const behavior = win.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (route.kind === 'hero') {
      route.field.closest('[data-booking-form]')?.setAttribute('data-booking-opened', '');
      route.field.focus({ preventScroll: true });
      route.field.scrollIntoView({ block: 'nearest', behavior });
      return;
    }
    route.block.scrollIntoView({ block: 'start', behavior });
    const touch = 'pointerType' in event && event.pointerType === 'touch';
    const heading = route.block.querySelector<HTMLElement>('h2, h3');
    const target = touch ? heading : route.block.querySelector<HTMLElement>('input[type="tel"]');
    if (target === heading && heading && !heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    target?.focus({ preventScroll: true });
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}
