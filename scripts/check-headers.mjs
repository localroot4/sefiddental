// Security headers, CSP and cookie flags of a running site (docs/qa/audit-security.md, section
// 1). The e2e suite checks the standalone build (tests/e2e/http/headers.spec.ts); this checks a
// deployed origin through nginx, from the workflow "Headers" (no secrets, read-only):
//   node scripts/check-headers.mjs https://new.sefiddental.ir
// No dependencies: Node's fetch only, so the workflow runs it without npm ci.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const STATIC = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy':
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
};
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

const directive = (csp, name) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d === name || d.startsWith(`${name} `)) ?? null;

/**
 * Problems of one response, as lines. `kind`: 'page' (public HTML), 'admin' (admin HTML), 'api'.
 * `headers` is a Headers object; `cookies` the Set-Cookie lines; `expect` the cookie names the
 * response must set; `https` whether the origin is.
 * @param {'page' | 'admin' | 'api'} kind
 * @param {Headers} headers
 * @param {{ https?: boolean, cookies?: string[], expect?: string[] }} [options]
 * @returns {string[]}
 */
export function headerProblems(kind, headers, { https = true, cookies = [], expect = [] } = {}) {
  const out = [];
  for (const [name, value] of Object.entries(STATIC)) {
    if (name === 'strict-transport-security' && !https) continue;
    if (headers.get(name) !== value) out.push(`${name} is "${headers.get(name)}", want "${value}"`);
  }
  if (headers.has('x-powered-by')) out.push('x-powered-by is sent');
  for (const [name] of headers) {
    if (name.startsWith('x-middleware-')) out.push(`${name} passes the proxy`);
  }
  if (headers.has('content-security-policy-report-only')) out.push('the CSP is report-only');
  const csp = headers.get('content-security-policy') ?? '';
  if (kind === 'api') {
    if (csp !== API_CSP) out.push(`API CSP is "${csp}"`);
  } else {
    const script = directive(csp, 'script-src') ?? '';
    const style = directive(csp, 'style-src') ?? '';
    if (!/'nonce-[A-Za-z0-9+/_=-]+'/.test(script)) out.push('script-src has no nonce');
    if (!script.includes("'strict-dynamic'")) out.push("script-src lacks 'strict-dynamic'");
    if (/'unsafe-(inline|eval|hashes)'/.test(script)) out.push(`unsafe script-src: ${script}`);
    // The admin keeps style 'unsafe-inline': Payload injects runtime styles without a nonce.
    if (kind === 'page' && /'unsafe-/.test(style)) out.push(`unsafe style-src: ${style}`);
    if (directive(csp, 'object-src') !== "object-src 'none'") out.push("object-src is not 'none'");
    if (directive(csp, 'base-uri') !== "base-uri 'none'") out.push("base-uri is not 'none'");
    if (directive(csp, 'frame-ancestors') !== "frame-ancestors 'none'") {
      out.push("frame-ancestors is not 'none'");
    }
    if (https && !directive(csp, 'upgrade-insecure-requests')) {
      out.push('upgrade-insecure-requests is missing');
    }
    if (headers.get('cross-origin-opener-policy') !== 'same-origin')
      out.push('COOP is not same-origin');
  }
  if (headers.get('x-frame-options') !== 'DENY') out.push('X-Frame-Options is not DENY');
  if (kind === 'admin' && headers.get('x-robots-tag') !== 'noindex, nofollow') {
    out.push('admin X-Robots-Tag is not "noindex, nofollow"');
  }
  const names = cookies.map((line) => line.split('=')[0]?.trim());
  for (const name of expect) if (!names.includes(name)) out.push(`cookie ${name} is not set`);
  for (const line of cookies) {
    const [pair = '', ...attrs] = line.split(';').map((a) => a.trim().toLowerCase());
    const name = pair.split('=')[0];
    const has = (a) => attrs.some((x) => x === a || x.startsWith(`${a}=`));
    if (!has('httponly')) out.push(`cookie ${name} lacks HttpOnly`);
    if (https && !has('secure')) out.push(`cookie ${name} lacks Secure`);
    if (!attrs.some((a) => /^samesite=(lax|strict)$/.test(a))) {
      out.push(`cookie ${name} lacks SameSite=Lax or Strict`);
    }
  }
  return out;
}

/**
 * The checked paths and the cookies each must set: the home page, the booking page (its form
 * cookie), the admin sign-in page, the API. The session cookies are set only by a sign-in POST,
 * which needs an account: the e2e suite checks them (docs/qa/audit-security.md section 6).
 * @type {Array<['page' | 'admin' | 'api', string, string[]]>}
 */
export const CHECKS = [
  ['page', '/', []],
  ['page', '/رزرو-نوبت', ['__Host-sefid-form']],
  ['admin', '/giris/login', []],
  ['api', '/api/health', []],
];

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const origin = new URL(process.argv[2] ?? '').origin;
  const https = origin.startsWith('https:');
  let failed = 0;
  for (const [kind, route, expect] of CHECKS) {
    const response = await fetch(new URL(route, origin), { redirect: 'manual' });
    const problems = headerProblems(kind, response.headers, {
      https,
      cookies: response.headers.getSetCookie(),
      expect,
    });
    if (response.status !== 200) problems.unshift(`status ${response.status}, want 200`);
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${kind} ${route}`);
    for (const line of problems) console.log(`     ${line}`);
    failed += problems.length;
  }
  // A nonce must be new on every response: a cache in front of nginx would hand out one nonce.
  const nonce = async () =>
    /'nonce-([^']+)'/.exec((await fetch(origin)).headers.get('content-security-policy') ?? '')?.[1];
  const [first, second] = [await nonce(), await nonce()];
  if (!first || first === second) {
    console.log('FAIL page / answers the same CSP nonce twice (a cache in front of the app?)');
    failed += 1;
  }
  if (failed > 0) {
    console.error(`check-headers: ${failed} problem(s) on ${origin}`);
    process.exit(1);
  }
  console.log(`check-headers: ${origin} passes`);
}
