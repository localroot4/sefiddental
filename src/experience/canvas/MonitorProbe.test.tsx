// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FrameRuntime } from '../core/store';

import { MonitorProbe } from './MonitorProbe';

const mocks = vi.hoisted(() => ({
  frame: null as null | ((state: unknown, delta: number) => void),
  push: vi.fn(),
  options: null as null | { phone?: boolean },
}));
vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: unknown, delta: number) => void) => {
    mocks.frame = cb;
  },
}));
vi.mock('../tier/frameMonitor', () => ({
  createFrameMonitor: (options: { phone?: boolean }) => {
    mocks.options = options;
    return { push: mocks.push, reset: vi.fn() };
  },
}));

const runtime = { resumes: 0 } as FrameRuntime;
const tick = (y: number) => {
  window.scrollY = y;
  mocks.frame?.({}, 0.05);
};

afterEach(() => {
  cleanup();
  mocks.push.mockClear();
});

describe('MonitorProbe', () => {
  it('MP1 a phone (D26) counts canvas frames only while the page scrolls, in phone mode', () => {
    render(<MonitorProbe tier={2} phone runtime={runtime} onStepDown={() => {}} />);
    expect(mocks.options?.phone).toBe(true);
    tick(0); // the first frame resets the warm-up
    tick(0);
    tick(0);
    expect(mocks.push).not.toHaveBeenCalled();
    tick(120);
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it('MP2 a desktop canvas samples at rest too', () => {
    render(<MonitorProbe tier={2} phone={false} runtime={runtime} onStepDown={() => {}} />);
    tick(0);
    tick(0);
    tick(0);
    expect(mocks.push).toHaveBeenCalledTimes(2);
  });
});
