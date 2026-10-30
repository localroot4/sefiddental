import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { bookingRoute, inView, prefill, setupBookingRoute } from './bookingRoute';
import { setupChoices } from './choices';
import { setupClosedSheet } from './closedSheet';
import { closeModals, setupDialogs } from './dialogs';
import { getFormSession, renewFormSession } from './formSession';
import { setupSkipLink } from './skipLink';
import { setupSnapFocus } from './snapFocus';
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
  // No top layer either: an open dialog counts as modal (every site dialog opens with showModal).
  const matches = Element.prototype.matches;
  HTMLDialogElement.prototype.matches = function modal(this: HTMLDialogElement, selector: string) {
    return selector === ':modal' ? this.open : matches.call(this, selector);
  };
});

/** MutationObserver callbacks run as microtasks. */
const mutationsDelivered = () => new Promise<void>((resolve) => queueMicrotask(resolve));

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

  it('CB6b html data-modal follows any open modal but the intro, however it opens or closes (CSS without :has())', async () => {
    document.body.innerHTML = `
      <dialog id="intro"></dialog>
      <button id="open" command="show-modal" commandfor="d">o</button>
      <dialog id="d"><button id="close" command="close" commandfor="d">c</button></dialog>
      <dialog id="early"></dialog>`;
    const html = document.documentElement;
    // A modal opened before hydration (native Invoker Commands) is there at setup.
    (document.getElementById('early') as HTMLDialogElement).showModal();
    const stop = setupDialogs(document);
    expect(html.hasAttribute('data-modal')).toBe(true);
    (document.getElementById('early') as HTMLDialogElement).close();
    await mutationsDelivered();
    expect(html.hasAttribute('data-modal')).toBe(false);
    // The intro is a modal too, but the page under it neither scrolls nor shows the bar anyway.
    (document.getElementById('intro') as HTMLDialogElement).showModal();
    await mutationsDelivered();
    expect(html.hasAttribute('data-modal')).toBe(false);
    click(document.getElementById('open')!);
    await mutationsDelivered();
    expect(html.hasAttribute('data-modal')).toBe(true);
    click(document.getElementById('close')!);
    await mutationsDelivered();
    expect(html.hasAttribute('data-modal')).toBe(false);
    // Any other script's showModal() too.
    (document.getElementById('d') as HTMLDialogElement).showModal();
    await mutationsDelivered();
    expect(html.hasAttribute('data-modal')).toBe(true);
    stop();
    html.removeAttribute('data-modal');
  });

  it('CB6c radio groups mirror the checked position and item for CSS (choices.ts), at setup and on change', () => {
    document.body.innerHTML = `
      <div data-choices>
        <article data-choice-item><input type="radio" name="t" value="a"></article>
        <article data-choice-item><input type="radio" name="t" value="b"></article>
        <article data-choice-item><input type="radio" name="t" value="c"></article>
      </div>
      <div data-choices id="restored"><input type="radio" name="u"><input type="radio" name="u" checked></div>`;
    const stop = setupChoices(document);
    const [group, restored] = [...document.querySelectorAll('[data-choices]')];
    const items = [...document.querySelectorAll('[data-choice-item]')];
    const radios = [...group!.querySelectorAll('input')];
    expect(group!.hasAttribute('data-choice')).toBe(false);
    expect(restored!.getAttribute('data-choice')).toBe('2'); // restored or checked before hydration
    const pick = (i: number) => {
      radios[i]!.checked = true;
      radios[i]!.dispatchEvent(new Event('change', { bubbles: true }));
    };
    pick(1);
    expect(group!.getAttribute('data-choice')).toBe('2');
    expect(items.map((item) => item.hasAttribute('data-checked'))).toEqual([false, true, false]);
    pick(2);
    expect(group!.getAttribute('data-choice')).toBe('3');
    expect(items.map((item) => item.hasAttribute('data-checked'))).toEqual([false, false, true]);
    stop();
    pick(0); // no listener after teardown
    expect(group!.getAttribute('data-choice')).toBe('3');
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

  it('CB8 the skip link focuses main, which is focusable only until it loses focus', () => {
    document.body.innerHTML = `<a class="skip-link" href="#main">skip</a><main id="main"><a href="/x">x</a></main>`;
    const stop = setupSkipLink(document);
    const main = document.getElementById('main')!;
    expect(main.hasAttribute('tabindex')).toBe(false);
    click(document.querySelector('.skip-link')!);
    expect(document.activeElement).toBe(main);
    (document.querySelector('a[href="/x"]') as HTMLElement).focus();
    expect(main.hasAttribute('tabindex')).toBe(false);
    stop();
  });

  it('CB9 a dialog whose opener is hidden returns focus to the header home link', () => {
    document.body.innerHTML = `
      <header><a href="/">home</a><button id="open" command="show-modal" commandfor="d">o</button></header>
      <dialog id="d"><button id="close" command="close" commandfor="d">c</button></dialog>`;
    const stop = setupDialogs(document);
    const open = document.getElementById('open')!;
    click(open);
    // From 1024 px the menu button is display:none when the drawer closes.
    open.checkVisibility = () => false;
    click(document.getElementById('close')!);
    expect(document.activeElement?.getAttribute('href')).toBe('/');
    stop();
  });

  it('CB10 a page without a form routes to its booking dialog; hero and block still come first', () => {
    document.body.innerHTML = `
      <form data-booking-form="hero"><input type="tel"></form>
      <form data-booking-form="block"><input type="tel"></form>
      <dialog data-booking-dialog><div data-booking-form="dialog"><form novalidate><input type="tel"></form></div></dialog>`;
    const hero = document.querySelector('[data-booking-form="hero"] input')!;
    place(hero, 300, 44);
    expect(bookingRoute(document, 844)?.kind).toBe('hero');
    document.querySelector('[data-booking-form="hero"]')!.remove();
    expect(bookingRoute(document, 844)?.kind).toBe('block');
    document.querySelector('[data-booking-form="block"]')!.remove();
    // The dialog's own form is never a "block" to scroll to.
    expect(bookingRoute(document, 844)).toEqual({
      kind: 'dialog',
      dialog: document.querySelector('dialog'),
    });
    document.querySelector('dialog')!.remove();
    expect(bookingRoute(document, 844)).toBeNull();
  });

  it('CB11 the dialog opens with the CTA choice, focuses the field, locks scroll and returns focus', () => {
    vi.stubGlobal('CSS', { escape: (value: string) => value }); // jsdom has no CSS.escape
    document.body.innerHTML = `
      <header><a href="/">home</a></header>
      <a id="cta" href="/رزرو-نوبت?service=ceramic-laminate&tier=vip" data-booking-cta data-booking-group="cosmetic">b</a>
      <dialog id="booking-dialog" data-booking-dialog>
        <button id="close" command="close" commandfor="booking-dialog">x</button>
        <div data-booking-form="dialog"><form novalidate>
          <h2>title</h2><input type="tel" id="phone">
          <input type="radio" name="service" value="exam"><input type="radio" name="service" value="cosmetic">
          <input type="hidden" name="service_key" value=""><input type="hidden" name="tier" value="">
        </form></div>
      </dialog>`;
    const stops = [setupDialogs(document), setupBookingRoute(document)];
    const dialog = document.querySelector('dialog')!;
    const cta = document.getElementById('cta')!;
    const html = document.documentElement;
    expect(click(cta).defaultPrevented).toBe(true);
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(document.activeElement?.id).toBe('phone');
    const form = dialog.querySelector('form')!;
    expect((form.elements.namedItem('service_key') as HTMLInputElement).value).toBe(
      'ceramic-laminate',
    );
    expect((form.elements.namedItem('tier') as HTMLInputElement).value).toBe('vip');
    expect(form.querySelector<HTMLInputElement>('[value="cosmetic"]')!.checked).toBe(true);
    // Scroll lock at every width while open, with the gutter kept (X7).
    expect(html.classList.contains('overflow-hidden')).toBe(true);
    expect(html.classList.contains('[scrollbar-gutter:stable]')).toBe(true);
    click(document.getElementById('close')!);
    expect(dialog.hasAttribute('open')).toBe(false);
    expect(html.classList.contains('overflow-hidden')).toBe(false);
    expect(document.activeElement).toBe(cta);
    // A modified click keeps the browser's new-tab handling.
    expect(click(cta, { ctrlKey: true }).defaultPrevented).toBe(false);
    stops.forEach((stop) => stop());
  });

  it('CB12 a touch press focuses the dialog heading, so no keyboard covers the lead', () => {
    document.body.innerHTML = `
      <a id="cta" href="/رزرو-نوبت" data-booking-cta>b</a>
      <dialog data-booking-dialog><div data-booking-form="dialog"><form novalidate>
        <h2 id="title">title</h2><input type="tel" id="phone">
      </form></div></dialog>`;
    const stop = setupBookingRoute(document);
    const touch = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    document.getElementById('cta')!.dispatchEvent(touch);
    expect(document.activeElement?.id).toBe('title');
    expect(document.getElementById('title')!.tabIndex).toBe(-1);
    document.querySelector('dialog')!.close();
    stop();
  });

  it('CB12b WebKit: a click without pointerType after a touchstart is a tap; after a key it is a press', () => {
    document.body.innerHTML = `
      <a id="cta" href="/رزرو-نوبت" data-booking-cta>b</a>
      <dialog data-booking-dialog><div data-booking-form="dialog"><form novalidate>
        <h2 id="title">title</h2><input type="tel" id="phone">
      </form></div></dialog>`;
    const stop = setupBookingRoute(document);
    const cta = document.getElementById('cta')!;
    cta.dispatchEvent(new Event('touchstart', { bubbles: true }));
    click(cta);
    expect(document.activeElement?.id).toBe('title');
    document.querySelector('dialog')!.close();
    cta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    click(cta);
    expect(document.activeElement?.id).toBe('phone');
    document.querySelector('dialog')!.close();
    stop();
  });

  it('CB13 a CTA without a service leaves the form as the page set it', () => {
    document.body.innerHTML = `
      <a id="cta" href="/رزرو-نوبت"></a>
      <form><input type="hidden" name="service_key" value="implant"><input type="hidden" name="tier" value="x"></form>`;
    prefill(document.getElementById('cta') as HTMLAnchorElement, document.body);
    const form = document.querySelector('form')!;
    expect((form.elements.namedItem('service_key') as HTMLInputElement).value).toBe('implant');
    expect((form.elements.namedItem('tier') as HTMLInputElement).value).toBe('x');
  });

  it('CB14 the Tab trap skips what cannot take focus: an inert or invisible success region', () => {
    // jsdom has no checkVisibility: this one sees `visibility: hidden` only when asked to.
    Element.prototype.checkVisibility = function (this: Element, options?: CheckVisibilityOptions) {
      return !(options?.visibilityProperty && this.closest('.invisible'));
    };
    onTestFinished(() => void Reflect.deleteProperty(Element.prototype, 'checkVisibility'));
    document.body.innerHTML = `
      <dialog id="d" open>
        <button id="close">x</button><input type="tel" id="phone"><button id="submit">s</button>
        <div class="invisible"><a href="/hidden">hidden</a></div>
        <div inert><a href="/done">done</a></div>
      </dialog>`;
    const stop = setupDialogs(document);
    const tab = (id: string, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      document.getElementById(id)!.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(tab('submit')).toBe(true);
    expect(document.activeElement?.id).toBe('close');
    expect(tab('close', true)).toBe(true);
    expect(document.activeElement?.id).toBe('submit');
    stop();
  });

  const DIALOG_PAGE = `
    <a id="cta" href="/رزرو-نوبت" data-booking-cta>b</a>
    <dialog id="booking-dialog" data-booking-dialog><div data-booking-form="dialog"><form novalidate>
      <h2>title</h2><input type="tel" id="phone">
    </form></div></dialog>`;
  const locked = () => document.documentElement.classList.contains('overflow-hidden');
  const gutter = () => document.documentElement.classList.contains('[scrollbar-gutter:stable]');

  it('CB15 a client navigation that removes the open dialog (no close event) unlocks the page', () => {
    document.body.innerHTML = DIALOG_PAGE;
    const stop = setupBookingRoute(document);
    click(document.getElementById('cta')!);
    expect(locked()).toBe(true);
    document.querySelector('dialog')!.remove();
    stop();
    expect(locked()).toBe(false);
    expect(gutter()).toBe(false);
  });

  it('CB16 a close event that arrives after the dialog reopened leaves the lock and focus', () => {
    vi.useFakeTimers();
    // Browsers fire `close` in a later task: closeModals then a reopen in one click sees it late.
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
      this: HTMLDialogElement,
    ) {
      this.removeAttribute('open');
      setTimeout(() => this.dispatchEvent(new Event('close')));
    });
    document.body.innerHTML = DIALOG_PAGE;
    const stops = [setupDialogs(document), setupBookingRoute(document)];
    const cta = document.getElementById('cta')!;
    const dialog = document.querySelector('dialog')!;
    click(cta);
    click(cta);
    vi.runAllTimers();
    expect(dialog.open).toBe(true);
    expect(locked()).toBe(true);
    // The stale event returns no focus either: the reopened dialog keeps its field.
    expect(document.activeElement?.id).toBe('phone');
    dialog.close();
    vi.runAllTimers();
    expect(locked()).toBe(false);
    expect(document.activeElement).toBe(cta);
    close.mockRestore();
    stops.forEach((stop) => stop());
  });

  it('CB17 the gutter is kept only where a scrollbar takes room, so no page shifts', () => {
    document.body.innerHTML = DIALOG_PAGE;
    const html = document.documentElement;
    // Overlay scrollbars or a page too short to scroll: the viewport has no scrollbar width.
    Object.defineProperty(html, 'clientWidth', { configurable: true, value: window.innerWidth });
    const stop = setupBookingRoute(document);
    click(document.getElementById('cta')!);
    expect(locked()).toBe(true);
    expect(gutter()).toBe(false);
    document.querySelector('dialog')!.close();
    delete (html as { clientWidth?: number }).clientWidth;
    stop();
  });

  it('CB20 with a tier latched the block route asks the engine first; without one it scrolls itself', () => {
    document.body.innerHTML = `
      <a id="cta" href="/رزرو-نوبت" data-booking-cta>b</a>
      <section data-booking-form="block"><form novalidate><h2>t</h2><input type="tel"></form></section>`;
    const block = document.querySelector<HTMLElement>('[data-booking-form="block"]')!;
    block.scrollIntoView = vi.fn();
    const seen: unknown[] = [];
    const engine = (event: Event) => {
      seen.push((event as CustomEvent<{ target: unknown }>).detail.target);
      event.preventDefault();
    };
    document.addEventListener('sefid:scroll-to', engine);
    const stop = setupBookingRoute(document);
    const cta = document.getElementById('cta')!;
    // Tier 0 (no attribute): native scroll, no event.
    click(cta);
    expect(seen).toEqual([]);
    expect(block.scrollIntoView).toHaveBeenCalledTimes(1);
    // A latched tier: the engine answers and the native scroll is skipped.
    document.documentElement.dataset.tier = '1';
    click(cta);
    expect(seen).toEqual([block]);
    expect(block.scrollIntoView).toHaveBeenCalledTimes(1);
    // Nobody answers (a content page has no engine): native scroll again.
    document.removeEventListener('sefid:scroll-to', engine);
    click(cta);
    expect(block.scrollIntoView).toHaveBeenCalledTimes(2);
    delete document.documentElement.dataset.tier;
    stop();
  });

  it('CB18 a form in its success state takes the CTA focus on its success heading', () => {
    document.body.innerHTML = `
      <a id="cta" href="/رزرو-نوبت" data-booking-cta>b</a>
      <dialog data-booking-dialog><div data-booking-form="dialog" data-state="success">
        <form inert novalidate><h2>title</h2><input type="tel" id="phone"></form>
        <div><h2 id="done" tabindex="-1">done</h2><h3>bring</h3></div>
      </div></dialog>`;
    const stop = setupBookingRoute(document);
    const cta = document.getElementById('cta')!;
    click(cta);
    expect(document.activeElement?.id).toBe('done');
    document.querySelector('dialog')!.close();
    cta.focus();
    const touch = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    cta.dispatchEvent(touch);
    expect(document.activeElement?.id).toBe('done');
    document.querySelector('dialog')!.close();
    stop();
  });

  it('CB19 a dialog whose island has not taken its form yet is no route: the CTA navigates', () => {
    // The island loads after `load` (BookingFormIslandDeferred); the booking page has its tokens.
    document.body.innerHTML = DIALOG_PAGE.replace(' novalidate', '');
    const stop = setupBookingRoute(document);
    expect(bookingRoute(document, 844)).toBeNull();
    expect(click(document.getElementById('cta')!).defaultPrevented).toBe(false);
    expect(document.querySelector('dialog')!.hasAttribute('open')).toBe(false);
    stop();
  });

  it('FSR1 a renewal skips the shared answer, sends ?renew= and becomes the shared answer', async () => {
    const answer = (ts: string) => ({
      csrf: 'c',
      ts,
      ttlSeconds: 1800,
      hours: {
        state: 'open',
        callsAllowed: true,
        showClosedSheet: false,
        nextChangeAt: new Date(Date.now() + 3_600_000).toISOString(),
        copy: { callback: '', closedSheet: null, emergencyClosedLine: null },
      },
    });
    const fetch = vi.fn(
      async (url: string) =>
        new Response(JSON.stringify(answer(url.includes('renew') ? 'v1.new.sig' : 'v1.old.sig'))),
    );
    vi.stubGlobal('fetch', fetch);
    expect((await getFormSession())?.ts).toBe('v1.old.sig');
    const renewed = await renewFormSession('v1.old.sig');
    expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/form-session?renew=v1.old.sig');
    expect(renewed?.ts).toBe('v1.new.sig');
    expect(typeof renewed?.receivedAt).toBe('number');
    const before = fetch.mock.calls.length;
    expect((await getFormSession())?.ts).toBe('v1.new.sig');
    expect(fetch.mock.calls.length).toBe(before);
  });
});

