// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./driver', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./driver')>()),
  createJourney: () => ({ destroy: vi.fn() }),
}));

import JourneyLayer from './JourneyLayer';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('JourneyLayer', () => {
  it('JL1 the courier layer takes no pointer event from the moment it is in the page', async () => {
    // Outside act: React commits the DOM, then runs its passive effects a task later; a tap can
    // land in between (T-HOME12 in WebKit: a press on a CTA released on the layer's SVG).
    const previous = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    const container = document.createElement('div');
    document.body.append(container);
    const atInsert = new Promise<string>((resolve) => {
      // A mutation record is delivered at the commit's microtask checkpoint, before the effects.
      new MutationObserver(() => {
        const layer = container.querySelector<HTMLElement>('[data-courier-layer]');
        if (layer) resolve(layer.style.pointerEvents);
      }).observe(container, { childList: true, subtree: true });
    });
    const root = createRoot(container);
    try {
      root.render(
        <JourneyLayer
          root={container}
          engine={{ onTick: () => () => {} } as never}
          tier={1}
          debug={false}
          onJourney={() => {}}
        />,
      );
      expect(await atInsert).toBe('none');
    } finally {
      root.unmount();
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previous;
    }
  });
});
