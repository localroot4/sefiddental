/**
 * A keyboard focus inside a mandatory snap row (the home services row, the tier cards, the voices
 * and card rows under 1024 px) centres the focused card in the row. The browser's own focus scroll
 * reveals only the focused element's box, and the mandatory snap then settles on the nearest snap
 * position, which can be a neighbour's: at 820 px a Tab to the third service left 11 % of its link
 * in view. The scroll engine did this for the services row only and never runs at tier 0 or under
 * reduced motion, so it lives here, for every row at every tier. Keyboard focus only: a tap's
 * focus must not move the card under the finger before the click completes.
 */
export function setupSnapFocus(doc: Document): () => void {
  const onFocus = (event: FocusEvent) => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(':focus-visible')) return;
    const view = doc.defaultView;
    if (!view) return;
    for (let card: HTMLElement = target; card.parentElement; card = card.parentElement) {
      const row = card.parentElement;
      if (
        view.getComputedStyle(row).scrollSnapType.includes('mandatory') &&
        row.scrollWidth > row.clientWidth
      ) {
        card.scrollIntoView({ inline: 'center', block: 'nearest' });
        return;
      }
    }
  };
  doc.addEventListener('focusin', onFocus);
  return () => doc.removeEventListener('focusin', onFocus);
}
