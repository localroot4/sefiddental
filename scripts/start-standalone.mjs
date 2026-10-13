// Starts the artifact that deploys: `.next/standalone/server.js`, after copying `public/` and
// `.next/static/` next to it (Next leaves both out of the standalone folder). Environment comes
// from the shell, then the repo .env; PORT and HOSTNAME pass through. Used by e2e, Lighthouse and
// local production checks.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const standalone = path.join(root, '.next', 'standalone');
const server = path.join(standalone, 'server.js');

if (!existsSync(server)) {
  console.error(
    'start-standalone: .next/standalone/server.js is missing. Run `npm run build` first.',
  );
  process.exit(1);
}

for (const [from, to] of [
  [path.join(root, 'public'), path.join(standalone, 'public')],
  [path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static')],
]) {
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

// The build removes .env from the artifact (postbuild), so read the repo copy here. Values set
// in the shell win: process.loadEnvFile never overrides a variable that is already set.
const envFile = path.join(root, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const env = { ...process.env };
// server.js chdirs into .next/standalone: resolve a relative SQLite path against the repo root.
const db = env.DATABASE_URL;
if (db?.startsWith('file:') && !path.isAbsolute(db.slice('file:'.length))) {
  env.DATABASE_URL = `file:${path.resolve(root, db.slice('file:'.length))}`;
}

const child = spawn(process.execPath, [server], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (child.exitCode !== null || child.signalCode !== null) process.exit(1);
    child.kill(signal);
  });
}
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
