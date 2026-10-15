/** Decoded NFC form of a path, so `/%D8%A2…` and `/آ…` compare equal; a bad escape stays as is. */
function plain(path: string): string {
  try {
    return decodeURI(path).normalize('NFC');
  } catch {
    return path.normalize('NFC');
  }
}

/**
 * aria-current of a nav link: `page` on its own page, `true` under it (a dentist profile under
 * «پزشکان»), else none. Both draw the active bar.
 */
export function currentOf(pathname: string | null, href: string): 'page' | 'true' | undefined {
  if (!pathname) return undefined;
  const here = plain(pathname);
  const target = plain(href);
  if (here === target) return 'page';
  return here.startsWith(`${target}/`) ? 'true' : undefined;
}

/** False on the templates the sticky bar never covers (booking, its success page, emergency). */
export function showsStickyBar(pathname: string | null, hiddenOn: readonly string[]): boolean {
  if (!pathname) return true;
  const here = plain(pathname);
  return !hiddenOn.some((path) => plain(path) === here);
}
