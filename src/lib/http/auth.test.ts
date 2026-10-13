import { describe, expect, it } from 'vitest';

import { bearerToken, isCronCaller, isInternalCaller, secretMatches } from '@/lib/http/auth';

const TOKEN = 'i'.repeat(48);

describe('internal and cron guards (spec 10.2, 11.3)', () => {
  it('AU1 secretMatches: exact match only; empty never matches', () => {
    expect(secretMatches(TOKEN, TOKEN)).toBe(true);
    expect(secretMatches(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(secretMatches(TOKEN.slice(1), TOKEN)).toBe(false);
    expect(secretMatches('', '')).toBe(false);
    expect(secretMatches(null, TOKEN)).toBe(false);
    expect(secretMatches(TOKEN, '')).toBe(false);
  });

  it('AU2 bearer token parsing', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer   abc ')).toBe('abc');
    expect(bearerToken('Basic abc')).toBeNull();
    expect(bearerToken('Bearer a b')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it('AU3 header guards', () => {
    expect(isInternalCaller(new Headers({ 'x-internal-token': TOKEN }), TOKEN)).toBe(true);
    expect(isInternalCaller(new Headers(), TOKEN)).toBe(false);
    expect(isCronCaller(new Headers({ authorization: `Bearer ${TOKEN}` }), TOKEN)).toBe(true);
    expect(isCronCaller(new Headers({ authorization: `Bearer wrong` }), TOKEN)).toBe(false);
  });
});
