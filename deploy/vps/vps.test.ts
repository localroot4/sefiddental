import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// The server scripts of deploy/vps, run without a server: systemctl, journalctl and curl are
// stubs, and SEFID_ROOT / SEFID_ETC point at a temporary folder.
const DIR = import.meta.dirname;
const SBIN = path.join(DIR, 'files/usr/local/sbin');
const tmp = () => mkdtempSync(path.join(tmpdir(), 'sefid-vps-'));

function run(
  cmd: string,
  args: string[],
  env: Record<string, string> = {},
  input?: string,
): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, {
    cwd: DIR,
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
    timeout: 60_000,
  });
}
/** Source provision.sh (main does not run when sourced) and run SCRIPT after it. */
const provision = (script: string, env: Record<string, string> = {}) =>
  run('bash', ['-c', `set -Eeuo pipefail; . ./provision.sh; ${script}`], env);
const ok = (cmd: string, args: string[]) => run(cmd, args).status === 0;

const SHELL_FILES = [
  'provision.sh',
  'server.env',
  'files/usr/local/lib/sefid/common.sh',
  ...readdirSync(SBIN).map((f) => `files/usr/local/sbin/${f}`),
];
const shellcheck = process.env.SHELLCHECK ?? 'shellcheck';
const hasShellcheck = ok(shellcheck, ['--version']);
const hasNginx = ok('nginx', ['-v']);
// sefid-release checks tarballs with the tarfile data filter of Python 3.12.
const hasPython312 = ok('python3', ['-c', 'import tarfile; tarfile.data_filter']);

describe('deploy/vps shell files', { timeout: 60_000 }, () => {
  it('VPS1 every shell file passes bash -n', () => {
    for (const file of SHELL_FILES) {
      const r = run('bash', ['-n', file]);
      expect(r.stderr, file).toBe('');
      expect(r.status, file).toBe(0);
    }
    expect(
      run('sh', ['-n', 'files/etc/letsencrypt/renewal-hooks/deploy/sefid-nginx-reload']).status,
    ).toBe(0);
  });

  it.skipIf(!hasShellcheck)('VPS2 shellcheck finds nothing', () => {
    const r = run(shellcheck, [
      '-x',
      ...SHELL_FILES,
      'files/etc/letsencrypt/renewal-hooks/deploy/sefid-nginx-reload',
    ]);
    expect(r.stdout + r.stderr).toBe('');
    expect(r.status).toBe(0);
  });
});

describe('server.env', () => {
  const read = (file: string) =>
    run('bash', ['-c', `set -eu; . "${file}"; echo "$SITE_URL|$DOMAINS|$ALLOW_INDEXING"`]);

  it('VPS3 the phase is one line: preview now, live after the switch', () => {
    expect(read('./server.env').stdout.trim()).toBe(
      'https://new.sefiddental.ir|new.sefiddental.ir|false',
    );
    const text = readFileSync(path.join(DIR, 'server.env'), 'utf8');
    expect(text.match(/^PHASE=preview$/gm)).toHaveLength(1);
    const dir = tmp();
    writeFileSync(`${dir}/live.env`, text.replace(/^PHASE=preview$/m, 'PHASE=live'));
    expect(read(`${dir}/live.env`).stdout.trim()).toBe(
      'https://sefiddental.ir|sefiddental.ir www.sefiddental.ir|true',
    );
    writeFileSync(`${dir}/typo.env`, text.replace(/^PHASE=preview$/m, 'PHASE=lvie'));
    const typo = read(`${dir}/typo.env`);
    expect(typo.status).not.toBe(0);
    expect(typo.stderr).toContain('PHASE must be preview or live');
    // provision.sh accepts both phases.
    expect(provision(`load_config ./server.env`).status).toBe(0);
    expect(provision(`load_config "${dir}/live.env"`).status).toBe(0);
  });

  it('VPS4 provision refuses a first domain that is not the SITE_URL host', () => {
    const dir = tmp();
    const text = readFileSync(path.join(DIR, 'server.env'), 'utf8');
    writeFileSync(`${dir}/bad.env`, `${text}\nDOMAINS="www.sefiddental.ir"\n`);
    const r = provision(`load_config "${dir}/bad.env"`);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('the first name in DOMAINS must be the SITE_URL host');
  });
});

