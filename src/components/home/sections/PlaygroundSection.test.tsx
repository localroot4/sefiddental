import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PlaygroundSection } from './PlaygroundSection';

// The control reads the tier store (QualityControl.test.tsx covers it); the markup is the subject.
vi.mock('@/components/home/QualityControlDeferred', () => ({
  QualityControlDeferred: () => null,
}));

describe('scene 11 markup (phone spec scene 11, D24)', () => {
  it('PG1 «پخش دوباره» lands in the footer bottom bar and keeps its box at every tier: invisible and inert, never display none', async () => {
    const markup = renderToStaticMarkup(<PlaygroundSection />);
    expect(markup).not.toContain('style=');
    // The portal's slot is the footer's (SiteFooter); the server HTML has no controls.
    expect(markup).not.toContain('data-playground-replay');
    document.body.innerHTML =
      '<div id="app"></div><footer><div data-footer-controls=""></div></footer>';
    const root = createRoot(document.getElementById('app')!);
    await act(async () => root.render(<PlaygroundSection />));
    const replay = document.querySelector(
      'footer [data-footer-controls] [data-playground-replay]',
    )!;
    expect(replay).not.toBeNull();
    expect(replay.hasAttribute('hidden')).toBe(false);
    expect(replay.hasAttribute('inert')).toBe(true);
    expect(replay.classList.contains('invisible')).toBe(true);
    await act(async () => root.unmount());
    document.body.innerHTML = '';
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
