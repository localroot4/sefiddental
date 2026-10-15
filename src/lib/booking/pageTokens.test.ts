import { describe, expect, it } from 'vitest';

import { issueTimeToken, verifyFormTokens } from '@/lib/formTokens';

import { pageFormTokens } from './pageTokens';

const K = 'k'.repeat(43);
const SID = 'S'.repeat(43);
const NOW = Date.parse('2026-10-13T08:00:00Z');
const TTL = 7200_000;

const verify = (tokens: { csrf: string; ts: string }, nowMs: number) =>
  verifyFormTokens({ secrets: [K], cookieSid: SID, ...tokens, nowMs, ttlMs: TTL }).status;

describe('pageFormTokens (no-JS booking and emergency pages)', () => {
  it('PT1 fresh tokens for the sid: too fast at once, ok after 2 s', () => {
    const tokens = pageFormTokens({ sid: SID, secrets: [K], nowMs: NOW, ttlMs: TTL });
    expect(tokens).not.toBeNull();
    expect(verify(tokens!, NOW + 1000)).toBe('too-fast');
    expect(verify(tokens!, NOW + 2000)).toBe('ok');
  });

  it('PT2 after a 419 the renewed token is pre-aged; a token that is not expired is not', () => {
    const expired = issueTimeToken(K, SID, NOW - TTL - 1);
    const renewed = pageFormTokens({
      sid: SID,
      secrets: [K],
      nowMs: NOW,
      ttlMs: TTL,
      renewTs: expired,
    });
    expect(verify(renewed!, NOW)).toBe('ok');
    const young = issueTimeToken(K, SID, NOW - 1000);
    const fresh = pageFormTokens({
      sid: SID,
      secrets: [K],
      nowMs: NOW,
      ttlMs: TTL,
      renewTs: young,
    });
    expect(verify(fresh!, NOW)).toBe('too-fast');
  });

  it('PT3 no tokens without a well-formed sid', () => {
    expect(pageFormTokens({ sid: null, secrets: [K], nowMs: NOW, ttlMs: TTL })).toBeNull();
    expect(pageFormTokens({ sid: 'short', secrets: [K], nowMs: NOW, ttlMs: TTL })).toBeNull();
  });
});
