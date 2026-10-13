/**
 * Styles for client-only experience elements, set through refs after hydration (freeze
 * decision 51): no `style` attribute ever reaches the server HTML, and CSSOM writes are not
 * subject to the CSP `style-src` rule.
 */
export type StyleMap = Readonly<Record<string, string>>;

export function applyStyle(el: HTMLElement | null, styles: StyleMap): void {
  if (el === null) return;
  for (const [property, value] of Object.entries(styles)) el.style.setProperty(property, value);
}
