import { describe, expect, it } from 'vitest';

import { debugActive, parseExperienceQuery } from './query';

describe('parseExperienceQuery', () => {
  it('QP1 reads debug, tier, monitor and stress', () => {
    expect(parseExperienceQuery('?debug=1&tier=3&monitor=1&stress=4')).toEqual({
      debug: 'on',
      tier: 3,
      monitor: true,
      stress: 4,
    });
  });

  it('QP2 an empty query gives the defaults', () => {
    expect(parseExperienceQuery('')).toEqual({
      debug: null,
      tier: null,
      monitor: false,
      stress: 0,
    });
  });

  it('QP3 rejects out-of-range and non-ASCII values', () => {
    const q = parseExperienceQuery('?debug=yes&tier=4&monitor=true&stress=9');
    expect(q).toEqual({ debug: null, tier: null, monitor: false, stress: 0 });
    expect(parseExperienceQuery('?tier=۲').tier).toBeNull();
    expect(parseExperienceQuery('?tier=2.5').tier).toBeNull();
    expect(parseExperienceQuery('?stress=0').stress).toBe(0);
  });

  it('QP4 debug=0 is off', () => {
    expect(parseExperienceQuery('?debug=0').debug).toBe('off');
  });
});

describe('debugActive', () => {
  it('QP5 the parameter wins over the session flag', () => {
    expect(debugActive(parseExperienceQuery('?debug=1'), null)).toBe(true);
    expect(debugActive(parseExperienceQuery('?debug=0'), '1')).toBe(false);
  });

  it('QP6 without the parameter the session flag decides', () => {
    expect(debugActive(parseExperienceQuery(''), '1')).toBe(true);
    expect(debugActive(parseExperienceQuery(''), null)).toBe(false);
    expect(debugActive(parseExperienceQuery(''), 'x')).toBe(false);
  });
});
