import { describe, expect, it } from 'vitest';

import {
  checkFetchOrigin,
  CLOCK_SKEW_MS,
  csrfFor,
  FORM_COOKIE,
  FORM_COOKIE_OPTIONS,
  isWellFormedSid,
  issueTimeToken,
  MIN_AGE_MS,
  newSid,
  renewTimeToken,
  verifyFormTokens,
} from './formTokens';

// Test secrets only (43 characters, like `openssl rand -base64 32` without padding).
const K = 'k'.repeat(43);
const K0 = 'p'.repeat(43);
const UNKNOWN = 'u'.repeat(43);
const SID = 'A'.repeat(21) + '_' + 'b'.repeat(20) + '-';
const OTHER_SID = 'Z'.repeat(43);
const ISSUED = Date.UTC(2026, 9, 13, 8, 0, 0);
const TTL_MS = 7200 * 1000;

const verify = (over: Partial<Parameters<typeof verifyFormTokens>[0]> = {}) =>
  verifyFormTokens({
    secrets: [K, K0],
    cookieSid: SID,
    csrf: csrfFor(K, SID),
    ts: issueTimeToken(K, SID, ISSUED),
    nowMs: ISSUED + 5000,
    ttlMs: TTL_MS,
    ...over,
  }).status;

// Table K of the utilities spec.
describe('formTokens table K', () => {
  it('K1 valid pair after 5 s', () => {
    expect(verify()).toBe('ok');
  });

  it('K2 faster than 2 s is too-fast', () => {
    expect(verify({ nowMs: ISSUED + 1999 })).toBe('too-fast');
  });

  it('K3 boundary at 2 s is ok', () => {
    expect(verify({ nowMs: ISSUED + 2000 })).toBe('ok');
  });

  it('K4 one ms past the TTL is expired', () => {
    expect(verify({ nowMs: ISSUED + 7_200_001 })).toBe('expired');
  });

  it('K5 exactly the TTL is ok', () => {
    expect(verify({ nowMs: ISSUED + 7_200_000 })).toBe('ok');
  });

  it('K6 csrf computed for another sid', () => {
    expect(verify({ csrf: csrfFor(K, OTHER_SID) })).toBe('invalid');
  });

  it('K7 cookie missing, fields present', () => {
    expect(verify({ cookieSid: undefined })).toBe('invalid');
    expect(verify({ cookieSid: 'short' })).toBe('invalid');
  });

  it('K8 issue time edited in ts, MAC unchanged', () => {
    const ts = issueTimeToken(K, SID, ISSUED);
    const [, t36, signature] = ts.split('.');
    const edited = `v1.${(Number.parseInt(t36 as string, 36) - 60_000).toString(36)}.${signature}`;
    expect(verify({ ts: edited })).toBe('invalid');
  });

  it('K9 ts issued 10 s in the future', () => {
    expect(verify({ ts: issueTimeToken(K, SID, ISSUED + 10_000), nowMs: ISSUED })).toBe('invalid');
  });

  it('K10 no-JS home form sends empty fields', () => {
    expect(verify({ csrf: '', ts: '' })).toBe('missing');
    expect(verify({ csrf: undefined, ts: undefined, cookieSid: undefined })).toBe('missing');
  });

  it('K11 pair signed with the previous secret during rotation', () => {
    expect(verify({ csrf: csrfFor(K0, SID), ts: issueTimeToken(K0, SID, ISSUED) })).toBe('ok');
  });

  it('K12 pair signed with an unknown secret', () => {
    expect(verify({ csrf: csrfFor(UNKNOWN, SID) })).toBe('invalid');
    expect(verify({ ts: issueTimeToken(UNKNOWN, SID, ISSUED) })).toBe('invalid');
  });

  it('K13 csrf one character short is invalid without a throw', () => {
    expect(verify({ csrf: csrfFor(K, SID).slice(0, -1) })).toBe('invalid');
    const ts = issueTimeToken(K, SID, ISSUED);
    expect(verify({ ts: ts.slice(0, -1) })).toBe('invalid');
  });

  it('K14 ts signed for another sid', () => {
    expect(verify({ ts: issueTimeToken(K, OTHER_SID, ISSUED) })).toBe('invalid');
  });

  it('K15 csrf is deterministic per sid', () => {
    expect(csrfFor(K, SID)).toBe(csrfFor(K, SID));
    expect(csrfFor(K, SID)).not.toBe(csrfFor(K, OTHER_SID));
  });

  it('K16 renewal of an expired token, submitted immediately, is ok', () => {
    const old = issueTimeToken(K, SID, ISSUED);
    const now = ISSUED + TTL_MS + 60_000;
    const ts = renewTimeToken({
      secrets: [K, K0],
      sid: SID,
      oldTs: old,
      nowMs: now,
      ttlMs: TTL_MS,
    });
    expect(verify({ ts, nowMs: now })).toBe('ok');
  });

  it('K17 renewal of a 60 s old token cannot skip the 2 s trap', () => {
    const old = issueTimeToken(K, SID, ISSUED);
    const now = ISSUED + 60_000;
    const ts = renewTimeToken({
      secrets: [K, K0],
      sid: SID,
      oldTs: old,
      nowMs: now,
      ttlMs: TTL_MS,
    });
    expect(verify({ ts, nowMs: now })).toBe('too-fast');
  });

  it('K18 origin check', () => {
    const base = 'https://sefiddental.ir';
    const check = (secFetchSite: string | null, origin: string | null) =>
      checkFetchOrigin({ secFetchSite, origin, baseOrigin: base });
    expect([
      check('cross-site', null),
      check('same-site', null),
      check('same-origin', null),
      check(null, 'https://evil.example'),
      check(null, base),
      check(null, null),
    ]).toEqual(['reject', 'reject', 'pass', 'reject', 'pass', 'pass']);
  });

  it('K19 newSid is 43 base64url characters', () => {
    const sid = newSid();
    expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(isWellFormedSid(sid)).toBe(true);
    expect(newSid()).not.toBe(sid);
  });

  it('K20 time token matches the hidden-field shape', () => {
    expect(issueTimeToken(K, SID, ISSUED)).toMatch(/^v1\.[0-9a-z]{1,11}\.[A-Za-z0-9_-]{43}$/);
  });
});

