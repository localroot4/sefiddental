import { describe, expect, it, vi } from 'vitest';

import { createPulse } from './pulse';

describe('canvas pulse', () => {
  it('P1 renders the first frame, then only frames asked for or while a slot always draws', () => {
    const pulse = createPulse();
    expect(pulse.begin(false)).toBe(true);
    expect(pulse.rendered()).toBe(true);
    expect(pulse.begin(false)).toBe(false);
    expect(pulse.rendered()).toBe(false);
    expect(pulse.begin(true)).toBe(true);
    pulse.request();
    expect(pulse.begin(false)).toBe(true);
    expect(pulse.begin(false)).toBe(false);
  });

  it('P2 a request wakes the driver; a removed wake is not called', () => {
    const pulse = createPulse();
    const wake = vi.fn();
    const off = pulse.onWake(wake);
    pulse.request();
    expect(wake).toHaveBeenCalledTimes(1);
    off();
    pulse.request();
    expect(wake).toHaveBeenCalledTimes(1);
  });
});
