import type { ReactNode } from 'react';

// A Latin run: words, digits and the joiners between them («VIP», «Sefid Dental»).
const LATIN = /[A-Za-z][A-Za-z0-9]*(?:[ .&+-]+[A-Za-z0-9]+)*/g;

/**
 * Persian copy with its Latin words as LTR islands (DESIGN.md 8, copy-facts CR-35): «VIP» and
 * «CIP» in headings, tier names, FAQs and intros.
 */
export function ltr(text: string): ReactNode {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LATIN)) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <bdi key={match.index} dir="ltr">
        {match[0]}
      </bdi>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : parts;
}
