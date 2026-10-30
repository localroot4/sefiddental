import { BOOKING_FIELDS as F } from '@/components/booking/fields';

import { isPlainClick } from './closedSheet';
import { closeModals, openModal } from './dialogs';

/** Any part of `rect` between the bottom of the header and the top of the sticky bar (Q4). */
export function inView(rect: DOMRect, top: number, bottom: number): boolean {
  return rect.height > 0 && rect.bottom > top && rect.top < bottom;
}

const visible = (el: Element | null | undefined): el is HTMLElement =>
  el instanceof HTMLElement && (el.checkVisibility?.() ?? true);

export type BookingRoute =
  | { kind: 'hero'; field: HTMLElement }
  | { kind: 'block'; block: HTMLElement }
  | { kind: 'dialog'; dialog: HTMLDialogElement }
  | null;

/**
 * Where a «رزرو نوبت» CTA goes on this page (nav spec 1.6 and 4, freeze G7): the home hero card's
 * phone field while it shows between the bars (not in its success state, when the field is gone),
 * else the page's full booking form, else the booking dialog of a page without one once its island
 * owns the form (`novalidate`; it loads after `load`), else nowhere (the link navigates to
 * /رزرو-نوبت, whose own form has its tokens).
 */
export function bookingRoute(doc: Document, viewportHeight: number): BookingRoute {
  const field = doc.querySelector('[data-booking-form="hero"] input[type="tel"]');
  if (visible(field)) {
    const top = doc.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const bar = doc.querySelector('[data-sticky-bar]')?.getBoundingClientRect();
    const bottom = bar && bar.height > 0 ? Math.min(bar.top, viewportHeight) : viewportHeight;
    if (inView(field.getBoundingClientRect(), top, bottom)) return { kind: 'hero', field };
  }
  const block = doc.querySelector(
    '[data-booking-form]:not([data-booking-form="hero"]):not([data-booking-form="dialog"])',
  );
  if (visible(block)) return { kind: 'block', block };
  const dialog = doc.querySelector('dialog[data-booking-dialog]');
  return dialog instanceof HTMLDialogElement && dialog.querySelector('form')?.noValidate
    ? { kind: 'dialog', dialog }
    : null;
}

/**
 * The CTA's choice into the form it routes to (conversion.md 5 "set the service"): `?service=`
 * and `?tier=` into the hidden fields, `data-booking-group` checks the service chip. A CTA without
 * a service (the header's) leaves the form as the page set it.
 */
export function prefill(cta: HTMLAnchorElement, root: ParentNode): void {
  const form = root.querySelector('form');
  const params = new URL(cta.href).searchParams;
  const service = params.get('service');
  if (!form || !service) return;
  const set = (name: string, value: string) => {
    const input = form.elements.namedItem(name);
    if (input instanceof HTMLInputElement) input.value = value;
  };
  set(F.serviceKey, service);
  set(F.tier, params.get('tier') ?? '');
  const group = cta.dataset.bookingGroup;
  const chip = group
    ? form.querySelector<HTMLInputElement>(
        `input[name="${F.service}"][value="${CSS.escape(group)}"]`,
      )
    : null;
  if (chip) chip.checked = true;
}

// Page scroll stays put behind the booking dialog at every width (X7). The gutter keeps the page
// from shifting when its scrollbar goes, so only a page whose scrollbar takes room gets it (a short
// page would shift the other way). Under 1024 px SiteShell already locks any modal.
const LOCK = 'overflow-hidden';
const GUTTER = '[scrollbar-gutter:stable]';

/** The focusable part of a form root: its success region once it shows, else the form. */
const live = (box: Element, selector: string) =>
  Array.from(box.querySelectorAll<HTMLElement>(selector)).find((el) => !el.closest('[inert]'));

/**
 * Routes the «رزرو نوبت» links (`data-booking-cta`: header, sticky bar, drawer, closed-hours
 * sheet, page CTAs). The CTA's own `data-track` has already sent booking_open with its location;
 * `data-booking-opened` tells the hero form not to send a second one when the field takes focus.
 * Smooth scroll, instant under reduced motion. After a scroll or in the dialog, a fine pointer or a
 * keyboard gets the phone field and touch gets the heading, so no keyboard opens over the form
 * (Q5, conversion.md 5). The dialog returns focus to the CTA on close (dialogs.ts).
 */
export function setupBookingRoute(doc: Document, win: Window = window): () => void {
  const html = doc.documentElement;
  const unlock = () => html.classList.remove(LOCK, GUTTER);
  // `close` fires a task after close(): a dialog closed and reopened by one click (a CTA in a
  // sheet over it) is open again by then, so only a dialog still closed unlocks.
  const onClose = (event: Event) => {
    const dialog = event.target;
    if (dialog instanceof HTMLDialogElement && dialog.hasAttribute('data-booking-dialog')) {
      if (!dialog.open) unlock();
    }
  };
  // WebKit's click carries no touch pointerType (XB W8): the last input before the click tells a
  // tap from a press. A key clears it, so Enter on a link after a tap still focuses the field.
  let lastPointer = '';
  const onPointer = (event: PointerEvent) => (lastPointer = event.pointerType);
  const onTouch = () => (lastPointer = 'touch');
  const onKey = () => (lastPointer = '');
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || !isPlainClick(event)) return;
    const cta =
      event.target instanceof Element ? event.target.closest('a[data-booking-cta]') : null;
    if (!(cta instanceof HTMLAnchorElement)) return;
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
    const box = route.kind === 'block' ? route.block : route.dialog;
    prefill(cta, box);
    if (route.kind === 'block') {
      // While a tier is latched the home engine scrolls (Lenis and native scroll never fight).
      const tiered = Number(html.dataset.tier) >= 1;
      const own = new CustomEvent('sefid:scroll-to', { cancelable: true, detail: { target: box } });
      if (!tiered || doc.dispatchEvent(own))
        route.block.scrollIntoView({ block: 'start', behavior });
    } else {
      if (win.innerWidth > html.clientWidth) html.classList.add(GUTTER);
      html.classList.add(LOCK);
      openModal(route.dialog, cta);
    }
    // In its success state the form is inert: the success heading takes focus (5.4).
    const type = 'pointerType' in event && event.pointerType ? event.pointerType : lastPointer;
    const touch = type === 'touch';
    const heading = live(box, 'h2, h3');
    const field = live(box, 'input[type="tel"]');
    const target = touch || !field ? heading : field;
    if (target === heading && heading && !heading.hasAttribute('tabindex')) heading.tabIndex = -1;
    target?.focus({ preventScroll: route.kind === 'block' });
  };
  doc.addEventListener('pointerdown', onPointer, true);
  doc.addEventListener('touchstart', onTouch, { capture: true, passive: true });
  doc.addEventListener('keydown', onKey, true);
  doc.addEventListener('click', onClick);
  // `close` does not bubble: a capture listener on the document still sees it.
  doc.addEventListener('close', onClose, true);
  return () => {
    doc.removeEventListener('pointerdown', onPointer, true);
    doc.removeEventListener('touchstart', onTouch, true);
    doc.removeEventListener('keydown', onKey, true);
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('close', onClose, true);
    // A client navigation removes an open dialog, and a removed dialog fires no `close`.
    unlock();
  };
}
