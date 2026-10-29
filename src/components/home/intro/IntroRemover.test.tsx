import { act, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IntroRemover } from '@/components/home/intro/IntroRemover';

const DIALOG = '<dialog id="intro"></dialog>';
const ui = (
  <IntroRemover>
    <dialog id="intro" suppressHydrationWarning />
  </IntroRemover>
);

function setIntro(value: string | null): void {
  if (value === null) delete document.documentElement.dataset.intro;
  else document.documentElement.dataset.intro = value;
}

/** Sets the attribute inside an act scope, so the observer's microtask and the re-render run. */
const settle = (value: string | null) =>
  act(async () => {
    setIntro(value);
  });

/** jsdom has no User Timing: `intro:start` is answered from here. */
function markStart(startTime: number | null): void {
  performance.getEntriesByName = ((name: string) =>
    name === 'intro:start' && startTime !== null
      ? [{ startTime } as PerformanceEntry]
      : []) as typeof performance.getEntriesByName;
}

/** Hydrates the server markup, as the home page does, and returns the container. */
function hydrate(): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(ui);
  document.body.append(container);
  render(ui, { container, hydrate: true });
  return container;
}

describe('IntroRemover (report C4)', () => {
  let close: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    close = vi.fn();
    HTMLDialogElement.prototype.close = close as unknown as HTMLDialogElement['close'];
    markStart(null);
    setIntro(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('IR1 the server markup holds the dialog; hydration keeps it, then drops it when the script exited early', () => {
    expect(renderToStaticMarkup(ui)).toBe(DIALOG);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const container = hydrate();
    expect(container.querySelector('#intro')).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it('IR2 while playing the dialog stays; it leaves when the attribute changes', async () => {
    setIntro('playing');
    const container = hydrate();
    expect(container.querySelector('#intro')).not.toBeNull();
    await settle('done');
    expect(container.querySelector('#intro')).toBeNull();
    // An inert element keeps the dialog's place: the scenes after it keep their :nth-child
    // indices, which Chrome's scroll restoration of a reload resolves in the server markup.
    expect(Array.from(container.children, (el) => el.tagName)).toEqual(['TEMPLATE']);
  });

  it('IR3 the end event wakes it up: removed when the value is not playing, kept while it is', async () => {
    setIntro('playing');
    const container = hydrate();
    act(() => {
      document.dispatchEvent(new CustomEvent('sefid:intro-end'));
    });
    expect(container.querySelector('#intro')).not.toBeNull();
    setIntro('done');
    await act(async () => {
      document.dispatchEvent(new CustomEvent('sefid:intro-end'));
    });
    expect(container.querySelector('#intro')).toBeNull();
  });

  it('IR4a backstop: with the script still listening, its own close listener ends the intro once', async () => {
    markStart(performance.now() - 1000);
    setIntro('playing');
    const ended = vi.fn();
    document.addEventListener('sefid:intro-end', ended);
    const container = hydrate();
    // What the inline script's `close` listener does (introScript.ts `end(1)`), minus `close()`.
    container.querySelector('#intro')!.addEventListener('close', () => {
      setIntro('done');
      document.dispatchEvent(
        new CustomEvent('sefid:intro-end', { detail: { skipped: true, reduced: true } }),
      );
    });
    await act(async () => {
      vi.advanceTimersByTime(700);
    });
    expect(close).not.toHaveBeenCalled();
    expect(ended).toHaveBeenCalledOnce();
    expect((ended.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      skipped: true,
      reduced: true,
    });
    expect(container.querySelector('#intro')).toBeNull();
  });

  it('IR4b backstop: intro:start plus 1600 ms closes a dialog whose script no longer answers', async () => {
    markStart(performance.now() - 1000);
    setIntro('playing');
    const ended = vi.fn();
    document.addEventListener('sefid:intro-end', ended);
    const container = hydrate();
    await act(async () => {
      vi.advanceTimersByTime(500);
    });
    expect(close).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(close).toHaveBeenCalledOnce();
    expect(document.documentElement.dataset.intro).toBe('done');
    expect((ended.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      skipped: true,
      reduced: false,
    });
    expect(container.querySelector('#intro')).toBeNull();
  });

  it('IR5 the backstop does nothing after a normal end', async () => {
    markStart(performance.now());
    setIntro('playing');
    const container = hydrate();
    await settle('done');
    expect(container.querySelector('#intro')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1700);
    });
    expect(close).not.toHaveBeenCalled();
  });
});
