import { describe, expect, it } from 'vitest';

import { clientIpFrom, hashIp, limitSubject, rateLimitKey } from '@/lib/http/clientIp';

const trusted = (hops = 1) => ({ trustProxyHeaders: true, trustedProxyHops: hops });
const xff = (value: string) => new Headers({ 'x-forwarded-for': value });

describe('clientIpFrom (decision 40, critic W10)', () => {
  it('I1 untrusted: never reads the header', () => {
    expect(
      clientIpFrom(xff('203.0.113.7'), { trustProxyHeaders: false, trustedProxyHops: 1 }),
    ).toBeNull();
  });

  it('I2 takes the hop the trusted proxy appended, not the forged leftmost one', () => {
    expect(clientIpFrom(xff('1.1.1.1, 203.0.113.7'), trusted())).toBe('203.0.113.7');
    expect(clientIpFrom(xff('9.9.9.9, 8.8.8.8, 203.0.113.7'), trusted())).toBe('203.0.113.7');
  });

  it('I3 with two trusted proxies takes the second entry from the right', () => {
    expect(clientIpFrom(xff('1.1.1.1, 203.0.113.7, 10.0.0.2'), trusted(2))).toBe('203.0.113.7');
  });

  it('I4 a chain shorter than the trusted hops is not trusted', () => {
    expect(clientIpFrom(xff('203.0.113.7'), trusted(2))).toBeNull();
    expect(clientIpFrom(new Headers(), trusted())).toBeNull();
  });

  it('I5 normalizes ports, brackets and case; rejects non-addresses', () => {
    expect(clientIpFrom(xff('203.0.113.7:51234'), trusted())).toBe('203.0.113.7');
    expect(clientIpFrom(xff('[2001:DB8::1]:443'), trusted())).toBe('2001:db8::1');
    expect(clientIpFrom(xff('2001:db8::1'), trusted())).toBe('2001:db8::1');
    expect(clientIpFrom(xff('unknown'), trusted())).toBeNull();
    expect(clientIpFrom(xff('999.1.1.1'), trusted())).toBeNull();
    expect(clientIpFrom(xff('<script>'), trusted())).toBeNull();
  });
});

describe('rateLimitKey and hashIp', () => {
  it('K1 unknown address shares one bucket', () => {
    expect(rateLimitKey(null)).toBe('unknown');
  });

  it('K2 bucket key is a 16-byte HMAC, stable within the process, never the address', () => {
    const key = rateLimitKey('203.0.113.7');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).toBe(rateLimitKey('203.0.113.7'));
    expect(key).not.toBe(rateLimitKey('203.0.113.8'));
    expect(key).not.toContain('203');
  });

  it('K3 hashIp is HMAC-SHA256 hex with the given secret', () => {
    const a = hashIp('203.0.113.7', 'secret-a');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(hashIp('203.0.113.7', 'secret-a'));
    expect(a).not.toBe(hashIp('203.0.113.7', 'secret-b'));
  });

  it('K4 one IPv6 /64 is one subject: rotating the interface id never gets a new bucket (SF-1)', () => {
    expect(rateLimitKey('2001:db8:1:2::1')).toBe(rateLimitKey('2001:db8:1:2:ffff:1:2:3'));
    expect(hashIp('2001:db8:1:2::1', 's')).toBe(hashIp('2001:db8:1:2::abcd', 's'));
    expect(limitSubject('2001:db8:1:2:ffff:1:2:3')).toBe('2001:db8:1:2::/64');
  });

  it('K5 another /64 is another subject', () => {
    expect(rateLimitKey('2001:db8:1:3::1')).not.toBe(rateLimitKey('2001:db8:1:2::1'));
  });

  it('K6 spellings of one address are one subject; IPv4 stays as it is', () => {
    expect(limitSubject('2001:0db8::1')).toBe(limitSubject('2001:db8:0:0:0:0:0:1'));
    expect(limitSubject('::ffff:203.0.113.9')).toBe('203.0.113.9');
    expect(rateLimitKey('::ffff:203.0.113.9')).toBe(rateLimitKey('203.0.113.9'));
    expect(limitSubject('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(limitSubject('1::2:3:4:5:1.2.3.4')).toBe('1:0:2:3::/64');
    expect(limitSubject('203.0.113.7')).toBe('203.0.113.7');
  });
});
