// Inputs that never open the on-screen keyboard: focusing them leaves the bar in place.
const NO_KEYBOARD = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** A focused form field that brings up the keyboard (CV4 rule b). */
export function isTextField(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type);
}

/**
 * Sticky bar visibility (conversion.md 4, nav spec 1.7): hidden while a `[data-sticky-hide]`
 * block (the end-of-page booking block, the footer contact block) is in view or a text field has
 * focus. A press that takes focus from a field shows the bar only after the press ends, so the tap
 * lands on the button under the finger. Open dialogs hide it through CSS. IntersectionObserver
 * and focus events only: no scroll listener. The hidden bar is inert, so Tab never reaches it.
 */
export function setupStickyBar(doc: Document, win: Window = window): () => void {
  const bar = doc.querySelector<HTMLElement>('[data-sticky-bar]');
  if (!bar) return () => {};
  const inView = new Set<Element>();
  let pressing = false;

  const update = () => {
    const hide = inView.size > 0 || isTextField(doc.activeElement);
    if (pressing && !hide) return;
    bar.toggleAttribute('data-hidden', hide);
    bar.inert = hide;
  };
  const settle = () => win.setTimeout(update); // after focus moved on, not mid-change
  const onDown = () => {
    pressing = true;
  };
  const onUp = () => {
    pressing = false;
    settle();
  };
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) inView.add(entry.target);
      else inView.delete(entry.target);
    }
    update();
  });
  doc.querySelectorAll('[data-sticky-hide]').forEach((el) => observer.observe(el));

  doc.addEventListener('focusin', update);
  doc.addEventListener('focusout', settle);
  doc.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onUp, true);
  update();
  return () => {
    observer.disconnect();
    doc.removeEventListener('focusin', update);
    doc.removeEventListener('focusout', settle);
    doc.removeEventListener('pointerdown', onDown, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onUp, true);
  };
}