describe('provision.sh helpers', { timeout: 30_000 }, () => {
  const env = (text: string) =>
    Object.fromEntries(
      text
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
    );
  const SECRETS = [
    'PAYLOAD_SECRET',
    'CRON_SECRET',
    'INTERNAL_API_TOKEN',
    'IP_HASH_SECRET',
    'FORM_TOKEN_SECRET',
  ];

  it('VPS5 app.env: secrets generated once and kept, managed names rewritten, others kept', () => {
    const dir = tmp();
    const render = (old: string) =>
      provision(`load_config ./server.env; render_app_env "${old}" http://127.0.0.1:3000`);
    const first = render(`${dir}/missing`);
    expect(first.status).toBe(0);
    const a = env(first.stdout);
    expect(a).toMatchObject({
      SITE_URL: 'https://new.sefiddental.ir',
      ALLOW_INDEXING: 'false',
      MEDIA_DIR: '/var/lib/sefid/media',
      DB_PUSH: 'false',
      TRUST_PROXY_HEADERS: 'true',
      TRUSTED_PROXY_HOPS: '1',
      NODE_OPTIONS: '--max-old-space-size=768',
      HOSTNAME: 'localhost',
      PORT: '3000',
      INTERNAL_ORIGIN: 'http://127.0.0.1:3000',
      MAINTENANCE_MODE: 'off',
    });
    for (const name of SECRETS) expect(a[name]!.length).toBeGreaterThanOrEqual(43);
    expect(new Set(SECRETS.map((n) => a[n])).size).toBe(SECRETS.length);
    expect(a.DATABASE_URL).toMatch(/^postgres:\/\/sefid:[0-9a-f]{64}@127\.0\.0\.1:5432\/sefid$/);

    // A later run: SITE_URL comes from server.env again; secrets, maintenance and extras stay.
    const old = first.stdout
      .replace('SITE_URL=https://new.sefiddental.ir', 'SITE_URL=https://stale.example')
      .replace('MAINTENANCE_MODE=off', 'MAINTENANCE_MODE=on');
    writeFileSync(`${dir}/app.env`, `${old}SMTP_HOST=smtp.example.com\n`);
    const second = render(`${dir}/app.env`);
    const b = env(second.stdout);
    for (const name of [...SECRETS, 'DATABASE_URL']) expect(b[name]).toBe(a[name]);
    expect(b).toMatchObject({
      SITE_URL: 'https://new.sefiddental.ir',
      MAINTENANCE_MODE: 'on',
      SMTP_HOST: 'smtp.example.com',
    });
    // Every name once.
    const names = second.stdout.split('\n').filter((l) => /^[A-Z_]+=/.test(l));
    expect(new Set(names.map((l) => l.split('=')[0])).size).toBe(names.length);
    // A third run changes nothing.
    writeFileSync(`${dir}/app.env`, second.stdout);
    expect(render(`${dir}/app.env`).stdout).toBe(second.stdout);
  });

  it('VPS6 loopback settings follow what localhost resolves to', () => {
    expect(provision('loopback 127.0.0.1').stdout.split('\n')).toEqual([
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3000',
      '127.0.0.1:3000',
      '',
    ]);
    // Never [::1] as INTERNAL_ORIGIN or HOSTNAME (docs/deploy.md 2.3): use localhost.
    expect(provision('loopback ::1').stdout.split('\n')).toEqual([
      'http://[::1]:3000',
      'http://localhost:3000',
      '[::1]:3000',
      '',
    ]);
    const bad = provision('loopback 10.0.0.5');
    expect(bad.status).not.toBe(0);
    expect(bad.stderr).toContain('fix /etc/hosts');
  });

  const site = (version: string, ipv6: 'yes' | 'no', upstream = '127.0.0.1:3000') =>
    provision(
      `load_config ./server.env; render_site files/etc/nginx/sites-available/sefid.template ${version} ${ipv6} ${upstream}`,
    ).stdout;

  it('VPS7 the nginx site renders for old and new nginx, with and without IPv6', () => {
    const modern = site('1.28.3', 'yes');
    expect(modern).not.toMatch(/@[A-Z0-9_]+@/);
    expect(modern.match(/^\s*http2 on;$/gm)).toHaveLength(2);
    expect(modern).not.toMatch(/ssl http2/);
    expect(modern).toContain('listen [::]:443 ssl;');
    expect(modern).toContain('server_name new.sefiddental.ir;');
    expect(modern).toContain('return 301 https://new.sefiddental.ir$request_uri;');
    expect(modern).toContain('server 127.0.0.1:3000;');
    // Unknown TLS names get no certificate; access logs never hold a whole client address.
    expect(modern).toContain('ssl_reject_handshake on;');
    expect(modern.match(/^\s*ssl_certificate /gm)).toHaveLength(1);
    expect(modern).toMatch(/^log_format sefid '\$sefid_log_addr /m);
    expect(
      modern.match(/^\s*access_log \/var\/log\/nginx\/sefid\.access\.log sefid;$/gm),
    ).toHaveLength(2);

    const legacy = site('1.24.0', 'no', '[::1]:3000');
    expect(legacy).not.toMatch(/^\s*http2 on;$/m);
    expect(legacy).toContain('listen 443 ssl http2 default_server;');
    expect(legacy).not.toContain('[::]:');
    expect(legacy).toContain('server [::1]:3000;');
  });

  // nginx -t on the rendered site, inside an http block like Ubuntu's (which sets ssl_protocols
  // at http level). High ports: nginx -t opens the listening sockets.
  it.skipIf(!hasNginx)('VPS8 nginx -t accepts the rendered site', () => {
    const dir = tmp();
    const version = /nginx\/([\d.]+)/.exec(run('nginx', ['-v']).stderr)![1]!;
    const ipv6 = existsSync('/proc/net/if_inet6') ? 'yes' : 'no';
    run('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-subj',
      '/CN=test',
      '-days',
      '1',
      '-keyout',
      `${dir}/key.pem`,
      '-out',
      `${dir}/cert.pem`,
    ]);
    const rendered = site(version, ipv6)
      .replaceAll('snippets/', `${DIR}/files/etc/nginx/snippets/`)
      .replace(
        /\/etc\/sefid\/tls\/fullchain\.pem|\/etc\/ssl\/certs\/ssl-cert-snakeoil\.pem/g,
        `${dir}/cert.pem`,
      )
      .replace(
        /\/etc\/sefid\/tls\/privkey\.pem|\/etc\/ssl\/private\/ssl-cert-snakeoil\.key/g,
        `${dir}/key.pem`,
      )
      .replaceAll('/var/log/nginx/', `${dir}/`)
      .replace(/listen (\[::\]:)?(80|443)\b/g, (_, v6 = '', port) => `listen ${v6}1${port}0`);
    writeFileSync(`${dir}/site.conf`, rendered);
    writeFileSync(
      `${dir}/nginx.conf`,
      `pid ${dir}/nginx.pid;\nerror_log ${dir}/error.log;\nevents {}\nhttp {\n` +
        `  ssl_protocols TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;\n  ssl_prefer_server_ciphers on;\n` +
        `  access_log ${dir}/access.log;\n  include ${dir}/site.conf;\n}\n`,
    );
    const r = run('nginx', ['-t', '-p', dir, '-c', `${dir}/nginx.conf`]);
    expect(r.stderr).toContain('test is successful');
  });
});

