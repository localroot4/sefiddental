import { describe, expect, it } from 'vitest';

import {
  dismissUntil,
  LIGHT_NOTICE_MS,
  lightNotice,
  parseDismiss,
  type DismissRecord,
} from './lightNotice';
import type { EffectiveReason } from './tierStore';

const NOW = 1_800_000_000_000;

type Input = Parameters<typeof lightNotice>[0];

/** A coarse-pointer page at tier 0 in auto mode, the probe answered, the intro over. */
function input(over: Partial<Input['state']> = {}, rest: Partial<Omit<Input, 'state'>> = {}) {
  return {
    state: {
      hydrated: true,
      status: 'ready' as const,
      tier: 0 as const,
      mode: 'auto' as const,
      reason: 'device-memory' as EffectiveReason,
      finePointer: false,
      lastStep: null,
      ...over,
    },
    introDone: true,
    shown: false,
    dismissed: null,
    now: NOW,
    ...rest,
  } satisfies Input;
}

const step = { source: 'monitor' as const, tier: 0 as const, atMs: 5000 };

describe('lightNotice (phone spec 3.1, U-PH8)', () => {
  it.each([
    'software-renderer',
    'gpu-benchmark',
    'device-memory',
    'device-cpu',
    'light-floor',
    'monitor',
  ] as const)('U-PH8 %s at tier 0 opens the loaded copy', (reason) => {
    expect(lightNotice(input({ reason }))).toEqual({ variant: 'loaded' });
  });

  it.each([
    'reduced-motion',
    'save-data',
    'site-cap',
    'user-override',
    'query-override',
    'no-webgl2',
    'context-loss',
  ] as const)('U-PH8 %s never opens it', (reason) => {
    expect(lightNotice(input({ reason }))).toBeNull();
  });

  it('U-PH8 a step recorded in this page view gives the stepped copy', () => {
    expect(lightNotice(input({ reason: 'monitor', lastStep: step }))).toEqual({
      variant: 'stepped',
    });
  });

  it('U-PH8 a fine pointer, a playing intro, an unready tier, fixed mode or tier 1 gives null', () => {
    expect(lightNotice(input({ finePointer: true }))).toBeNull();
    expect(lightNotice({ ...input(), introDone: false })).toBeNull();
    expect(lightNotice(input({ status: 'pending' }))).toBeNull();
    expect(lightNotice(input({ hydrated: false }))).toBeNull();
    expect(lightNotice(input({ mode: 'fixed' }))).toBeNull();
    expect(lightNotice(input({ tier: 1, reason: 'gpu-benchmark' }))).toBeNull();
  });

  it('U-PH8 a probe that was not needed counts as ready (status ready without a probe)', () => {
    expect(lightNotice(input({ reason: 'device-cpu', status: 'ready' }))).not.toBeNull();
  });

  it('U-PH8 the session flag gives null: once per session', () => {
    expect(lightNotice(input({}, { shown: true }))).toBeNull();
  });

  it('U-PH8 an unexpired dismiss record of the same variant gives null; the other variant or an expired one does not', () => {
    const loaded: DismissRecord = { variant: 'loaded', until: NOW + 1 };
    expect(lightNotice(input({}, { dismissed: loaded }))).toBeNull();
    expect(lightNotice(input({}, { dismissed: { ...loaded, until: NOW } }))).toEqual({
      variant: 'loaded',
    });
    expect(
      lightNotice(input({ reason: 'monitor', lastStep: step }, { dismissed: loaded })),
    ).toEqual({ variant: 'stepped' });
  });

  it('U-PH8 the dismiss record is parsed at the storage boundary', () => {
    expect(parseDismiss(JSON.stringify({ variant: 'stepped', until: 5 }))).toEqual({
      variant: 'stepped',
      until: 5,
    });
    for (const raw of [
      null,
      '',
      '{',
      '"x"',
      '{"variant":"other","until":5}',
      '{"variant":"loaded"}',
    ]) {
      expect(parseDismiss(raw)).toBeNull();
    }
  });

  it('U-PH8 «بستن» lasts 30 days, or as long as the light floor that caused it', () => {
    expect(dismissUntil('device-memory', NOW, null)).toBe(NOW + LIGHT_NOTICE_MS);
    expect(dismissUntil('light-floor', NOW, NOW + 7)).toBe(NOW + 7);
    expect(dismissUntil('light-floor', NOW, null)).toBe(NOW + LIGHT_NOTICE_MS);
    expect(dismissUntil('monitor', NOW, NOW + 7)).toBe(NOW + LIGHT_NOTICE_MS);
  });
});
