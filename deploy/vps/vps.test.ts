import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

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
  'watch-check.sh',
  'watch-incident.sh',
  'files/usr/local/lib/sefid/common.sh',
  ...readdirSync(SBIN).map((f) => `files/usr/local/sbin/${f}`),
];
const shellcheck = process.env.SHELLCHECK ?? 'shellcheck';
const hasShellcheck = ok(shellcheck, ['--version']);
const hasNginx = ok('nginx', ['-v']);
// sefid-release checks tarballs with the tarfile data filter of Python 3.12.
const hasPython312 = ok('python3', ['-c', 'import tarfile; tarfile.data_filter']);
const hasAge = ok('age', ['--version']);

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

  it('VPS19 app.env: DEMO_CONTENT=true on the preview only; the live switch drops it', () => {
    const dir = tmp();
    const text = readFileSync(path.join(DIR, 'server.env'), 'utf8');
    writeFileSync(`${dir}/live.env`, text.replace(/^PHASE=preview$/m, 'PHASE=live'));
    const render = (config: string, old: string) =>
      provision(`load_config "${config}"; render_app_env "${old}" http://127.0.0.1:3000`).stdout;
    const preview = render('./server.env', `${dir}/missing`);
    expect(preview.split('\n').filter((l) => l.startsWith('DEMO_CONTENT='))).toEqual([
      'DEMO_CONTENT=true',
    ]);
    writeFileSync(`${dir}/app.env`, preview);
    expect(render('./server.env', `${dir}/app.env`)).toBe(preview);
    // Provision with PHASE=live (docs/deploy.md 3.7) keeps the secrets, not the demo line, in
    // any spacing systemd reads.
    writeFileSync(
      `${dir}/app.env`,
      `${preview.trimEnd()}\n DEMO_CONTENT=true\nDEMO_CONTENT = true\n`,
    );
    const live = render(`${dir}/live.env`, `${dir}/app.env`);
    expect(live).not.toMatch(/DEMO_CONTENT/);
    expect(env(live)).toMatchObject({
      SITE_URL: 'https://sefiddental.ir',
      ALLOW_INDEXING: 'true',
      PAYLOAD_SECRET: env(preview).PAYLOAD_SECRET,
    });
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
    // Every server logs errors (full client addresses) to the file kept 2 days (VPS20).
    expect(modern.match(/^\s*server \{$/gm)).toHaveLength(3);
    expect(modern.match(/^\s*error_log \/var\/log\/nginx\/sefid\/error\.log;$/gm)).toHaveLength(3);

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
    mkdirSync(`${dir}/sefid`);
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
    SEFID_BACKUPS: `${dir}/backups`,
    SEFID_CRON_OK: `${dir}/cron.ok`,
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
  return { dir, root, etc, env, stub, tarball, release, target, calls };
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

describe('nginx error log', () => {
  const read = (p: string) => readFileSync(path.join(DIR, p), 'utf8');

  it('VPS20 the error log of every server is rotated daily and kept 2 days at most', () => {
    // The error log of every server, rotated daily with one old file: 2 days at most.
    const rotate = read('files/etc/logrotate.d/sefid-nginx');
    expect(rotate).toMatch(/^\/var\/log\/nginx\/sefid\/\*\.log \{$/m);
    for (const line of ['daily', 'rotate 1', 'create 0640 www-data adm']) {
      expect(rotate).toMatch(new RegExp(`^\\t${line}$`, 'm'));
    }
    const provision = read('provision.sh');
    expect(provision).toContain(
      'put "$FILES/etc/logrotate.d/sefid-nginx" /etc/logrotate.d/sefid-nginx 0644',
    );
  });
});

const HOUR = 3600;
/** Set the modification time of FILE to SECONDS ago. */
const age = (file: string, seconds: number) => {
  const t = Date.now() / 1000 - seconds;
  utimesSync(file, t, t);
};
/** A self-signed certificate valid for DAYS, as sefid-status reads it. */
function certificate(dir: string, days: number) {
  mkdirSync(`${dir}/tls`, { recursive: true });
  const r = run('openssl', [
    'req',
    '-x509',
    '-newkey',
    'ec',
    '-pkeyopt',
    'ec_paramgen_curve:prime256v1',
    '-nodes',
    '-subj',
    '/CN=test',
    '-days',
    String(days),
    '-keyout',
    `${dir}/tls/privkey.pem`,
    '-out',
    `${dir}/tls/fullchain.pem`,
  ]);
  expect(r.status).toBe(0);
}

describe('sefid-status --check', { timeout: 30_000 }, () => {
  /** A healthy server: a fresh nightly dump, a fresh tick, room on disk, a 30-day certificate. */
  const server = () => {
    const s = fakeServer();
    mkdirSync(`${s.root}/releases/r1`);
    writeFileSync(`${s.root}/releases/r1/release.env`, 'GIT_SHA=abc123\n');
    symlinkSync('releases/r1', `${s.root}/current`);
    mkdirSync(`${s.env.SEFID_BACKUPS}/db`, { recursive: true });
    const dump = `${s.env.SEFID_BACKUPS}/db/sefid-20261030T233000Z-nightly.dump`;
    writeFileSync(dump, 'PGDMP');
    age(dump, HOUR);
    writeFileSync(s.env.SEFID_CRON_OK, '');
    certificate(s.etc, 30);
    // size avail mount; the same file system twice is checked once.
    s.stub(
      'df',
      'echo "Size Avail Mounted"; for _ in 1 2; do echo "1000 ${FAKE_AVAIL:-500} /"; done',
    );
    const check = (env: Record<string, string> = {}) => {
      const r = run(`${SBIN}/sefid-status`, ['--check'], { ...s.env, ...env });
      return { status: r.status, lines: r.stdout.trim().split('\n'), stderr: r.stderr };
    };
    return { ...s, dump, check };
  };

  it('VPS21 passes on a healthy server and names each failure on one line', () => {
    const s = server();
    expect(s.check()).toEqual({
      status: 0,
      lines: ['ok: backup, cron, disk, certificate and health'],
      stderr: '',
    });

    // A stale nightly dump; a newer pre-deploy dump does not count.
    age(s.dump, 27 * HOUR);
    writeFileSync(`${s.env.SEFID_BACKUPS}/db/sefid-20261031T080000Z-pre-deploy.dump`, 'PGDMP');
    expect(s.check()).toMatchObject({
      status: 1,
      lines: [`FAIL backup: the newest nightly dump is 27 h old (limit 26 h): ${s.dump}`],
    });
    age(s.dump, HOUR);
    // The last nightly run failed.
    writeFileSync(`${s.env.SEFID_BACKUPS}/last-nightly`, '2026-10-30T23:30:05Z failed exit 1\n');
    expect(s.check().lines).toEqual([
      'FAIL backup: the last nightly run failed: 2026-10-30T23:30:05Z failed exit 1 (sudo journalctl -u sefid-backup.service)',
    ]);
    writeFileSync(`${s.env.SEFID_BACKUPS}/last-nightly`, `2026-10-30T23:30:05Z ok ${s.dump}\n`);
    expect(s.check().status).toBe(0);

    // A full disk: 10 % free, reported once for the file system.
    expect(s.check({ FAKE_AVAIL: '100' })).toMatchObject({
      status: 1,
      lines: ['FAIL disk: / has 10 % free (limit 15 %)'],
    });
    expect(s.check({ FAKE_AVAIL: '150' }).status).toBe(0);

    // A missing tick, then one 10 minutes old.
    rmSync(s.env.SEFID_CRON_OK);
    expect(s.check()).toMatchObject({
      status: 1,
      lines: [
        'FAIL cron: no successful tick since the server started (sudo journalctl -u sefid-cron.service)',
      ],
    });
    writeFileSync(s.env.SEFID_CRON_OK, '');
    age(s.env.SEFID_CRON_OK, 600);
    expect(s.check().lines).toEqual([
      'FAIL cron: the last successful tick was 10 min ago (limit 5 min; sudo journalctl -u sefid-cron.service)',
    ]);
    age(s.env.SEFID_CRON_OK, 60);

    // A certificate that expires tomorrow, and /api/health down: two lines, exit 1.
    certificate(s.etc, 1);
    s.stub('curl', 'echo "curl: (7) Failed to connect"; printf "\\n000"; exit 7');
    const both = s.check();
    expect(both.status).toBe(1);
    expect(both.lines).toHaveLength(2);
    expect(both.lines[0]).toMatch(/^FAIL certificate: expires within 14 days \(notAfter=/);
    expect(both.lines[1]).toBe('FAIL health: /api/health on loopback answered HTTP 000');

    // No nightly dump at all.
    rmSync(`${s.env.SEFID_BACKUPS}/db`, { recursive: true });
    expect(s.check().lines[0]).toBe(`FAIL backup: no nightly dump in ${s.env.SEFID_BACKUPS}/db`);
  });
});

describe('cron tick marker', () => {
  const read = (p: string) => readFileSync(path.join(DIR, p), 'utf8');

  it('VPS22 sefid-cron.service touches the file that sefid-status --check reads', () => {
    expect(read('files/etc/systemd/system/sefid-cron.service').split('\n')).toContain(
      'ExecStartPost=+/usr/bin/touch /run/sefid-cron.ok',
    );
    expect(read('files/usr/local/lib/sefid/common.sh')).toContain(
      ': "${SEFID_CRON_OK:=/run/sefid-cron.ok}"',
    );
  });
});

describe('sefid-restore-check', { timeout: 30_000 }, () => {
  // pg_restore --data-only prints a COPY block per table, one line per row.
  const COPY = [
    'COPY public.a (id, note) FROM stdin;',
    '1\tone',
    '2\ttwo\\nlines',
    '3\tthree',
    '\\.',
    '',
    'COPY public.b (id) FROM stdin;',
    '1',
    '2',
    '\\.',
    '',
    'COPY public.c (id) FROM stdin;',
    '\\.',
    '',
  ].join('\n');

  /** Stub PostgreSQL tools over a file of "table rows" lines that stands for the database. */
  const server = () => {
    const s = fakeServer();
    const b = `${s.env.SEFID_BACKUPS}`;
    mkdirSync(`${b}/db`, { recursive: true });
    mkdirSync(`${b}/media`);
    writeFileSync(`${b}/db/sefid-20261030T233000Z-nightly.dump`, 'PGDMP');
    const files = `${s.dir}/files/media`;
    mkdirSync(`${files}/sub`, { recursive: true });
    writeFileSync(`${files}/one.jpg`, '1');
    writeFileSync(`${files}/sub/two.jpg`, '2');
    const media = `${b}/media/media-20261030T233000Z-nightly.tar.gz`;
    expect(run('tar', ['-C', `${s.dir}/files`, '-czf', media, 'media']).status).toBe(0);
    writeFileSync(`${s.dir}/copy.txt`, COPY);
    writeFileSync(`${s.dir}/db.txt`, 'public.a 3\npublic.b 2\npublic.c 0\n');
    writeFileSync(
      `${s.etc}/app.env`,
      'DATABASE_URL=postgres://sefid:abc@127.0.0.1:5432/sefid\nINTERNAL_ORIGIN=http://127.0.0.1:3000\n',
    );
    const log = `echo "\${0##*/} $*" >> "${s.dir}/calls"`;
    s.stub('runuser', 'while [ "$1" != -- ]; do shift; done; shift; exec "$@"');
    s.stub('createdb', log);
    s.stub('dropdb', log);
    s.stub(
      'pg_restore',
      `case " $* " in *' --data-only '*) cat "${s.dir}/copy.txt" ;; *) cat >/dev/null; ${log} ;; esac`,
    );
    s.stub(
      'psql',
      `case "$*" in
  *pg_database_size*) echo 1000 ;;
  *'DELETE FROM '*) ${log}
    t=$(sed -n 's/.*DELETE FROM \\([^ ]*\\) .*/\\1/p' <<<"$*")
    awk -v t="$t" '$1 == t { $2-- } { print }' "${s.dir}/db.txt" > "${s.dir}/db.new"
    mv "${s.dir}/db.new" "${s.dir}/db.txt" ;;
  *) while read -r line; do
      t=$(sed -n 's/.* FROM \\(.*\\);$/\\1/p' <<<"$line")
      awk -v t="$t" '$1 == t { print t, $2 }' "${s.dir}/db.txt"
    done ;;
esac`,
    );
    // Keeps a copy of the scratch environment, which the script removes at the end.
    s.stub(
      'systemd-run',
      `${log}
for a in "$@"; do case $a in EnvironmentFile=*scratch.env) cp "\${a#EnvironmentFile=}" "${s.dir}/scratch.env" ;; esac; done`,
    );
    s.stub(
      'curl',
      'if [ "$FAKE_HEALTH" = down ]; then printf "\\n000"; exit 7; fi; printf \'{"status":"ok"}\\n200\'',
    );
    // The test user cannot give files to the user sefid.
    s.stub(
      'install',
      'a=(); while [ $# -gt 0 ]; do case $1 in -o | -g) shift 2 ;; *) a+=("$1"); shift ;; esac; done; exec /usr/bin/install "${a[@]}"',
    );
    const drill = (env: Record<string, string> = {}) =>
      run(`${SBIN}/sefid-restore-check`, [], { ...s.env, SEFID_HEALTH_TIMEOUT: '1', ...env });
    const lines = () => s.calls().trim().split('\n');
    return { ...s, media, drill, lines };
  };

  it('VPS23 restores into the scratch database only, compares counts, starts the app, removes all', () => {
    const s = server();
    const r = s.drill();
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('==> row counts match for all 3 tables (5 rows)');
    expect(r.stdout).toContain(
      '==> the current release runs on sefid_restore_check: {"status":"ok"}',
    );
    expect(r.stdout).toContain(`==> media: ${s.media} unpacked, 2 files`);
    const calls = s.lines();
    expect(calls.filter((c) => /^(createdb|dropdb|pg_restore) /.test(c))).toEqual([
      'dropdb --if-exists --force sefid_restore_check',
      'createdb --owner=sefid sefid_restore_check',
      'pg_restore --role=sefid --no-owner --no-privileges --exit-on-error --single-transaction --dbname=sefid_restore_check',
      'dropdb --if-exists --force sefid_restore_check',
    ]);
    expect(calls).toContain('systemctl stop sefid-restore-check-app');
    const scratch = readFileSync(`${s.dir}/scratch.env`, 'utf8');
    expect(scratch).toContain(
      'DATABASE_URL=postgres://sefid:abc@127.0.0.1:5432/sefid_restore_check\nPORT=3009\nINTERNAL_ORIGIN=http://127.0.0.1:3009\n',
    );
    // The scratch media folder, the unpacked archive and the scratch env are gone.
    const media = /^MEDIA_DIR=(.*)\/media$/m.exec(scratch)![1]!;
    expect(media).toMatch(/^\/var\/tmp\/sefid-restore-check\./);
    expect(existsSync(media)).toBe(false);
  });

  it('VPS24 fails when a restored count differs, or the app does not answer, and still cleans up', () => {
    const s = server();
    const tampered = s.drill({ SEFID_RESTORE_CHECK_TAMPER: '1' });
    expect(tampered.status).toBe(1);
    expect(tampered.stderr).toContain('in the dump: public.a 3\nrestored:    public.a 2\n');
    expect(tampered.stderr).toContain(
      'ERROR: row counts differ between the dump and sefid_restore_check',
    );
    expect(s.lines().at(-1)).toBe('dropdb --if-exists --force sefid_restore_check');
    expect(s.calls()).not.toContain('systemd-run');

    const t = server();
    const down = t.drill({ FAKE_HEALTH: 'down' });
    expect(down.status).toBe(1);
    expect(down.stderr).toContain(
      'ERROR: the release did not answer /api/health 200 on sefid_restore_check (HTTP 000',
    );
    expect(t.lines().slice(-2)).toEqual([
      'systemctl stop sefid-restore-check-app',
      'dropdb --if-exists --force sefid_restore_check',
    ]);
    expect(
      existsSync(
        /^MEDIA_DIR=(.*)\/media$/m.exec(readFileSync(`${t.dir}/scratch.env`, 'utf8'))![1]!,
      ),
    ).toBe(false);
  });

  it('VPS30 refuses a dump outside the backup folder, also through a relative path', () => {
    const s = server();
    const ok = `${s.env.SEFID_BACKUPS}/db/sefid-20261030T233000Z-nightly.dump`;
    writeFileSync(`${s.env.SEFID_BACKUPS}/media/sefid-x.dump`, 'PGDMP');
    for (const bad of [
      '/etc/passwd',
      `${s.env.SEFID_BACKUPS}/media/sefid-x.dump`,
      `${s.env.SEFID_BACKUPS}/db/../media/sefid-x.dump`,
      path.relative(DIR, `${s.env.SEFID_BACKUPS}/media/sefid-x.dump`),
      `${s.env.SEFID_BACKUPS}/db/missing.dump`,
    ]) {
      const r = run(`${SBIN}/sefid-restore-check`, [bad], s.env);
      expect(r.status, bad).toBe(1);
      expect(r.stderr).toContain(
        `ERROR: ${bad} is not a file sefid-*.dump in ${s.env.SEFID_BACKUPS}/db`,
      );
    }
    expect(s.calls()).not.toMatch(/createdb|pg_restore|dropdb/);
    // The same dump through a relative path (from deploy/vps, where run() starts) is accepted.
    const r = run(`${SBIN}/sefid-restore-check`, [path.relative(DIR, ok)], {
      ...s.env,
      SEFID_HEALTH_TIMEOUT: '1',
    });
    expect(r.stderr).toBe('');
    expect(r.stdout).toContain(`==> dump: ${ok} (`);
  });
});

describe('sefid-offsite', { timeout: 30_000 }, () => {
  const server = () => {
    const s = fakeServer();
    mkdirSync(`${s.env.SEFID_BACKUPS}/db`, { recursive: true });
    const dump = `${s.env.SEFID_BACKUPS}/db/sefid-20261030T233000Z-nightly.dump`;
    writeFileSync(dump, 'PGDMP fake dump\n');
    s.stub('pg_restore', 'exit 0');
    /** Run with stdout in OUT, as the workflow does (never a terminal). */
    const offsite = (recipient: string, out = `${s.dir}/copy.age`) => {
      const fd = openSync(out, 'w');
      const r = spawnSync(`${SBIN}/sefid-offsite`, [recipient], {
        encoding: 'utf8',
        env: { ...process.env, ...s.env },
        stdio: ['ignore', fd, 'pipe'],
      });
      closeSync(fd);
      return { status: r.status, stderr: r.stderr, out: readFileSync(out) };
    };
    return { ...s, dump, offsite };
  };
  const RECIPIENT = `age1${'q'.repeat(58)}`;

  it('VPS25 refuses a missing or malformed recipient and a stale dump; writes nothing', () => {
    const s = server();
    for (const bad of ['', 'age1notakey', `${RECIPIENT}; id`, RECIPIENT.toUpperCase()]) {
      const r = s.offsite(bad);
      expect(r.status, bad).toBe(1);
      expect(r.stderr).toContain('give the age public key (age1... from age-keygen)');
      expect(r.out.length).toBe(0);
    }
    age(s.dump, 27 * HOUR);
    const stale = s.offsite(RECIPIENT);
    expect(stale.status).toBe(1);
    expect(stale.stderr).toContain('the newest nightly dump is 27 h old (limit 26 h)');
    expect(stale.out.length).toBe(0);
  });

  it.skipIf(!hasAge)('VPS26 writes only age ciphertext, which the private key decrypts', () => {
    const s = server();
    const key = `${s.dir}/owner.key`;
    expect(run('age-keygen', ['-o', key]).status).toBe(0);
    const recipient = run('age-keygen', ['-y', key]).stdout.trim();
    const r = s.offsite(recipient);
    expect(r.status).toBe(0);
    const plain = readFileSync(s.dump);
    const sha = createHash('sha256').update(plain).digest('hex');
    expect(r.stderr).toBe(
      `sefid-offsite: sefid-20261030T233000Z-nightly.dump ${plain.length} bytes sha256 ${sha}\n`,
    );
    expect(r.out.subarray(0, 22).toString()).toBe('age-encryption.org/v1\n');
    expect(r.out.includes('PGDMP')).toBe(false);
    const back = spawnSync('age', ['--decrypt', '--identity', key, `${s.dir}/copy.age`]);
    expect(back.status).toBe(0);
    expect(back.stdout.equals(plain)).toBe(true);
  });
});

describe('off-site wiring', () => {
  const read = (p: string) => readFileSync(path.join(DIR, p), 'utf8');

  it('VPS27 provision installs age; the workflow refuses the recipients sefid-offsite refuses', () => {
    const provision = read('provision.sh');
    expect(provision).toMatch(/bind9-dnsutils age\)/);
    const rule = 'age1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{58}$';
    expect(read('files/usr/local/sbin/sefid-offsite')).toContain(`^${rule}`);
    expect(read('../../.github/workflows/server.yml')).toContain(`^${rule}`);
  });
});

describe('watch-incident.sh', { timeout: 30_000 }, () => {
  it('VPS28 one open issue per incident: open, comment on a change only, close on recovery', () => {
    const dir = tmp();
    mkdirSync(`${dir}/bin`);
    // gh over a state folder: "open" holds the open issue number, issue.json its body and
    // comments, on which "issue view" runs the script's --jq filter with jq.
    writeFileSync(
      `${dir}/bin/gh`,
      `#!/usr/bin/env bash
s="${dir}"
body=; filter=; prev=; for a in "$@"; do [ "$prev" = --body ] && body=$a; [ "$prev" = --jq ] && filter=$a; prev=$a; done
case "$1 $2" in
  "issue list") cat "$s/open" 2>/dev/null || true ;;
  "label create") echo "label $3" >> "$s/calls" ;;
  "issue create") echo 7 > "$s/open"; jq -n --arg b "$body" '{body: $b, comments: []}' > "$s/issue.json"
    echo "create" >> "$s/calls"; echo https://github.com/o/r/issues/7 ;;
  "issue view") jq -r "$filter" "$s/issue.json" ;;
  "issue comment") echo "comment $3" >> "$s/calls"
    jq --arg b "$body" '.comments += [{author: {login: "github-actions"}, body: $b}]' "$s/issue.json" > "$s/new.json"
    mv "$s/new.json" "$s/issue.json" ;;
  "issue close") : > "$s/open"; echo "close $3" >> "$s/calls" ;;
  *) echo "gh: unexpected $*" >&2; exit 1 ;;
esac`,
    );
    chmodSync(`${dir}/bin/gh`, 0o755);
    const watch = (failures: string) => {
      writeFileSync(`${dir}/failures`, failures);
      const r = run(
        path.join(DIR, 'watch-incident.sh'),
        [`${dir}/failures`, 'https://github.com/o/r/actions/runs/1', 'https://new.sefiddental.ir'],
        { PATH: `${dir}/bin:${process.env.PATH}` },
      );
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      return r.stdout.trim();
    };
    const calls = () => (existsSync(`${dir}/calls`) ? readFileSync(`${dir}/calls`, 'utf8') : '');
    const issue = () =>
      JSON.parse(readFileSync(`${dir}/issue.json`, 'utf8')) as {
        body: string;
        comments: { author: { login: string }; body: string }[];
      };
    const SAME = 'incident #7: the same failures as its last report, no new comment';
    const CHANGED = 'incident #7: commented the changed failures';

    expect(watch('')).toBe('every check passed: no incident');
    expect(calls()).toBe('');
    // Two runs with force_failure: the run id in letters makes the second one a change.
    expect(watch('FAIL forced: the input force_failure (run BC)\n')).toBe(
      'opened https://github.com/o/r/issues/7',
    );
    expect(calls()).toBe('label incident\ncreate\n');
    const { body } = issue();
    expect(body).toContain(
      'on https://new.sefiddental.ir:\n\n```\nFAIL forced: the input force_failure (run BC)\n```',
    );
    expect(body).toContain('Run: https://github.com/o/r/actions/runs/1');
    expect(body).toMatch(/<!-- watch:[0-9a-f]{16} -->/);
    expect(watch('FAIL forced: the input force_failure (run BC)\n')).toBe(SAME);
    expect(watch('FAIL forced: the input force_failure (run BD)\n')).toBe(CHANGED);
    // Numbers that grow every hour are the same failure: no comment each hour.
    const stale = (h: number) =>
      `FAIL backup: the newest nightly dump is ${h} h old (limit 26 h): /var/backups/sefid/db/x.dump\n`;
    expect(watch(stale(27))).toBe(CHANGED);
    expect(watch(stale(28))).toBe(SAME);
    // A public comment by someone else that carries the marker of the next failures does not
    // silence them.
    const disk = 'FAIL disk: / has 9 % free (limit 15 %)\n';
    const sig = createHash('sha256')
      .update(disk.replace(/[0-9]+/g, 'N'))
      .digest('hex')
      .slice(0, 16);
    const spoofed = issue();
    spoofed.comments.push({ author: { login: 'mallory' }, body: `ok <!-- watch:${sig} -->` });
    writeFileSync(`${dir}/issue.json`, JSON.stringify(spoofed));
    expect(watch(disk)).toBe(CHANGED);
    expect(issue().comments.at(-1)!.body).toContain(`<!-- watch:${sig} -->`);
    expect(watch(disk)).toBe(SAME);
    expect(calls()).toBe('label incident\ncreate\ncomment 7\ncomment 7\ncomment 7\n');
    expect(watch('')).toBe('every check passed: closed incident #7');
    expect(calls()).toMatch(/comment 7\nclose 7\n$/);
    expect(watch('')).toBe('every check passed: no incident');
  });
});

describe('watch-check.sh', { timeout: 30_000 }, () => {
  it('VPS29 one line per failed check; an old server without --check is a failure', () => {
    const dir = tmp();
    mkdirSync(`${dir}/bin`);
    const stub = (name: string, body: string) => {
      writeFileSync(`${dir}/bin/${name}`, `#!/usr/bin/env bash\n${body}\n`);
      chmodSync(`${dir}/bin/${name}`, 0o755);
    };
    stub(
      'curl',
      'if [ "$FAKE_PUBLIC" = down ]; then echo "curl: (28) timed out" >&2; printf 000; exit 28; fi; printf 200',
    );
    stub(
      'ssh',
      `echo "ssh $*" >> "${dir}/calls"
case $FAKE_SSH in
  ok) echo "ok: backup, cron, disk, certificate and health" ;;
  old) echo "===== health ====="; echo "HTTP 200" ;;
  fail) echo "FAIL cron: the last successful tick was 9 min ago"; echo "FAIL disk: / has 9 % free (limit 15 %)"; exit 1 ;;
  sudo) echo "sudo: a password is required"; exit 1 ;;
  *) echo "ssh: connect to host 2.144.23.111 port 22: Connection timed out"; exit 255 ;;
esac`,
    );
    const check = (env: Record<string, string>) => {
      const r = run(path.join(DIR, 'watch-check.sh'), [], {
        PATH: `${dir}/bin:${process.env.PATH}`,
        SITE_URL: 'https://new.sefiddental.ir',
        SSH_USER: 'deploy',
        SERVER_HOST: '2.144.23.111',
        KEY: '1',
        FORCE_FAILURE: 'false',
        GITHUB_RUN_ID: '1290',
        ...env,
      });
      expect(r.stderr).toBe('');
      expect(r.status).toBe(0);
      return r.stdout;
    };
    expect(check({ FAKE_SSH: 'ok' })).toBe('');
    expect(readFileSync(`${dir}/calls`, 'utf8')).toContain(
      '-o StrictHostKeyChecking=yes -o UserKnownHostsFile=known_hosts',
    );
    expect(readFileSync(`${dir}/calls`, 'utf8')).toMatch(
      / deploy@2\.144\.23\.111 sudo sefid-status --check\n$/,
    );
    expect(check({ FAKE_SSH: 'old' })).toBe(
      'FAIL server: sefid-status --check printed no ok line (run provision)\n',
    );
    expect(check({ FAKE_SSH: 'fail' })).toBe(
      'FAIL cron: the last successful tick was 9 min ago\nFAIL disk: / has 9 % free (limit 15 %)\n',
    );
    expect(check({ FAKE_SSH: 'sudo' })).toBe(
      'FAIL server: sefid-status --check exited 1: sudo: a password is required\n',
    );
    expect(check({ FAKE_SSH: 'none', FAKE_PUBLIC: 'down' })).toBe(
      'FAIL public: https://new.sefiddental.ir/api/health answered HTTP 000 from GitHub curl: (28) timed out\n' +
        'FAIL ssh: no connection to 2.144.23.111: ssh: connect to host 2.144.23.111 port 22: Connection timed out\n',
    );
    expect(check({ KEY: '0', FORCE_FAILURE: 'true' })).toBe(
      'FAIL ssh: the secret SERVER_SSH_KEY is empty or not a private key without a passphrase\n' +
        'FAIL forced: the input force_failure (run BCJA)\n',
    );
  });
});

describe('server workflow and the public log', () => {
  const workflow = (file: string) =>
    parse(readFileSync(path.join(DIR, '../../.github/workflows', file), 'utf8')) as {
      on: { workflow_dispatch: { inputs: Record<string, { description: string }> } };
      jobs: Record<
        string,
        {
          environment?: { name: string; deployment: string | boolean };
          steps: { name?: string; if?: string; run?: string; env?: Record<string, string> }[];
        }
      >;
    };

  it('VPS31 a mask step right after the connection hides every app secret before any output', () => {
    const wf = workflow('server.yml');
    const steps = wf.jobs.server!.steps;
    const at = (name: string) => steps.findIndex((s) => s.name?.startsWith(name));
    const mask = at("Mask the server's secrets");
    expect(mask).toBe(at('Connection to the server') + 1);
    expect(steps[mask]!.if).toBeUndefined();
    // Every later step that reaches the server comes after it; none before it but the connection.
    steps.forEach((s, i) => {
      if (/\bremote\b|ssh -F/.test(s.run ?? '') && i !== mask) {
        expect(i === mask - 1 || i > mask, s.name).toBe(true);
      }
    });
    expect(wf.on.workflow_dispatch.inputs.command!.description).toContain(
      'The log is public. Never print a secret or patient data',
    );

    // The step itself, with `remote` running its command on a sample app.env.
    const dir = tmp();
    mkdirSync(`${dir}/bin`);
    writeFileSync(
      `${dir}/app.env`,
      [
        'SITE_URL=https://new.sefiddental.ir',
        'PAYLOAD_SECRET=payload-secret-value',
        'DATABASE_URL=postgres://sefid:db-password-hex@127.0.0.1:5432/sefid',
        'CRON_SECRET="quoted-cron-secret"',
        'SMTP_PASS=',
        'MEDIA_DIR=/var/lib/sefid/media',
      ].join('\n'),
    );
    writeFileSync(
      `${dir}/bin/remote`,
      `#!/usr/bin/env bash\ncmd=\${1//\\/etc\\/sefid\\/app.env/${dir}/app.env}\neval "\${cmd//sudo /}"\n`,
    );
    chmodSync(`${dir}/bin/remote`, 0o755);
    const r = run('bash', ['-eo', 'pipefail', '-c', steps[mask]!.run!], {
      PATH: `${dir}/bin:${process.env.PATH}`,
    });
    expect(r.stderr).toBe('');
    expect(r.stdout.split('\n').filter(Boolean)).toEqual([
      '::add-mask::payload-secret-value',
      '::add-mask::postgres://sefid:db-password-hex@127.0.0.1:5432/sefid',
      '::add-mask::db-password-hex',
      '::add-mask::quoted-cron-secret',
      'masked 3 values of /etc/sefid/app.env',
    ]);
    // No app.env yet: nothing to mask, and the step passes.
    rmSync(`${dir}/app.env`);
    const none = run('bash', ['-eo', 'pipefail', '-c', steps[mask]!.run!], {
      PATH: `${dir}/bin:${process.env.PATH}`,
    });
    expect(none.status).toBe(0);
    expect(none.stdout).toBe('masked 0 values of /etc/sefid/app.env\n');
  });

  it('VPS32 the jobs with server secrets run in the environment server; vps-smoke does not', () => {
    const server = workflow('server.yml').jobs;
    expect(server.server!.environment).toEqual({
      name: 'server',
      deployment: "${{ inputs.action == 'deploy' }}",
    });
    expect(server['vps-smoke']!.environment).toBeUndefined();
    expect(workflow('watch.yml').jobs.watch!.environment).toEqual({
      name: 'server',
      deployment: false,
    });
  });
});
