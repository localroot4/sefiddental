import { createHmac, randomBytes } from 'node:crypto';
import { isIPv6 } from 'node:net';

import type { ServerEnv } from '@/lib/env';

/** Random per process: rate-limit keys are never comparable across restarts or stored. */
const PROCESS_SALT = randomBytes(32);

const IPV4 = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+(?:%[0-9a-z]+)?$|^[0-9a-f:]+:(?:\d{1,3}\.){3}\d{1,3}$/;

/** Strips `[v6]:port` and `v4:port`; returns the lowercase address or null when it is not an IP. */
function normalizeIp(token: string): string | null {
  let value = token.trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(value);
  if (bracketed?.[1]) value = bracketed[1];
  else if (/^[\d.]+:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(':'));
  if (IPV4.test(value)) return value;
  if (value.includes(':') && IPV6.test(value) && value.split(':').length <= 9) return value;
  return null;
}

/**
 * Client address for rate limits (decision 40, critic W10). Only behind a trusted proxy, and
 * only the hop the trusted proxies appended: the N-th entry from the right of X-Forwarded-For,
 * N = TRUSTED_PROXY_HOPS. Entries further left are whatever the client sent. Fewer entries than
 * N means the chain is not the expected one: null, so the caller uses the shared bucket.
 */
export function clientIpFrom(
  headers: Headers,
  env: Pick<ServerEnv, 'trustProxyHeaders' | 'trustedProxyHops'>,
): string | null {
  if (!env.trustProxyHeaders) return null;
  const header = headers.get('x-forwarded-for');
  if (!header) return null;
  const hops = header
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop !== '');
  const hop = hops[hops.length - env.trustedProxyHops];
  return hop === undefined ? null : normalizeIp(hop);
}

/**
 * The subject a limit counts: IPv4 as it is, IPv4-mapped IPv6 as its IPv4, any other IPv6 as its
 * /64. One subscriber or VPS holds a whole /64, so per-address buckets let one host rotate
 * addresses past every limit (SF-1); the canonical form also merges spellings of one address.
 */
export function limitSubject(ip: string): string {
  const address = ip.split('%')[0] ?? ip;
  if (!isIPv6(address)) return ip;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address);
  if (mapped?.[1]) return mapped[1];
  const [head = '', tail = ''] = address.split('::');
  const groups = (part: string) => (part ? part.split(':') : []);
  // A trailing dotted quad fills two groups.
  const width = (parts: string[]) => parts.reduce((n, g) => n + (g.includes('.') ? 2 : 1), 0);
  const h = groups(head);
  const t = groups(tail);
  const full = address.includes('::')
    ? [...h, ...Array<string>(8 - width(h) - width(t)).fill('0'), ...t]
    : h;
  return `${full
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(':')}::/64`;
}

/** In-memory bucket key: HMAC of the limit subject with the process salt, 16 bytes hex, or 'unknown'. */
export function rateLimitKey(ip: string | null): string {
  if (ip === null) return 'unknown';
  return createHmac('sha256', PROCESS_SALT).update(limitSubject(ip)).digest('hex').slice(0, 32);
}

/** Stored hash of an address's limit subject (bookings, audit-log): HMAC-SHA256 with IP_HASH_SECRET. */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(limitSubject(ip)).digest('hex');
}
