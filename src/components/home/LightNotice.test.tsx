import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TierProvider, useTier } from '@/experience/tier/TierProvider';

import { LightNotice, type LightNoticeLabels } from './LightNotice';

const LABELS: LightNoticeLabels = {
  loaded: 'loaded copy',
  stepped: 'stepped copy',
  on: 'effects on',
  off: 'effects off',
  turnOn: 'turn on',
  turnOff: 'turn off',
  dismiss: 'close',
};

/** A coarse-pointer phone under 1024 px (jsdom has no matchMedia). */
function installPhone(): void {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

/**
 * A phone with WebGL 2 for the switch: the saved choice lets the probe run, and without WebGL 2
 * D-Q3 would keep tier 0 under the choice (jsdom has none).
 */
function installWebgl2(): void {
  const gl = {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null,
    getParameter: () => 'Adreno (TM) 610',
    RENDERER: 0x1f01,
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === 'webgl2' ? gl : null) as never);
}

/** The ResizeObserver callbacks, so a test can report a height. */
let resized: Array<() => void>;

beforeEach(() => {
  installPhone();
  // Class W at hydration: phone mode with 2 GB (D23), no probe, status 'ready' after `load`.
  Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
  resized = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resized.push(callback);
      }
      observe(): void {
        resized.at(-1)?.();
      }
      disconnect(): void {}
    },
  );
  // The fine-pointer case runs the probe: no WebGL in jsdom.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'Date',
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'deviceMemory');
  document.documentElement.removeAttribute('style');
});

/** The «کیفیت» control of the footer (step 8): a saved choice made outside the notice. */
function Quality() {
  const tier = useTier();
  return (
    <button type="button" onClick={() => tier.setUserOverride(1)}>
      quality
    </button>
  );
}

/** The home's parts the notice reads: the header, the hero card, main with a text field. */
function page() {
  return render(
    <>
      <header />
      <TierProvider siteCap={null}>
        <LightNotice labels={LABELS} buttonClass={{ toggle: 'toggle', dismiss: 'dismiss' }} />
        <Quality />
        <main id="main">
          <div>
            <div id="bk-hero" />
          </div>
          <input aria-label="field" />
          <a href="#x">link</a>
        </main>
      </TierProvider>
    </>,
  );
}

const box = (): HTMLElement => document.querySelector('[data-light-notice]') as HTMLElement;
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

/** `load` passed, the store is ready, then 1000 ms without scroll with the hero card passed. */
async function openNotice(): Promise<void> {
  await advance(0);
  await advance(1000);
}

