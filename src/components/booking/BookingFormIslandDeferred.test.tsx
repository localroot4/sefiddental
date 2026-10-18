import { act, render, waitFor } from '@testing-library/react';
import { Component, type ReactNode } from 'react';
import { hydrateRoot, type HydrationOptions } from 'react-dom/client';
import { prerender } from 'react-dom/static';
import { afterEach, expect, it, onTestFinished, vi } from 'vitest';

import { BookingFormIslandDeferred } from './BookingFormIslandDeferred';

const imported = vi.hoisted(() => vi.fn());
vi.mock('./BookingFormIsland', async (importOriginal) => {
  imported();
  return importOriginal();
});
vi.mock('@/components/chrome/formSession', () => ({
  getFormSession: () => new Promise(() => {}),
  renewFormSession: vi.fn(),
}));
vi.mock('@/lib/track/track', () => ({ track: vi.fn() }));

const text = 'متن';
const props = {
  variant: 'full',
  instance: 'dialog',
  action: '/رزرو-نوبت',
  labels: {
    phone: text,
    phoneHelp: text,
    submit: text,
    submitting: text,
    done: text,
    registered: text,
    callbackGeneric: text,
    errors: { empty: text, invalid: text, landline: text, noteTooLong: text },
    notices: { neutral: text, retry: text, expired: text, network: text, server: text, name: text },
  },
  header: <h2 id="bk-dialog-title">{text}</h2>,
  hidden: null,
  privacy: null,
  icons: { error: null, info: null, check: null, spinner: null },
  submitClass: { idle: 'idle', busy: 'busy' },
  controlClass: 'control',
  infoClass: 'info',
  success: null,
} as const;

afterEach(() => vi.useRealTimers());

it('BD1 the dialog island is imported after `load` and one task, then takes the form (G7)', async () => {
  const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  onTestFinished(() => readyState.mockRestore());
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const { container } = render(<BookingFormIslandDeferred {...props} />);
  await act(async () => {});
  expect(imported).not.toHaveBeenCalled();

  readyState.mockReturnValue('complete');
  window.dispatchEvent(new Event('load'));
  await act(async () => {});
  expect(imported).not.toHaveBeenCalled();

  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  await waitFor(() => expect(container.querySelector('form')?.noValidate).toBe(true));
  expect(imported).toHaveBeenCalledOnce();
});

/**
 * `tree`'s server HTML in the document, hydrated with a fresh module, as a browser has it: the
 * prerender here loaded the island, so the lazy is made again (vi.resetModules).
 */
async function hydrate(
  tree: (Island: typeof BookingFormIslandDeferred) => ReactNode,
  options: HydrationOptions,
) {
  const { prelude } = await prerender(tree(BookingFormIslandDeferred));
  const container = document.body.appendChild(document.createElement('div'));
  container.innerHTML = await new Response(prelude).text();
  onTestFinished(() => container.remove());
  vi.resetModules();
  const fresh = (await import('./BookingFormIslandDeferred')).BookingFormIslandDeferred;
  return { container, start: () => hydrateRoot(container, tree(fresh), options) };
}

it('BD2 hydration keeps the server form and what was typed; after `load` the island owns it', async () => {
  const onRecoverableError = vi.fn();
  const { container, start } = await hydrate((Island) => <Island {...props} />, {
    onRecoverableError,
  });
  const form = container.querySelector('form')!;
  const phone = container.querySelector<HTMLInputElement>('input[type="tel"]')!;
  phone.value = '0912 345 6789';
  const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  onTestFinished(() => readyState.mockRestore());
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  const root = await act(async () => start());
  onTestFinished(() => act(() => root.unmount()));
  expect(container.querySelector('form')).toBe(form);
  expect(form.noValidate).toBe(false);

  readyState.mockReturnValue('complete');
  window.dispatchEvent(new Event('load'));
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  await waitFor(() => expect(form.noValidate).toBe(true));
  expect(container.querySelector('form')).toBe(form);
  expect(container.querySelector('input[type="tel"]')).toBe(phone);
  expect(phone.value).toBe('0912 345 6789');
  expect(onRecoverableError).not.toHaveBeenCalled();
});

it('BD3 a failed import leaves the rest of the page and reaches no outer boundary', async () => {
  class Outer extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError = () => ({ failed: true });
    render() {
      return this.state.failed ? <p>outer</p> : this.props.children;
    }
  }
  const onCaughtError = vi.fn();
  const onUncaughtError = vi.fn();
  const { container, start } = await hydrate(
    (Island) => (
      <Outer>
        <p id="rest">rest</p>
        <Island {...props} />
      </Outer>
    ),
    { onCaughtError, onUncaughtError, onRecoverableError: () => {} },
  );
  const rest = container.querySelector('#rest');
  vi.doMock('./BookingFormIsland', () => Promise.reject(new Error('chunk load failed')));
  onTestFinished(() => void vi.doUnmock('./BookingFormIsland'));
  const root = await act(async () => start());
  onTestFinished(() => act(() => root.unmount()));
  await waitFor(() => expect(onCaughtError).toHaveBeenCalledOnce());
  expect(container.querySelector('form')).toBeNull();
  expect(container.querySelector('#rest')).toBe(rest);
  expect(container.textContent).not.toContain('outer');
  expect(onUncaughtError).not.toHaveBeenCalled();
});
