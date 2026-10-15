import { track } from '@/lib/track/track';

import { openModal } from './dialogs';
import { getFormSession, type FormSession } from './formSession';
import { SHEET_ID } from './ids';

/** A plain left click or tap: a modified click keeps the browser's own handling of the link. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/**
 * The closed-hours sheet (nav spec 1.5, C13): while the clinic is closed, a press on an opted-in
 * call link opens the sheet instead of dialing. The state comes from /api/form-session after
 * `load`, never from the page HTML; until it arrives, or when it fails, the link dials (the
 * no-script behavior). A timer refreshes the state when it changes (opening or closing time).
 */
export function setupClosedSheet(doc: Document, win: Window = window): () => void {
  const sheet = doc.getElementById(SHEET_ID);
  const text = sheet?.querySelector('[data-sheet-text]');
  if (!(sheet instanceof HTMLDialogElement) || !text) return () => {};

  let hours: FormSession['hours'] | null = null;
  let timer = 0;
  let alive = true;
  const load = () =>
    void getFormSession().then((session) => {
      if (!alive) return;
      hours = session?.hours ?? null;
      const wait = hours ? Date.parse(hours.nextChangeAt) - Date.now() : Number.NaN;
      // setTimeout runs at once for a delay above 2^31 - 1 ms; a page open for 24 days reloads.
      if (wait > 0 && wait < 2 ** 31) timer = win.setTimeout(load, wait + 1000);
    });
  load();

  const onClick = (event: MouseEvent) => {
    if (!hours?.showClosedSheet || event.defaultPrevented || !isPlainClick(event)) return;
    const link = event.target instanceof Element ? event.target.closest('a[href^="tel:"]') : null;
    // The sheet's own «تماس با کلینیک» has no opt-in, so it dials.
    if (!(link instanceof HTMLElement) || !link.closest('[data-call-sheet]')) return;
    event.preventDefault();
    text.textContent = hours.copy.closedSheet;
    openModal(sheet, link);
    const location = link.closest('[data-location]')?.getAttribute('data-location');
    track('closed_sheet_view', location ? { location } : {});
  };
  doc.addEventListener('click', onClick);
  return () => {
    alive = false;
    win.clearTimeout(timer);
    doc.removeEventListener('click', onClick);
  };
}
