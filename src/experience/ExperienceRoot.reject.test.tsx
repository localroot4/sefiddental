// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ExperienceRoot } from './ExperienceRoot';

// The engine chunk fails to load (a deploy swapped it, the network dropped it).
vi.mock('./engine/scrollEngine', () => {
  throw new Error('chunk load failed');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-pins');
});

it('XR12 an engine chunk that fails to load leaves the page without pins (the tier-0 geometry)', async () => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(pointer: fine)' || query === '(min-width: 1024px)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  // WebGL 2 on a hardware renderer, so the probe keeps the forced tier 2 and its pins.
  const gl = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null,
    getParameter: () => 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' ? gl : null) as never);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  document.documentElement.setAttribute('data-pins', ''); // the inline latch
  window.history.replaceState(null, '', '/?tier=2');
  render(
    <ExperienceRoot siteCap={null}>
      <div data-scene="services" />
    </ExperienceRoot>,
  );
  await waitFor(() => expect(document.documentElement.hasAttribute('data-pins')).toBe(false));
  expect(error).toHaveBeenCalledWith(
    '[experience] scroll engine failed to load; tier 0.',
    expect.any(Error),
  );
  expect(document.documentElement.dataset.tier).toBe('2');
});