describe('LightNotice (phone spec 3.1 to 3.5, U-PH9)', () => {
  it('U-PH9 the status element is in the DOM, empty, from hydration, never under display none', () => {
    page();
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(status.id).toBe('light-notice-text');
    expect(box().className).toBe('sr-only');
    expect(box().querySelectorAll('button')).toHaveLength(0);
    for (let el: HTMLElement | null = status; el !== null; el = el.parentElement) {
      expect(el.hidden).toBe(false);
      expect(el.style.display).not.toBe('none');
    }
  });

  it('U-PH9 opens after the idle with the box first and the text one frame later; no focus() on open', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    page();
    await openNotice();
    expect(box().getAttribute('data-light-notice')).toBe('entering');
    expect(box().querySelectorAll('button')).toHaveLength(2);
    expect(screen.getByRole('status').textContent).toBe('');
    await advance(40);
    expect(box().getAttribute('data-light-notice')).toBe('open');
    expect(screen.getByRole('status').textContent).toBe(LABELS.loaded);
    expect(window.sessionStorage.getItem('sefid-light-notice')).toBe('1');
    expect(focus).not.toHaveBeenCalled();
    // The box's height reaches the scroll padding (globals.css).
    expect(document.documentElement.style.getPropertyValue('--light-notice-h')).toContain(
      'var(--space-2)',
    );
  });

  it('U-PH9 never over the first screen: no notice while the hero card is below the header', async () => {
    page();
    const card = document.getElementById('bk-hero')?.parentElement as HTMLElement;
    vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ bottom: 500 } as DOMRect);
    await openNotice();
    await advance(2000);
    expect(box().className).toBe('sr-only');
  });

  it('U-PH9 both buttons are described by the status; the switch keeps the same focused button', async () => {
    installWebgl2();
    page();
    await openNotice();
    await advance(40);
    const [toggle, dismiss] = Array.from(box().querySelectorAll('button'));
    expect(toggle?.getAttribute('aria-describedby')).toBe('light-notice-text');
    expect(dismiss?.getAttribute('aria-describedby')).toBe('light-notice-text');
    expect(toggle?.textContent).toBe(LABELS.turnOn);

    toggle?.focus();
    await act(() => toggle?.click());
    // setUserOverride(max(1, detectedTier 0)): the saved «کیفیت» choice is 1.
    expect(window.localStorage.getItem('sefid-quality')).toBe('1');
    expect(screen.getByRole('status').textContent).toBe(LABELS.on);
    expect(box().querySelector('button')).toBe(toggle);
    expect(toggle?.textContent).toBe(LABELS.turnOff);
    expect(document.activeElement).toBe(toggle);

    await act(() => toggle?.click());
    expect(window.localStorage.getItem('sefid-quality')).toBe('0');
    expect(screen.getByRole('status').textContent).toBe(LABELS.off);
    expect(box().querySelector('button')).toBe(toggle);
    expect(document.activeElement).toBe(toggle);
    expect(box().getAttribute('data-light-notice')).toBe('open');
  });

  it('U-PH9 the switch label follows the store: a «کیفیت» choice made elsewhere while it is open', async () => {
    installWebgl2();
    page();
    await openNotice();
    await advance(40);
    const toggle = box().querySelector('button');
    expect(toggle?.textContent).toBe(LABELS.turnOn);
    await act(() => screen.getByRole('button', { name: 'quality' }).click());
    expect(window.localStorage.getItem('sefid-quality')).toBe('1');
    expect(box().getAttribute('data-light-notice')).toBe('open');
    expect(toggle?.textContent).toBe(LABELS.turnOff);
  });

  it('U-PH9 the open box has the raised-sheet edge in both themes: the line in light, the strong line in dark', async () => {
    page();
    await openNotice();
    const classes = box().className.split(' ');
    expect(classes).toContain('border-line');
    expect(classes).toContain('dark:border-line-strong');
  });

  it('U-PH9 a text field focus makes the box inert and transparent and keeps the text', async () => {
    page();
    await openNotice();
    await advance(40);
    await act(() => screen.getByRole('textbox').focus());
    await advance(1);
    expect(box().hasAttribute('inert')).toBe(true);
    expect(box().className).toContain('opacity-0');
    expect(screen.getByRole('status').textContent).toBe(LABELS.loaded);
    await act(() => screen.getByRole('textbox').blur());
    await advance(1);
    expect(box().hasAttribute('inert')).toBe(false);
  });

  it('U-PH9 «بستن» with focus inside closes, writes the dismiss record and moves focus to main', async () => {
    page();
    await openNotice();
    await advance(40);
    const dismiss = box().querySelectorAll('button')[1] as HTMLButtonElement;
    dismiss.focus();
    await act(() => dismiss.click());
    expect(document.activeElement?.id).toBe('main');
    const record = JSON.parse(window.localStorage.getItem('sefid-light-notice') ?? 'null');
    expect(record).toEqual({ variant: 'loaded', until: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    await advance(200);
    expect(box().className).toBe('sr-only');
    expect(screen.getByRole('status').textContent).toBe('');
    expect(document.documentElement.style.getPropertyValue('--light-notice-h')).toBe('');
  });

  it('U-PH9 «بستن» with focus elsewhere moves nothing', async () => {
    page();
    await openNotice();
    await advance(40);
    const link = screen.getByRole('link');
    link.focus();
    await act(() => (box().querySelectorAll('button')[1] as HTMLButtonElement).click());
    expect(document.activeElement).toBe(link);
  });

  it('U-PH9 a session that already showed it, or a fine pointer, opens nothing', async () => {
    window.sessionStorage.setItem('sefid-light-notice', '1');
    const first = page();
    await openNotice();
    expect(box().className).toBe('sr-only');
    first.unmount();

    window.sessionStorage.clear();
    window.matchMedia = ((query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    page();
    await openNotice();
    expect(box().className).toBe('sr-only');
  });
});
