import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PlaygroundSection } from './PlaygroundSection';

describe('scene 11 markup (phone spec scene 11, D24)', () => {
  it('PG1 the server HTML has no inline style (CSP) and no controls row (owner 2026-11-16)', () => {
    const markup = renderToStaticMarkup(<PlaygroundSection />);
    expect(markup).not.toContain('style=');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<fieldset');
  });

  it('PG2 the field is the footer logo: six parts at their place in the lockup, the letters too, hidden and inert to the pointer until the scene runs', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToStaticMarkup(<PlaygroundSection />);
    const field = root.querySelector('[data-playground-field]')!;
    expect(field.classList.contains('invisible')).toBe(true);
    expect(field.classList.contains('pointer-events-none')).toBe(true);
    expect(field.classList.contains('top-full')).toBe(true);
    const parts = Array.from(root.querySelectorAll('[data-playground-part]'));
    expect(parts.map((p) => p.getAttribute('data-playground-part'))).toEqual([
      'mark',
      'bar',
      'wordmark',
      'diamond-1',
      'diamond-2',
      'diamond-4',
    ]);
    // Each a share of the logo box (no inline style: CSP), the touch area round its art.
    for (const part of parts) {
      const classes = Array.from(part.classList);
      for (const side of ['left-[', 'top-[', 'w-[', 'h-['])
        expect(classes.some((c) => c.startsWith(side) && c.endsWith('%]'))).toBe(true);
      expect(classes).toContain('before:size-target');
      expect(classes).toContain('pointer-events-auto');
    }
    expect(root.querySelector('[data-dock="footer"]')).toBe(parts[0]);
    expect(field.querySelector('use[href="#lockup-wordmark"]')).not.toBeNull();
  });
});
