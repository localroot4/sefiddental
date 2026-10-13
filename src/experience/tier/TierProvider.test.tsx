// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TierProvider, useTier } from './TierProvider';

/** Controllable matchMedia: jsdom has none. */
function installMatchMedia(initial: Record<string, boolean>) {
  const state = { ...initial };
  const listeners = new Map<string, Set<() => void>>();
  window.matchMedia = ((query: string) => ({
    get matches() {
      return state[query] ?? false;
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => {
      if (!listeners.has(query)) listeners.set(query, new Set());
      listeners.get(query)?.add(cb);
    },
    removeEventListener: (_type: string, cb: () => void) => listeners.get(query)?.delete(cb),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return (query: string, matches: boolean) => {
    state[query] = matches;
    for (const cb of listeners.get(query) ?? []) cb();
  };
}

/** A WebGL 2 context that reports a hardware renderer; detect-gpu never runs in these tests. */
function installWebgl2() {
  const fake = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info'
        ? { UNMASKED_RENDERER_WEBGL: 0x9246 }
        : name === 'WEBGL_lose_context'
          ? { loseContext: () => {} }
          : null,
    getParameter: () => 'ANGLE (Apple, Apple M1, OpenGL 4.1)',
    RENDERER: 0x1f01,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' ? fake : null) as never);
}

function Probe() {
  const t = useTier();
  return <output data-testid="tier">{`${t.tier}|${t.reason}|${t.mode}|${t.status}`}</output>;
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

let setMedia: (query: string, matches: boolean) => void;

beforeEach(() => {
  setMedia = installMatchMedia({ '(pointer: fine)': true, '(min-width: 1024px)': true });
  installWebgl2();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TierProvider (dom)', () => {
  it('V9 reduced motion change gives tier 0 and html[data-tier="0"]', async () => {
    window.history.replaceState(null, '', '/?tier=2');
    const view = render(
      <TierProvider siteCap={null}>
        <Probe />
      </TierProvider>,
    );
    await flush();
    expect(view.getByTestId('tier').textContent).toBe('2|query-override|fixed|ready');
    expect(document.documentElement.dataset.tier).toBe('2');
    expect(document.documentElement.dataset.tierReason).toBe('query-override');

    act(() => setMedia('(prefers-reduced-motion: reduce)', true));
    expect(view.getByTestId('tier').textContent).toBe('0|reduced-motion|fixed|ready');
    expect(document.documentElement.dataset.tier).toBe('0');
  });

  it('V9 a corrupt sefid-quality reads as auto', async () => {
    localStorage.setItem('sefid-quality', 'ultra');
    window.history.replaceState(null, '', '/?tier=3&monitor=1');
    const view = render(
      <TierProvider siteCap={null}>
        <Probe />
      </TierProvider>,
    );
    await flush();
    expect(view.getByTestId('tier').textContent).toBe('3|query-override|auto|ready');
  });

  it('V9 sessionStorage sefid-tier-cap is honoured in auto mode', async () => {
    sessionStorage.setItem('sefid-tier-cap', '1');
    window.history.replaceState(null, '', '/?tier=3&monitor=1');
    const view = render(
      <TierProvider siteCap={null}>
        <Probe />
      </TierProvider>,
    );
    await flush();
    expect(view.getByTestId('tier').textContent).toBe('1|monitor|auto|ready');
    expect(document.documentElement.dataset.tierReason).toBe('monitor');
  });

  it('V9 unmount removes html[data-tier] and html[data-tier-reason]', async () => {
    window.history.replaceState(null, '', '/?tier=2');
    render(
      <TierProvider siteCap={null}>
        <Probe />
      </TierProvider>,
    );
    await flush();
    expect(document.documentElement.dataset.tier).toBe('2');
    cleanup();
    expect(document.documentElement.dataset.tier).toBeUndefined();
    expect(document.documentElement.dataset.tierReason).toBeUndefined();
  });

  it('V9 useTier outside the provider throws a clear error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/TierProvider/);
  });
});
