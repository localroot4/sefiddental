import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyStyle } from './applyStyle';
import {
  INTRO_HARD_CAP_MS,
  isIntroDone,
  onIdle,
  useDocumentLoaded,
  useDocumentVisible,
  useIntroDone,
} from './browserSignals';

function Signals() {
  const loaded = useDocumentLoaded();
  const visible = useDocumentVisible();
  const intro = useIntroDone();
  return <output data-testid="s">{`${loaded}|${visible}|${intro}`}</output>;
}

const read = () => screen.getByTestId('s').textContent;
const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete document.documentElement.dataset.intro;
});

describe('document signals', () => {
  it('BS1 load and visibility follow the document and their events', () => {
    const ready = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<Signals />);
    expect(read()).toBe('false|false|true');
    ready.mockReturnValue('complete');
    act(() => {
      window.dispatchEvent(new Event('load'));
    });
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(read()).toBe('true|true|true');
  });

  it('BS2 a playing intro ends on the data-intro change or the sefid:intro-end event', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    document.documentElement.dataset.intro = 'playing';
    render(<Signals />);
    expect(read()).toMatch(/\|false$/);
    document.documentElement.dataset.intro = 'done';
    await flush();
    expect(read()).toMatch(/\|true$/);

    document.documentElement.dataset.intro = 'playing';
    await flush();
    expect(read()).toMatch(/\|false$/);
    // The event alone re-reads the state; the attribute decides.
    document.documentElement.removeAttribute('data-intro');
    act(() => {
      document.dispatchEvent(new Event('sefid:intro-end'));
    });
    expect(read()).toMatch(/\|true$/);
  });

  it('BS3 the hard cap ends a stuck intro', () => {
    document.documentElement.dataset.intro = 'playing';
    const now = vi.spyOn(performance, 'now').mockReturnValue(INTRO_HARD_CAP_MS - 1);
    expect(isIntroDone()).toBe(false);
    now.mockReturnValue(INTRO_HARD_CAP_MS);
    expect(isIntroDone()).toBe(true);
  });

  it('BS4 onIdle falls back to a 200 ms timer and cancels', () => {
    vi.useFakeTimers();
    const ric = window.requestIdleCallback;
    // jsdom may define requestIdleCallback; the fallback is the Safari path.
    (window as { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
    try {
      const cb = vi.fn();
      onIdle(cb, 1000);
      vi.advanceTimersByTime(199);
      expect(cb).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(cb).toHaveBeenCalledTimes(1);
      const cancelled = vi.fn();
      onIdle(cancelled, 1000)();
      vi.advanceTimersByTime(500);
      expect(cancelled).not.toHaveBeenCalled();
    } finally {
      window.requestIdleCallback = ric;
    }
  });

  it('BS5 onIdle uses requestIdleCallback with the timeout when present', () => {
    const request = vi.fn((cb: IdleRequestCallback, _opts?: IdleRequestOptions) => {
      cb({ didTimeout: false, timeRemaining: () => 10 });
      return 7;
    });
    const cancel = vi.fn();
    const saved = [window.requestIdleCallback, window.cancelIdleCallback] as const;
    window.requestIdleCallback = request;
    window.cancelIdleCallback = cancel;
    try {
      const cb = vi.fn();
      onIdle(cb, 1500)();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]?.[1]).toEqual({ timeout: 1500 });
      expect(cancel).toHaveBeenCalledWith(7);
    } finally {
      [window.requestIdleCallback, window.cancelIdleCallback] = saved;
    }
  });
});

describe('applyStyle', () => {
  it('AS1 writes properties through the CSSOM and ignores a missing element', () => {
    const el = document.createElement('div');
    applyStyle(el, { '--sefid-progress': '0.5', opacity: '0' });
    expect(el.style.getPropertyValue('--sefid-progress')).toBe('0.5');
    expect(el.style.opacity).toBe('0');
    expect(() => applyStyle(null, { opacity: '1' })).not.toThrow();
  });
});
