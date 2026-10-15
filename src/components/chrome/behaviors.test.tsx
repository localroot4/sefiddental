import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { bookingRoute, inView, setupBookingRoute } from './bookingRoute';
import { setupClosedSheet } from './closedSheet';
import { closeModals, setupDialogs } from './dialogs';
import { getFormSession } from './formSession';
import { isTextField, setupStickyBar } from './stickyBar';

// jsdom has no <dialog> methods, no IntersectionObserver and no layout: minimal stand-ins.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

let observed: IntersectionObserverCallback | null = null;
beforeEach(() => {
  observed = null;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observed = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: top,
  } as DOMRect;
}

function place(el: Element | null, top: number, height: number): void {
  if (el) el.getBoundingClientRect = () => rect(top, height);
}

const click = (el: Element, init: MouseEventInit = {}) => {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(event);
  return event;
};

describe('chrome behaviors (nav spec 1.4-1.7, 4)', () => {
  it('CB1 only fields that bring up a keyboard hide the sticky bar', () => {
    const make = (html: string) => {
      document.body.innerHTML = html;
      return document.body.firstElementChild;
    };
    expect(isTextField(make('<input type="tel">'))).toBe(true);
    expect(isTextField(make('<input>'))).toBe(true);
    expect(isTextField(make('<textarea></textarea>'))).toBe(true);
    expect(isTextField(make('<select></select>'))).toBe(true);
    expect(isTextField(make('<input type="radio">'))).toBe(false);
    expect(isTextField(make('<input type="submit">'))).toBe(false);
    expect(isTextField(make('<button></button>'))).toBe(false);
    expect(isTextField(null)).toBe(false);
  });

  it('CB2 "in view" is any part between the header and the sticky bar', () => {
    expect(inView(rect(100, 44), 65, 780)).toBe(true);
    expect(inView(rect(40, 44), 65, 780)).toBe(true); // partly under the header
    expect(inView(rect(10, 44), 65, 780)).toBe(false); // wholly under the header
    expect(inView(rect(779, 44), 65, 780)).toBe(true);
    expect(inView(rect(780, 44), 65, 780)).toBe(false); // behind the bar
    expect(inView(rect(100, 0), 65, 780)).toBe(false); // not rendered
  });

  it('CB3 a booking CTA targets the hero field in view, else the full form, else nothing', () => {
    document.body.innerHTML = `
      <header></header>
      <form data-booking-form="hero"><input type="tel"></form>
      <form data-booking-form="block"><h2>h</h2><input type="tel"></form>
      <nav data-sticky-bar></nav>`;
    place(document.querySelector('header'), 0, 65);
    place(document.querySelector('[data-sticky-bar]'), 780, 64);
    const hero = document.querySelector('[data-booking-form="hero"] input')!;
    place(hero, 400, 44);
    expect(bookingRoute(document, 844)).toEqual({ kind: 'hero', field: hero });
    place(hero, 790, 44); // behind the bar
    expect(bookingRoute(document, 844)?.kind).toBe('block');
    document.querySelector('[data-booking-form="hero"]')!.remove(); // success state: no field
    expect(bookingRoute(document, 844)?.kind).toBe('block');
    document.querySelector('[data-booking-form="block"]')!.remove();
    expect(bookingRoute(document, 844)).toBeNull();
  });

  it('CB4 the CTA focuses the hero field and marks the form; elsewhere the link navigates', () => {
    document.body.innerHTML = `
      <form data-booking-form="hero"><input type="tel"></form>
      <a href="/رزرو-نوبت" data-booking-cta>b</a>`;
    const field = document.querySelector<HTMLInputElement>('input')!;
    place(field, 300, 44);
    field.scrollIntoView = vi.fn();
    const stop = setupBookingRoute(document);
    const cta = document.querySelector('a')!;
    expect(click(cta).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);
    expect(field.closest('form')?.hasAttribute('data-booking-opened')).toBe(true);
    expect(click(cta, { ctrlKey: true }).defaultPrevented).toBe(false); // new tab stays possible
    document.querySelector('form')!.remove();
    expect(click(cta).defaultPrevented).toBe(false);
    stop();
  });

  it('CB5 the sticky bar hides for a block in view or a focused field; a press delays its return', () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <nav data-sticky-bar></nav><div data-sticky-hide></div>
      <form><input type="tel"><button type="button">b</button></form>`;
    const bar = document.querySelector<HTMLElement>('[data-sticky-bar]')!;
    const stop = setupStickyBar(document);
    expect(bar.hasAttribute('data-hidden')).toBe(false);
    const block = document.querySelector('[data-sticky-hide]')!;
    const entry = (isIntersecting: boolean) =>
      [{ target: block, isIntersecting }] as unknown as IntersectionObserverEntry[];
    observed?.(entry(true), {} as IntersectionObserver);
    expect(bar.hasAttribute('data-hidden')).toBe(true);
    expect(bar.inert).toBe(true);
    observed?.(entry(false), {} as IntersectionObserver);
    expect(bar.hasAttribute('data-hidden')).toBe(false);

    document.querySelector('input')!.focus();
    expect(bar.hasAttribute('data-hidden')).toBe(true);
    document.dispatchEvent(new Event('pointerdown'));
    document.querySelector('button')!.focus();
    vi.runAllTimers();
    expect(bar.hasAttribute('data-hidden')).toBe(true); // the press is not over
    document.dispatchEvent(new Event('pointerup'));
    vi.runAllTimers();
    expect(bar.hasAttribute('data-hidden')).toBe(false);
    expect(bar.inert).toBe(false);
    stop();
  });

  it('CB6 the dialog commands run without native support, sync aria-expanded and return focus', () => {
    document.body.innerHTML = `
      <button id="open" aria-controls="d" aria-expanded="false" command="show-modal" commandfor="d">o</button>
      <dialog id="d"><a href="/a">a</a><button id="close" autofocus command="close" commandfor="d">c</button></dialog>`;
    const stop = setupDialogs(document);
    const open = document.getElementById('open')!;
    const dialog = document.getElementById('d') as HTMLDialogElement;
    click(open);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(open.getAttribute('aria-expanded')).toBe('true');
    // A real showModal() focuses the autofocus control; the jsdom stand-in does not.
    document.getElementById('close')!.focus();

    // Tab on the last stop wraps to the first, Shift+Tab on the first wraps to the last.
    const tab = (shiftKey: boolean) =>
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }),
      );
    tab(false);
    expect(document.activeElement?.getAttribute('href')).toBe('/a');
    tab(true);
    expect(document.activeElement?.id).toBe('close');

    click(document.getElementById('close')!);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(open.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(open);

    // A CTA that moves focus elsewhere closes without the focus return.
    click(open);
    open.blur();
    closeModals(document);
    expect(document.activeElement).not.toBe(open);
    stop();
  });

  it('CB7 a closed clinic turns an opted-in call press into the sheet; an open one dials', async () => {
    const hours = (closed: boolean) => ({
      csrf: 'c',
      ts: 't',
      ttlSeconds: 1800,
      hours: {
        state: closed ? 'closed' : 'open',
        callsAllowed: !closed,
        showClosedSheet: closed,
        // Already past: the next setup asks again instead of reusing this answer.
        nextChangeAt: new Date(Date.now() - 1000).toISOString(),
        copy: { callback: '', closedSheet: closed ? 'بسته' : null, emergencyClosedLine: null },
      },
    });
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal('fetch', fetch);
    // The sheet's `closed_sheet_view` event goes out through fetch too: count the hours requests.
    const asked = () => fetch.mock.calls.filter(([url]) => url === '/api/form-session').length;
    document.body.innerHTML = `
      <div data-call-sheet><a id="call" data-location="header" href="tel:+982155101054">c</a></div>
      <a id="plain" href="tel:+982155101054">p</a>
      <dialog id="closed-sheet"><p data-sheet-text></p><a id="own" href="tel:+982155101054">o</a></dialog>`;
    const sheet = document.getElementById('closed-sheet') as HTMLDialogElement;
    // Set up, then await the same in-flight request: setupClosedSheet subscribed to it first,
    // so its answer is applied before this resumes.
    const answered = async (closed: boolean) => {
      fetch.mockImplementation(async () => new Response(JSON.stringify(hours(closed))));
      const stop = setupClosedSheet(document);
      await getFormSession();
      return stop;
    };

    let stop = await answered(true);
    expect(asked()).toBe(1);
    expect(click(document.getElementById('call')!).defaultPrevented).toBe(true);
    expect(sheet.hasAttribute('open')).toBe(true);
    expect(sheet.querySelector('[data-sheet-text]')?.textContent).toBe('بسته');
    expect(click(document.getElementById('own')!).defaultPrevented).toBe(false);
    expect(click(document.getElementById('plain')!).defaultPrevented).toBe(false);
    stop();

    sheet.removeAttribute('open');
    stop = await answered(false);
    expect(asked()).toBe(2);
    expect(click(document.getElementById('call')!).defaultPrevented).toBe(false);
    expect(sheet.hasAttribute('open')).toBe(false);
    stop();
  });
});
