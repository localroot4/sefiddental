/** Where focus goes when a modal closes; null when a CTA moved focus elsewhere on purpose. */
const opener = new WeakMap<HTMLDialogElement, HTMLElement | null>();

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Tab stops of a dialog in order: what the browser can focus. Out: content of a closed <details>,
 * `visibility: hidden` and `inert` (a booking form's success region before it shows).
 */
export function tabStops(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => (el.checkVisibility?.({ visibilityProperty: true }) ?? true) && !el.closest('[inert]'),
  );
}

/** Opens a modal and remembers its opener: Safari does not focus a clicked link or button. */
export function openModal(dialog: HTMLDialogElement, from: HTMLElement | null): void {
  opener.set(dialog, from);
  if (!dialog.open) dialog.showModal();
}

/** Closes every open modal without returning focus: the caller moves it (nav spec 1.4). */
export function closeModals(doc: Document): void {
  for (const dialog of Array.from(doc.querySelectorAll<HTMLDialogElement>('dialog[open]'))) {
    opener.set(dialog, null);
    dialog.close();
  }
}

const controllers = (doc: Document, dialog: HTMLDialogElement) =>
  doc.querySelectorAll(`[aria-controls="${dialog.id}"][aria-expanded]`);

/**
 * The modal dialogs of the chrome (drawer, closed-hours sheet). Their buttons use Invoker
 * Commands (`command`, `commandfor`), which work without script; this runs the two commands where
 * the browser lacks them, remembers the opener and returns focus to it on close, syncs
 * aria-expanded, and wraps Tab inside an open dialog (a modal alone lets Tab reach the browser
 * chrome). Focus on open is native: showModal() focuses the `autofocus` control, before hydration
 * too. Document-level listeners, so later dialogs share it.
 */
export function setupDialogs(doc: Document): () => void {
  const native = 'command' in HTMLButtonElement.prototype;
  const onClick = (event: MouseEvent) => {
    const button = event.target instanceof Element ? event.target.closest('[commandfor]') : null;
    const dialog = button && doc.getElementById(button.getAttribute('commandfor') ?? '');
    if (!(button instanceof HTMLElement) || !(dialog instanceof HTMLDialogElement)) return;
    const command = button.getAttribute('command');
    if (command === 'close' && !native) dialog.close();
    if (command !== 'show-modal') return;
    opener.set(dialog, button);
    if (!native) dialog.showModal();
    controllers(doc, dialog).forEach((el) => el.setAttribute('aria-expanded', 'true'));
  };
  const onClose = (event: Event) => {
    const dialog = event.target;
    // `close` fires a task after close(): a dialog reopened since (closeModals, then a CTA opens
    // it again) keeps its state and its focus.
    if (!(dialog instanceof HTMLDialogElement) || dialog.open) return;
    controllers(doc, dialog).forEach((el) => el.setAttribute('aria-expanded', 'false'));
    const back = opener.get(dialog);
    opener.delete(dialog);
    if (!back?.isConnected) return;
    // The menu button hides from 1024 px, where a widening viewport closes the drawer.
    if (back.checkVisibility?.() ?? true) back.focus();
    else doc.querySelector<HTMLElement>('header a[href="/"]')?.focus();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || !(event.target instanceof Element)) return;
    const dialog = event.target.closest('dialog[open]');
    if (!dialog) return;
    const stops = tabStops(dialog);
    const edge = event.shiftKey ? stops[0] : stops[stops.length - 1];
    const wrap = event.shiftKey ? stops[stops.length - 1] : stops[0];
    if (event.target === edge && wrap) {
      event.preventDefault();
      wrap.focus();
    }
  };
  doc.addEventListener('click', onClick);
  // `close` does not bubble: a capture listener on the document still sees it.
  doc.addEventListener('close', onClose, true);
  doc.addEventListener('keydown', onKey);
  return () => {
    doc.removeEventListener('click', onClick);
    doc.removeEventListener('close', onClose, true);
    doc.removeEventListener('keydown', onKey);
  };
}
