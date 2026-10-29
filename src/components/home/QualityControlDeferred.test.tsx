// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { prerender } from 'react-dom/static';
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';

import type { QualityLabels } from './QualityControl';

const LABELS: QualityLabels = {
  legend: 'کیفیت',
  auto: 'خودکار',
  tiers: ['۰', '۱', '۲', '۳'],
  reducedMotion: 'r',
  siteCap: 's',
  device: 'd',
  saveData: 'v',
};

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  })) as unknown as typeof window.matchMedia;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** What takes room: the fieldset, its legend and the radios, by tag, class and value. */
const shape = (root: ParentNode) =>
  Array.from(root.querySelectorAll('fieldset, legend, input'), (node) =>
    [node.tagName, node.getAttribute('class'), node.getAttribute('value')].join(' '),
  );

/** The tree with a fresh TierProvider and island module (the lazy and the tier context). */
async function tree() {
  const { TierProvider } = await import('@/experience/tier/TierProvider');
  const { QualityControlDeferred } = await import('./QualityControlDeferred');
  return (
    <TierProvider siteCap={null}>
      <QualityControlDeferred labels={LABELS} />
    </TierProvider>
  );
}

it('QD1 the server fieldset stays at hydration; after `load` and one task the island replaces it with the same markup, enabled', async () => {
  const { prelude } = await prerender(await tree());
  const container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = await new Response(prelude).text();
  onTestFinished(() => container.remove());
  const fieldset = container.querySelector('fieldset')!;
  const serverShape = shape(container);
  expect(container.querySelectorAll('input[type="radio"]:disabled')).toHaveLength(5);

  vi.resetModules();
  const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const onRecoverableError = vi.fn();
  const fresh = await tree();
  const root = await act(async () => hydrateRoot(container, fresh, { onRecoverableError }));
  onTestFinished(() => act(() => root.unmount()));
  expect(container.querySelector('fieldset')).toBe(fieldset);
  expect(container.querySelectorAll('input[type="radio"]:disabled')).toHaveLength(5);

  readyState.mockReturnValue('complete');
  window.dispatchEvent(new Event('load'));
  await act(async () => {});
  expect(container.querySelectorAll('input[type="radio"]:disabled')).toHaveLength(5);

  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  await waitFor(() =>
    expect(container.querySelectorAll('input[type="radio"]:disabled')).toHaveLength(0),
  );
  // The provider's state changed above the dehydrated island, so React renders it fresh: the same
  // fieldset, legend and radios.
  expect(shape(container)).toEqual(serverShape);
  expect(onRecoverableError).not.toHaveBeenCalled();
});