describe('snap rows', () => {
  it('CB21 a keyboard focus in a mandatory snap row centres its card; a tap focus or a row without overflow moves nothing', () => {
    document.body.innerHTML = `
      <div id="row" style="scroll-snap-type: x mandatory"><article id="card"><h3><a id="link" href="/x">x</a></h3></article></div>
      <div id="flat" style="scroll-snap-type: x mandatory"><article id="still"><a id="other" href="/y">y</a></article></div>`;
    const row = document.getElementById('row')!;
    // jsdom has no layout: the first row overflows, the second does not.
    Object.defineProperty(row, 'scrollWidth', { value: 900 });
    Object.defineProperty(row, 'clientWidth', { value: 400 });
    const scrolled: string[] = [];
    // jsdom has no scrollIntoView at all.
    Element.prototype.scrollIntoView = function record(
      this: Element,
      arg?: boolean | ScrollIntoViewOptions,
    ) {
      scrolled.push(`${this.id} ${JSON.stringify(arg)}`);
    };
    onTestFinished(() => {
      delete (Element.prototype as Partial<Element>).scrollIntoView;
    });
    const keyboard = vi.spyOn(HTMLElement.prototype, 'matches').mockReturnValue(true);
    onTestFinished(() => keyboard.mockRestore());
    const stop = setupSnapFocus(document);
    document.getElementById('link')!.focus();
    expect(scrolled).toEqual(['card {"inline":"center","block":"nearest"}']);
    document.getElementById('other')!.focus();
    expect(scrolled).toHaveLength(1);
    keyboard.mockReturnValue(false);
    document.getElementById('link')!.blur();
    document.getElementById('link')!.focus();
    expect(scrolled).toHaveLength(1);
    stop();
  });
});
