import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createFrameRuntime, createStore, useStore } from './store';

describe('experience store', () => {
  it('CS1 set notifies only on a real change and keeps untouched keys', () => {
    const store = createStore({ a: 1, b: 'x' });
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ a: 1 });
    expect(listener).not.toHaveBeenCalled();
    const before = store.get();
    store.set({ a: 2 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ a: 2, b: 'x' });
    expect(store.get()).not.toBe(before);
  });

  it('CS2 unsubscribe stops the notifications', () => {
    const store = createStore({ n: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.set({ n: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('CS3 useStore re-renders with the selected value', () => {
    const store = createStore({ n: 0, other: 'a' });
    function Reader() {
      return <output data-testid="n">{useStore(store, (s) => s.n)}</output>;
    }
    render(<Reader />);
    expect(screen.getByTestId('n').textContent).toBe('0');
    act(() => store.set({ n: 3 }));
    expect(screen.getByTestId('n').textContent).toBe('3');
  });

  it('CS4 frame runtime counts frames, resumes and each context loss once', () => {
    const runtime = createFrameRuntime();
    expect(runtime.gate).toBe('not-mounted');
    runtime.setGate('open');
    runtime.countFrame();
    runtime.countFrame();
    runtime.markResume();
    expect(runtime.gate).toBe('open');
    expect(runtime.framesRendered).toBe(2);
    expect(runtime.resumes).toBe(1);
    expect(runtime.setContextLost(true)).toBe(1);
    expect(runtime.setContextLost(true)).toBe(1);
    expect(runtime.contextLost).toBe(true);
    expect(runtime.setContextLost(false)).toBe(1);
    expect(runtime.setContextLost(true)).toBe(2);
    expect(runtime.contextLossCount).toBe(2);
    const get = () => ({}) as never;
    runtime.setR3f(get);
    expect(runtime.r3f).toBe(get);
    runtime.setR3f(null);
    expect(runtime.r3f).toBeNull();
  });
});
