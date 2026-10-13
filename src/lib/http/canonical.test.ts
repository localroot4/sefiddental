import { describe, expect, it } from 'vitest';

import { canonicalRedirect, requestProtocol } from '@/lib/http/canonical';
import { classifyPath } from '@/lib/http/classify';
import { testEnv } from '@/lib/http/testEnv';

const KHADAMAT = '%D8%AE%D8%AF%D9%85%D8%A7%D8%AA';

function redirect(
  href: string,
  opts: { proto?: string; host?: string; trust?: boolean; env?: Record<string, string> } = {},
) {
  const url = new URL(href);
  const headers = new Headers({ host: opts.host ?? url.host });
  if (opts.proto) headers.set('x-forwarded-proto', opts.proto);
  const env = testEnv({ TRUST_PROXY_HEADERS: String(opts.trust ?? true), ...opts.env });
  return canonicalRedirect({ url, headers, env, kind: classifyPath(url.pathname) })?.href ?? null;
}

describe('canonicalRedirect (spec 6.3)', () => {
  it('X3 http to https on a trusted X-Forwarded-Proto', () => {
    expect(redirect('http://sefiddental.ir/خدمات', { proto: 'http' })).toBe(
      `https://sefiddental.ir/${KHADAMAT}`,
    );
  });

  it('X4 www to apex keeps the query', () => {
    expect(redirect('https://www.sefiddental.ir/خدمات?utm_source=t', { proto: 'https' })).toBe(
      `https://sefiddental.ir/${KHADAMAT}?utm_source=t`,
    );
  });

  it('X5 protocol, host and trailing slash in one hop', () => {
    expect(redirect('http://www.sefiddental.ir/خدمات/', { proto: 'http' })).toBe(
      `https://sefiddental.ir/${KHADAMAT}`,
    );
  });

  it('X6 Arabic yeh and kaf become Persian', () => {
    const target = redirect('https://sefiddental.ir/خدمات/كامپوزيت-دندان', { proto: 'https' });
    expect(target).toBe(new URL('/خدمات/کامپوزیت-دندان', 'https://sefiddental.ir').href);
  });

  it('X7 canonical URLs and API paths do not redirect', () => {
    expect(redirect('https://sefiddental.ir/', { proto: 'https' })).toBeNull();
    expect(redirect('https://sefiddental.ir/api/health/', { proto: 'https' })).toBeNull();
    expect(redirect(`https://sefiddental.ir/${KHADAMAT}`, { proto: 'https' })).toBeNull();
  });

  it('X8 an untrusted X-Forwarded-Proto is ignored', () => {
    expect(redirect('http://sefiddental.ir/x', { proto: 'http', trust: false })).toBeNull();
  });

  it('X9 development never redirects', () => {
    expect(
      redirect('http://localhost:3000/x/', {
        env: { NODE_ENV: 'development', SITE_URL: 'http://localhost:3000' },
      }),
    ).toBeNull();
  });

  it('CR1 percent-encoding case alone never redirects', () => {
    expect(
      redirect(`https://sefiddental.ir/${KHADAMAT.toLowerCase()}`, { proto: 'https' }),
    ).toBeNull();
  });

  it('CR2 routed form: ASCII case, double slashes, encoded unreserved letters', () => {
    expect(redirect('https://sefiddental.ir/QA//Not-Found/', { proto: 'https' })).toBe(
      'https://sefiddental.ir/qa/not-found',
    );
    expect(redirect('https://sefiddental.ir/admin/', { proto: 'https' })).toBe(
      'https://sefiddental.ir/admin',
    );
    expect(redirect('https://sefiddental.ir/a%2Db', { proto: 'https' })).toBe(
      'https://sefiddental.ir/a-b',
    );
  });

  it('CR3 encoded delimiters and malformed escapes keep their spelling', () => {
    expect(redirect('https://sefiddental.ir/a%2Fb', { proto: 'https' })).toBeNull();
    expect(redirect('https://sefiddental.ir/a%3Fb', { proto: 'https' })).toBeNull();
    expect(redirect('https://sefiddental.ir/first%E0x', { proto: 'https' })).toBeNull();
    expect(redirect('http://sefiddental.ir/a%2Fb/', { proto: 'http' })).toBe(
      'https://sefiddental.ir/a%2Fb/',
    );
  });

  it('CR4 other hosts (IP, platform domain) are left alone', () => {
    expect(redirect('http://10.0.0.5:3000/x/', { proto: 'http' })).toBeNull();
    expect(redirect('https://sefid.example-paas.app/x/', { proto: 'https' })).toBeNull();
  });

  it('CR5 every target is a fixed point', () => {
    for (const href of [
      'http://www.sefiddental.ir/خدمات/كامپوزيت-دندان/?a=1',
      'https://sefiddental.ir/QA//Not-Found/',
      'https://sefiddental.ir/a%2Db%20c',
      'https://sefiddental.ir/[x]',
    ]) {
      const first = redirect(href, { proto: 'http' });
      expect(first, href).not.toBeNull();
      expect(redirect(first ?? '', { proto: 'https' }), `${href} -> ${first}`).toBeNull();
    }
  });

  it('CR6 without X-Forwarded-Proto behind a trusted proxy, the protocol never loops', () => {
    expect(redirect('http://sefiddental.ir/x')).toBeNull();
  });

  it('CR7 trusted X-Forwarded-Host wins over Host', () => {
    const url = new URL('http://localhost:3000/x/');
    const headers = new Headers({
      host: 'localhost:3000',
      'x-forwarded-host': 'www.sefiddental.ir',
      'x-forwarded-proto': 'https',
    });
    const target = canonicalRedirect({
      url,
      headers,
      env: testEnv({ TRUST_PROXY_HEADERS: 'true' }),
      kind: 'page',
    });
    expect(target?.href).toBe('https://sefiddental.ir/x');
  });
});

describe('requestProtocol', () => {
  it('P1 trusted last hop only', () => {
    const headers = new Headers({ 'x-forwarded-proto': 'http, https' });
    expect(requestProtocol(headers, true)).toBe('https');
    expect(requestProtocol(headers, false)).toBeNull();
    expect(requestProtocol(new Headers({ 'x-forwarded-proto': 'gopher' }), true)).toBeNull();
  });
});
