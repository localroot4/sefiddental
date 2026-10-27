import { gsap } from 'gsap';
import { describe, expect, it } from 'vitest';

import type { SceneContext } from '../types';

import trust from './trust';

describe('scene 2 trust band (dom/trust.ts)', () => {
  it('TS1 adds nothing to the master and touches no attribute: the facts stay static (D18, no count-up)', () => {
    const el = document.createElement('div');
    el.dataset.scene = 'trust';
    const before = el.outerHTML;
    const master = gsap.timeline({ paused: true });
    master.addLabel('trust', 0.3);
    const ctx = { el, master, label: 'trust', id: 'trust' } as unknown as SceneContext;
    expect(trust.setup(ctx)).toBeUndefined();
    expect(master.getChildren(false, true, false)).toHaveLength(0);
    expect(el.outerHTML).toBe(before);
    master.kill();
  });
});
