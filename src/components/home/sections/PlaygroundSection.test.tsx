import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PlaygroundSection } from './PlaygroundSection';

// The control reads the tier store (QualityControl.test.tsx covers it); the markup is the subject.
vi.mock('@/components/home/QualityControlDeferred', () => ({
  QualityControlDeferred: () => null,
}));

describe('scene 11 markup (phone spec scene 11, D24)', () => {
  it('PG1 «پخش دوباره» keeps its box at every tier: invisible and inert in the server HTML, never display none', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToStaticMarkup(<PlaygroundSection />);
    const replay = root.querySelector('[data-playground-replay]')!;
    expect(replay.hasAttribute('hidden')).toBe(false);
    expect(replay.hasAttribute('inert')).toBe(true);
    expect(replay.classList.contains('invisible')).toBe(true);
    expect(root.querySelector('[style]')).toBeNull();
  });

  it('PG2 under 1024 px every part rests from the inline end (no start inset without lg:); the 44 px minimum is T-BF5b', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToStaticMarkup(<PlaygroundSection />);
    const parts = Array.from(root.querySelectorAll('[data-playground-part]'));
    expect(parts).toHaveLength(6);
    for (const part of parts) {
      const classes = Array.from(part.classList);
      expect(classes.some((c) => c.startsWith('end-['))).toBe(true);
      expect(classes.filter((c) => c.startsWith('start-'))).toEqual([]);
      expect(classes.filter((c) => c.startsWith('max-md:'))).toEqual([]);
    }
  });
});
