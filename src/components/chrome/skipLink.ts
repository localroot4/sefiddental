/**
 * The skip link moves focus to <main>. Main is focusable only for that moment: a main with a
 * permanent tabindex takes focus on every click into its text, and the next Tab then restarts
 * from the top of the page. Without script the fragment still moves the Tab starting point.
 */
export function setupSkipLink(doc: Document): () => void {
  const onClick = (event: MouseEvent) => {
    const link = event.target instanceof Element ? event.target.closest('a.skip-link') : null;
    const main = link ? doc.getElementById('main') : null;
    if (!main) return;
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}