/** A temporary server: root and etc folders, stub commands, and tarball builders. */
function fakeServer() {
  const dir = tmp();
  const root = `${dir}/srv`;
  const etc = `${dir}/etc`;
  const bin = `${dir}/bin`;
  for (const d of [`${root}/releases`, etc, bin]) mkdirSync(d, { recursive: true });
  writeFileSync(`${etc}/host.env`, 'SEFID_ORIGIN=http://127.0.0.1:3000\n');
  const stub = (name: string, body: string) => {
    writeFileSync(`${bin}/${name}`, `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(`${bin}/${name}`, 0o755);
  };
  // A broken release also fails its start, as systemctl reports a failed job.
  stub(
    'systemctl',
    `echo "systemctl $*" >> "${dir}/calls"
[ "$1" = restart ] && [ -e "$SEFID_ROOT/current/app/BROKEN" ] && exit 1
exit 0`,
  );
  stub('journalctl', 'echo "journal: Error: Cannot find module"');
  // The health endpoint of whatever release "current" points at.
  stub(
    'curl',
    `cur="$SEFID_ROOT/current"
if [ -e "$cur/app/BROKEN" ]; then echo "curl: (7) Failed to connect"; exit 7; fi
sha=$(sed -n 's/^GIT_SHA=//p' "$cur/release.env")
m=false; grep -q '^MAINTENANCE_MODE=on' "$SEFID_ETC/app.env" 2>/dev/null && m=true
printf '{"status":"ok","version":"%s","maintenance":%s}\\n200' "$sha" "$m"`,
  );
  const env = {
    SEFID_ROOT: root,
    SEFID_ETC: etc,
    // No waiting: the stub answers at once, or never.
    SEFID_HEALTH_TIMEOUT: '0',
    PATH: `${bin}:${process.env.PATH}`,
  };

  let seq = 0;
  type Member = { name: string; data?: string; mode?: number; link?: string };
  /** A release tarball; returns its path, sha256, release id and commit. */
  const tarball = (opts: { broken?: boolean; extra?: Member[]; idSha?: string } = {}) => {
    seq += 1;
    const sha = createHash('sha1').update(`commit-${seq}-${dir}`).digest('hex');
    const id = `20261026T10${String(seq).padStart(2, '0')}00Z-${(opts.idSha ?? sha).slice(0, 7)}`;
    const members: Member[] = [
      { name: 'app/server.js', data: 'console.log(1)' },
      { name: 'app/public/maintenance.html', data: '<p>maintenance</p>', mode: 0o600 },
      { name: 'node/bin/node', data: '#!/bin/sh\necho v22.18.0\n', mode: 0o755 },
      {
        name: 'release.json',
        data: JSON.stringify({ gitSha: sha, buildTime: '2026-10-26T10:00:00Z', node: 'v22.18.0' }),
      },
      ...(opts.broken ? [{ name: 'app/BROKEN', data: '' }] : []),
      ...(opts.extra ?? []),
    ];
    const out = `${dir}/r${seq}.tar.gz`;
    const r = run(
      'python3',
      [
        '-I',
        '-c',
        `import io, json, sys, tarfile
spec = json.load(sys.stdin)
with tarfile.open(spec["out"], "w:gz") as tar:
    for m in spec["members"]:
        info = tarfile.TarInfo(m["name"])
        if "link" in m:
            info.type, info.linkname = tarfile.SYMTYPE, m["link"]
            tar.addfile(info)
        else:
            data = m.get("data", "").encode()
            info.size, info.mode = len(data), m.get("mode", 0o644)
            tar.addfile(info, io.BytesIO(data))`,
      ],
      {},
      JSON.stringify({ out, members }),
    );
    expect(r.stderr).toBe('');
    const sum = createHash('sha256').update(readFileSync(out)).digest('hex');
    return { file: out, sum, id, sha };
  };
  const release = (...args: string[]) => run(`${SBIN}/sefid-release`, args, env);
  const target = (link: string) =>
    existsSync(`${root}/${link}`) ? path.basename(readlinkSync(`${root}/${link}`)) : null;
  const calls = () => (existsSync(`${dir}/calls`) ? readFileSync(`${dir}/calls`, 'utf8') : '');
  return { dir, root, etc, env, tarball, release, target, calls };
}

describe.skipIf(!hasPython312)('sefid-release', { timeout: 60_000 }, () => {
  it('VPS9 installs a release, writes release.env and switches current', () => {
    const s = fakeServer();
    const t = s.tarball();
    // The staging folder of a run that was killed: removed.
    mkdirSync(`${s.root}/releases/.incoming-20261026T090000Z-0000000/tree`, { recursive: true });
    const r = s.release(t.file, t.sum, t.id);
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(s.target('current')).toBe(t.id);
    expect(s.target('previous')).toBeNull();
    const rel = `${s.root}/releases/${t.id}`;
    expect(readFileSync(`${rel}/release.env`, 'utf8')).toBe(
      `GIT_SHA=${t.sha}\nBUILD_TIME=2026-10-26T10:00:00Z\n`,
    );
    // Readable by the app user, the runtime still executable, nothing writable by others.
    expect(statSync(`${rel}/app/public/maintenance.html`).mode & 0o777).toBe(0o644);
    expect(statSync(`${rel}/node/bin/node`).mode & 0o777).toBe(0o755);
    expect(s.calls()).toBe('systemctl restart sefid.service\n');
    expect(r.stdout).toContain(`"version":"${t.sha}"`);
    expect(r.stdout).toContain(`release ${t.id} is live`);
    // No staging folder left, this run's or a stale one; the upload stays where it was.
    expect(readdirSync(`${s.root}/releases`)).toEqual([t.id]);
    expect(r.stdout).toContain(
      'removed the stale staging folder .incoming-20261026T090000Z-0000000',
    );
    expect(existsSync(t.file)).toBe(true);
  });

  it('VPS10 refuses a wrong hash, a wrong release id and a commit that does not match', () => {
    const s = fakeServer();
    const t = s.tarball();
    const wrong = s.release(t.file, '0'.repeat(64), t.id);
    expect(wrong.status).not.toBe(0);
    expect(wrong.stderr).toContain(
      `sha256 mismatch: expected ${'0'.repeat(64)}, the file has ${t.sum}`,
    );
    expect(s.release(t.file, t.sum, 'latest').stderr).toContain('the release id must look like');
    const other = s.tarball({ idSha: 'abcdef1234' });
    expect(s.release(other.file, other.sum, other.id).stderr).toContain(
      `release id ${other.id} does not belong to commit ${other.sha}`,
    );
    expect(s.target('current')).toBeNull();
    expect(readdirSync(`${s.root}/releases`)).toEqual([]);
    expect(s.calls()).toBe('');
  });

  it.each([
    ['a parent path', { name: '../escaped', data: 'x' }],
    ['an absolute path', { name: '/tmp/sefid-vps-absolute', data: 'x' }],
    ['an absolute link', { name: 'app/passwd', link: '/etc/passwd' }],
    ['a link out of the folder', { name: 'app/up', link: '../../..' }],
  ])('VPS11 refuses a tarball with %s', (_label, member) => {
    const s = fakeServer();
    const t = s.tarball({ extra: [member] });
    const r = s.release(t.file, t.sum, t.id);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('ERROR: tarball refused');
    expect(existsSync(`${s.root}/escaped`)).toBe(false);
    expect(existsSync(`${s.root}/releases/escaped`)).toBe(false);
    expect(readdirSync(`${s.root}/releases`)).toEqual([]);
    expect(s.target('current')).toBeNull();
  });

  it('VPS12 a release that fails its health check is switched back, with the journal', () => {
    const s = fakeServer();
    const good = s.tarball();
    expect(s.release(good.file, good.sum, good.id).status).toBe(0);
    const bad = s.tarball({ broken: true });
    const r = s.release(bad.file, bad.sum, bad.id);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain(`release ${bad.id} failed its health check`);
    expect(r.stderr).toContain('journal: Error: Cannot find module');
    expect(r.stdout).toContain(`switching back to ${good.id}`);
    expect(s.target('current')).toBe(good.id);
    expect(s.target('previous')).toBeNull();
    expect(s.calls().match(/restart sefid.service/g)).toHaveLength(3);
  });

  it('VPS13 rollback switches to the previous release and back again', () => {
    const s = fakeServer();
    const a = s.tarball();
    const b = s.tarball();
    expect(s.release(a.file, a.sum, a.id).status).toBe(0);
    expect(s.release(b.file, b.sum, b.id).status).toBe(0);
    expect([s.target('current'), s.target('previous')]).toEqual([b.id, a.id]);
    const r = s.release('rollback');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`"version":"${a.sha}"`);
    expect([s.target('current'), s.target('previous')]).toEqual([a.id, b.id]);
    expect(s.release('rollback').status).toBe(0);
    expect([s.target('current'), s.target('previous')]).toEqual([b.id, a.id]);
    // The same release again only checks its health.
    const again = s.release(b.file, b.sum, b.id);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('already current');
  });

  it('VPS14 keeps the newest 5 releases and always current and previous', () => {
    const s = fakeServer();
    const install = (broken = false) => {
      const t = s.tarball({ broken });
      expect(s.release(t.file, t.sum, t.id).status).toBe(broken ? 1 : 0);
      return t.id;
    };
    const ids = Array.from({ length: 7 }, () => install());
    const releases = () => readdirSync(`${s.root}/releases`).sort();
    expect(releases()).toEqual(ids.slice(2));
    // Four failed releases, then a good one: the release that ran before it (ids[6]) is no
    // longer among the newest 5, and stays as previous.
    const failed = Array.from({ length: 4 }, () => install(true));
    const last = install();
    expect(s.target('previous')).toBe(ids[6]);
    expect(releases()).toEqual([ids[6], ...failed, last]);
  });
});

describe('sefid-env and sefid-maintenance', { timeout: 30_000 }, () => {
  const server = () => {
    const s = fakeServer();
    mkdirSync(`${s.root}/releases/r1`);
    writeFileSync(`${s.root}/releases/r1/release.env`, 'GIT_SHA=abc123\nBUILD_TIME=x\n');
    symlinkSync('releases/r1', `${s.root}/current`);
    const secret = 'Zm9vYmFyMTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6';
    const lines = [
      'SITE_URL=https://new.sefiddental.ir',
      'DATABASE_URL=postgres://sefid:deadbeef@127.0.0.1:5432/sefid',
      ...['PAYLOAD_SECRET', 'CRON_SECRET', 'INTERNAL_API_TOKEN', 'IP_HASH_SECRET'].map(
        (n) => `${n}=${n}-${secret}`,
      ),
      'FORM_TOKEN_SECRET=',
      'MEDIA_DIR=/var/lib/sefid/media',
      'MAINTENANCE_MODE=off',
    ];
    writeFileSync(`${s.etc}/app.env`, `${lines.join('\n')}\n`);
    return { ...s, secret };
  };

  it('VPS15 sefid-env names what is set and what is missing, never a value', () => {
    const s = server();
    const r = run(`${SBIN}/sefid-env`, [], s.env);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('  PAYLOAD_SECRET\n');
    expect(r.stdout).toContain('  FORM_TOKEN_SECRET (empty)\n');
    expect(r.stdout).toContain('  GIT_SHA\n');
    expect(r.stdout).toContain('the production start fails: FORM_TOKEN_SECRET');
    for (const value of [s.secret, 'deadbeef', 'abc123', 'new.sefiddental.ir']) {
      expect(r.stdout + r.stderr).not.toContain(value);
    }
  });

  it('VPS16 sefid-maintenance sets the flag, restarts and checks /api/health', () => {
    const s = server();
    const on = run(`${SBIN}/sefid-maintenance`, ['on'], s.env);
    expect(on.stderr).toBe('');
    expect(on.stdout).toContain('"maintenance":true');
    expect(readFileSync(`${s.etc}/app.env`, 'utf8')).toContain('\nMAINTENANCE_MODE=on\n');
    expect(s.calls()).toBe('systemctl restart sefid.service\n');
    expect(run(`${SBIN}/sefid-maintenance`, ['off'], s.env).stdout).toContain(
      '"maintenance":false',
    );
    expect(run(`${SBIN}/sefid-maintenance`, ['maybe'], s.env).status).toBe(2);
  });
});

describe('installed configuration', () => {
  const file = (p: string) => readFileSync(path.join(DIR, 'files', p), 'utf8');

  it('VPS17 sefid.service runs the current release as sefid, sandboxed, JIT allowed', () => {
    const unit = file('etc/systemd/system/sefid.service');
    for (const line of [
      'User=sefid',
      'EnvironmentFile=/etc/sefid/app.env',
      'EnvironmentFile=/srv/sefid/current/release.env',
      'ExecStart=/srv/sefid/current/node/bin/node /srv/sefid/current/app/server.js',
      'WorkingDirectory=/srv/sefid/current/app',
      'Restart=on-failure',
      'NoNewPrivileges=yes',
      'ProtectSystem=strict',
      'ReadWritePaths=/var/lib/sefid/media',
      'CapabilityBoundingSet=',
      'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6',
    ]) {
      expect(unit.split('\n')).toContain(line);
    }
    expect(unit).not.toMatch(/^MemoryDenyWriteExecute=/m);
  });

  it('VPS18 the sshd drop-in sorts before cloud-init and turns passwords off', () => {
    expect('10-sefid.conf' < '50-cloud-init.conf').toBe(true);
    const conf = file('etc/ssh/sshd_config.d/10-sefid.conf');
    for (const line of [
      'PasswordAuthentication no',
      'PermitRootLogin no',
      'AllowUsers deploy',
      'AuthenticationMethods publickey',
      'PermitOpen 127.0.0.1:5432',
    ]) {
      expect(conf.split('\n')).toContain(line);
    }
  });
});
