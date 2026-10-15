import { DRAWER_ID } from './ids';

/**
 * Closes the phone drawer when the viewport grows to 1024 px: the desktop bar takes over and the
 * drawer is display:none there, so an open one would leave the page inert behind nothing.
 */
export function setupDrawer(doc: Document, win: Window = window): () => void {
  const drawer = doc.getElementById(DRAWER_ID);
  if (!(drawer instanceof HTMLDialogElement)) return () => {};
  const desktop = win.matchMedia('(min-width: 64rem)');
  const onWide = () => {
    if (desktop.matches && drawer.open) drawer.close();
  };
  desktop.addEventListener('change', onWide);
  return () => desktop.removeEventListener('change', onWide);
}
