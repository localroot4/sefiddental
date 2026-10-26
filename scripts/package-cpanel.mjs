// Packs the built app for a shared cPanel or DirectAdmin "Node.js" host (docs/deploy.md section
// 7): `npm run build`, then `node scripts/package-cpanel.mjs`. Writes release/cpanel/ and
// release/sefid-cpanel-<sha>.zip. The zip's root is the panel's "Application root":
//   app.cjs, boot.cjs   startup file (deploy/cpanel/), no node_modules beside it (the panel's
//                       Node selector keeps that name for its own virtual environment)
//   server/             Next's standalone server with public/ and .next/static/
//   seed/               a migrated, seeded SQLite database and its media, copied on the first start
//   release.json        commit and build time for /api/health and the status view
// The seed runs the real seeder: it needs the repository .env (or the same variables) like
// `npm run seed`. Nothing secret is written into the package.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const standalone = path.join(root, '.next/standalone');
const out = path.join(root, 'release/cpanel');
const run = (cmd, args, env = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

if (!existsSync(path.join(standalone, 'server.js'))) {
  console.error('package-cpanel: no standalone build. Run `npm run build` first.');
  process.exit(1);
}
const sha = execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { cwd: root })
  .toString()
  .trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'src', 'deploy'], { cwd: root })
  .toString()
  .trim();
if (dirty && !process.argv.includes('--allow-dirty')) {
  console.error('package-cpanel: src/ or deploy/ has uncommitted changes; commit them first.');
  process.exit(1);
}

rmSync(path.join(root, 'release'), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The server. Never the repository's local media folder or an env file that tracing picked up.
const skip = new Set(['media', '.env', '.env.production', '.env.local']);
cpSync(standalone, path.join(out, 'server'), {
  recursive: true,
  filter: (src) => path.dirname(src) !== standalone || !skip.has(path.basename(src)),
});
cpSync(path.join(root, 'public'), path.join(out, 'server/public'), { recursive: true });
cpSync(path.join(root, '.next/static'), path.join(out, 'server/.next/static'), { recursive: true });

for (const file of ['app.cjs', 'boot.cjs']) {
  cpSync(path.join(root, 'deploy/cpanel', file), path.join(out, file));
}
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
writeFileSync(
  path.join(out, 'package.json'),
  `${JSON.stringify(
    {
      name: pkg.name,
      version: pkg.version,
      private: true,
      main: 'app.cjs',
      scripts: { start: 'node app.cjs' },
      engines: pkg.engines,
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  path.join(out, 'release.json'),
  `${JSON.stringify({ gitSha: sha, buildTime: new Date().toISOString() })}\n`,
);

// The seeded database: the production migrations, then the seeder, as `npm run seed` does.
if (!process.argv.includes('--no-seed')) {
  const seed = path.join(out, 'seed');
  mkdirSync(path.join(seed, 'media'), { recursive: true });
  const env = {
    DATABASE_URL: `file:${path.join(seed, 'sefid.db')}`,
    MEDIA_DIR: path.join(seed, 'media'),
    DB_PUSH: 'false',
  };
  run(process.execPath, ['scripts/payload.mjs', 'migrate'], env);
  const log = execFileSync(process.execPath, ['scripts/payload.mjs', 'run', 'src/seed/index.ts'], {
    cwd: root,
    env: { ...process.env, ...env },
  }).toString();
  process.stdout.write(log);
  // payload run can exit 0 before the script ran (scripts/payload.mjs): require the summary.
  if (!log.includes('seed: mode')) {
    console.error('package-cpanel: the seeder printed no summary line; the seed is incomplete.');
    process.exit(1);
  }
  // One self-contained file: fold the write-ahead log back in (the app turns WAL on again).
  const { createClient } = await import('@libsql/client');
  const db = createClient({ url: env.DATABASE_URL });
  await db.execute('PRAGMA wal_checkpoint(TRUNCATE)');
  await db.execute('PRAGMA journal_mode=DELETE');
  db.close();
  for (const ext of ['-wal', '-shm']) rmSync(path.join(seed, `sefid.db${ext}`), { force: true });
}

const zip = `sefid-cpanel-${sha}.zip`;
execFileSync('zip', ['-qr', path.join('..', zip), '.'], { cwd: out, stdio: 'inherit' });
console.log(`package-cpanel: release/${zip}`);