describe('formTokens rules', () => {
  it('K-RENEW a forged or foreign renew value gives a normal fresh token', () => {
    const now = ISSUED + TTL_MS + 60_000;
    for (const oldTs of [
      undefined,
      '',
      'v1.abc.xyz',
      issueTimeToken(UNKNOWN, SID, ISSUED),
      issueTimeToken(K, OTHER_SID, ISSUED),
    ]) {
      const ts = renewTimeToken({ secrets: [K], sid: SID, oldTs, nowMs: now, ttlMs: TTL_MS });
      expect(verify({ ts, nowMs: now })).toBe('too-fast');
    }
  });

  it('K-RENEW-SECRET renewal signs with the current secret and accepts an old token under K0', () => {
    const old = issueTimeToken(K0, SID, ISSUED);
    const now = ISSUED + TTL_MS + 1;
    const ts = renewTimeToken({
      secrets: [K, K0],
      sid: SID,
      oldTs: old,
      nowMs: now,
      ttlMs: TTL_MS,
    });
    expect(ts).toBe(issueTimeToken(K, SID, now, { preAgedMs: MIN_AGE_MS }));
  });

  it('K-SKEW a token up to 5 s in the future counts as too fast, not invalid', () => {
    const ts = issueTimeToken(K, SID, ISSUED + CLOCK_SKEW_MS);
    expect(
      verifyFormTokens({ secrets: [K], cookieSid: SID, csrf: csrfFor(K, SID), ts, nowMs: ISSUED }),
    ).toEqual({
      status: 'too-fast',
      ageMs: -CLOCK_SKEW_MS,
    });
  });

  it('K-HALF only one of the two fields present is invalid', () => {
    expect(verify({ csrf: '' })).toBe('invalid');
    expect(verify({ ts: undefined })).toBe('invalid');
  });

  it('K-SECRETS no configured secret fails loud', () => {
    expect(() => verify({ secrets: [] })).toThrow(/no form token secret/);
    expect(() => verify({ secrets: [''] })).toThrow(/no form token secret/);
    expect(() =>
      renewTimeToken({ secrets: [], sid: SID, oldTs: undefined, nowMs: ISSUED }),
    ).toThrow(/no form token secret/);
  });

  it('K-ISSUE a negative or fractional issue time fails loud', () => {
    expect(() => issueTimeToken(K, SID, 1000, { preAgedMs: 2000 })).toThrow(RangeError);
    expect(() => issueTimeToken(K, SID, 1.5)).toThrow(RangeError);
  });

  it('K-LABELS csrf and time MACs never collide', () => {
    const ts = issueTimeToken(K, SID, ISSUED);
    expect(ts.split('.')[2]).not.toBe(csrfFor(K, SID));
  });

  it('K-COOKIE cookie name and attributes', () => {
    expect(FORM_COOKIE).toBe('__Host-sefid-form');
    expect(FORM_COOKIE_OPTIONS).toEqual({
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400,
    });
  });

  it('K-SID isWellFormedSid rejects other shapes', () => {
    for (const bad of [
      undefined,
      '',
      'a'.repeat(42),
      'a'.repeat(44),
      `${'a'.repeat(42)}=`,
      `${'a'.repeat(42)}+`,
    ]) {
      expect(isWellFormedSid(bad)).toBe(false);
    }
  });

  it('K-ORIGIN fetch metadata wins; Origin "null" and other ports are rejected', () => {
    const baseOrigin = 'https://sefiddental.ir';
    expect(checkFetchOrigin({ secFetchSite: 'none', origin: null, baseOrigin })).toBe('pass');
    expect(checkFetchOrigin({ secFetchSite: 'Same-Origin', origin: null, baseOrigin })).toBe(
      'pass',
    );
    expect(checkFetchOrigin({ secFetchSite: null, origin: 'null', baseOrigin })).toBe('reject');
    expect(checkFetchOrigin({ secFetchSite: null, origin: `${baseOrigin}:8443`, baseOrigin })).toBe(
      'reject',
    );
  });
});
