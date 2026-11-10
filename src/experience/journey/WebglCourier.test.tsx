// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPulse } from '../canvas/pulse';

import type { Journey } from './driver';
import { WebglCourier } from './WebglCourier';

const mocks = vi.hoisted(() => ({
  canvas: null as HTMLCanvasElement | null,
}));
vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: unknown) => unknown) =>
    select({ get: () => ({ gl: { domElement: mocks.canvas }, size: { width: 1, height: 1 } }) }),
  addEffect: () => () => {},
  addAfterEffect: () => () => {},
}));
vi.mock('three', () => ({
  PMREMGenerator: class {
    fromScene() {
      return { texture: { dispose() {} } };
    }
    dispose() {}
  },
}));
vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: class {
    dispose() {}
  },
}));
vi.mock('../world/brandGeometry', () => ({
  brandGeometry: { acquire: () => Promise.resolve({}), release() {} },
}));
vi.mock('../scenes/webgl/hooks', () => ({
  pageLeaving: () => false,
  useMolar: () => ({}),
  useRigLifetime: () => {},
}));
vi.mock('./courierRig', () => ({
  BOX_GROW: 1.5,
  createCourierRig: () => ({ setEnvironment() {} }),
}));

afterEach(cleanup);

describe('WebglCourier', () => {
  it('WC1 asks for a frame once its rig is ready, so a sleeping FrameDriver wakes for the handover', async () => {
    mocks.canvas = document.createElement('canvas');
    const pulse = createPulse();
    pulse.begin(false); // the World drew: no frame is wanted now
    const wake = vi.fn();
    pulse.onWake(wake);
    const journey = { setWebgl: vi.fn() } as unknown as Journey;
    render(<WebglCourier journey={journey} tier={2} particles={0} pulse={pulse} />);
    await act(async () => {}); // mark.glb resolves: the rig is built
    expect(wake).toHaveBeenCalled();
    expect(pulse.begin(false)).toBe(true);
  });
});
