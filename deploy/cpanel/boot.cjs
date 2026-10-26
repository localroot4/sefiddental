'use strict';
// Start-up for a shared cPanel or DirectAdmin "Node.js" host (docs/deploy.md section 7). Those
// panels run the app through Phusion Passenger or LiteSpeed's lsnode: they require() a CommonJS
// startup file and take over the app's first http listen(), so there is no shell, no TCP port of
// our own and often no PostgreSQL. CommonJS on purpose: the loaders require() this file.
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

// Generated once per data folder when the panel does not set them (src/lib/env.ts).
const SECRET_NAMES = [
  'PAYLOAD_SECRET',
  'FORM_TOKEN_SECRET',
  'CRON_SECRET',
  'IP_HASH_SECRET',
  'INTERNAL_API_TOKEN',
];
const INTERNAL_PREFIX = '/api/internal/';

/** The data folder: outside the release, so a new release never touches the database or media. */
function dataDirOf(env) {
  return env.SEFID_DATA_DIR || path.join(os.homedir(), 'sefid-data');
}

/**
 * Secrets the panel left empty come from `<data>/secrets.json` (0600), created on the first start
 * with 48 random bytes each. Two processes starting at once both read the file the first one
 * created ('wx'), so they never hold different secrets. Values are never printed.
 */
function loadSecrets(env, dataDir) {
  const file = path.join(dataDir, 'secrets.json');
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  let stored;
  try {
    stored = read();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    const fresh = {};
    for (const name of SECRET_NAMES) fresh[name] = crypto.randomBytes(48).toString('base64url');
    try {
      fs.writeFileSync(file, JSON.stringify(fresh, null, 2), { mode: 0o600, flag: 'wx' });
      stored = fresh;
    } catch (raced) {
      if (raced.code !== 'EEXIST') throw raced;
      stored = read();
    }
  }
  for (const name of SECRET_NAMES) {
    if (!env[name]) env[name] = stored[name];
  }
  // The cron job reads its bearer token from here: `$(cat ~/sefid-data/cron-secret)`.
  const cron = path.join(dataDir, 'cron-secret');
  let current = null;
  try {
    current = fs.readFileSync(cron, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  if (current !== env.CRON_SECRET) fs.writeFileSync(cron, env.CRON_SECRET, { mode: 0o600 });
}

/** Defaults for this host type; anything the panel sets wins. */
function applyDefaults(env, dataDir, release) {
  const defaults = {
    DATABASE_URL: `file:${path.join(dataDir, 'sefid.db')}`,
    MEDIA_DIR: path.join(dataDir, 'media'),
    DB_PUSH: 'false',
    // The panel's web server is the one proxy in front (docs/deploy.md 2.4).
    TRUST_PROXY_HEADERS: 'true',
    TRUSTED_PROXY_HOPS: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    TZ: 'UTC',
    GIT_SHA: release.gitSha,
    BUILD_TIME: release.buildTime,
  };
  for (const [name, value] of Object.entries(defaults)) {
    if (!env[name] && value) env[name] = value;
  }
}

/**
 * First start on the default SQLite file: copy the seeded database and its media from the release.
 * link() refuses an existing target, so a second process or a later release never overwrites data.
 */
function seedFirstRun(env, dataDir, seedDir) {
  const dbFile = path.join(dataDir, 'sefid.db');
  if (env.DATABASE_URL !== `file:${dbFile}`) return false;
  if (fs.existsSync(dbFile) || !fs.existsSync(path.join(seedDir, 'sefid.db'))) return false;
  const tmp = `${dbFile}.seed-${process.pid}`;
  fs.copyFileSync(path.join(seedDir, 'sefid.db'), tmp);
  try {
    fs.linkSync(tmp, dbFile);
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
    return false;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  const media = path.join(seedDir, 'media');
  if (fs.existsSync(media)) fs.cpSync(media, env.MEDIA_DIR, { recursive: true, force: false });
  return true;
}

/**
 * The proxy reaches /api/internal/* over HTTP (src/lib/http/proxyConfig.ts). Under the panel's
 * loader the app has no TCP port, so a second server on loopback hands those paths, and only
 * those, to Next's own request handler. It listens through net.Server's listen: the loaders
 * replace http.Server's, and a second call there throws.
 */
function startInternalListener(env, getNextServer) {
  const server = http.createServer((req, res) => {
    const next = getNextServer();
    if (!next || !(req.url || '').startsWith(INTERNAL_PREFIX)) {
      res.statusCode = next ? 404 : 503;
      res.end();
      return;
    }
    next.emit('request', req, res);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    net.Server.prototype.listen.call(server, 0, '127.0.0.1', () => {
      env.INTERNAL_ORIGIN = `http://127.0.0.1:${server.address().port}`;
      resolve(server);
    });
  });
}

/**
 * Captures the first http server created after it: Next's. Its requests get
 * `X-Forwarded-Proto: https` when the panel's web server sent none: the panel ends TLS and forces
 * HTTPS (docs/deploy.md 7.3), but without the header Next fills in `http` and the canonical
 * redirect (src/lib/http/canonical.ts) would send every visitor to the same https URL forever.
 */
function captureNextServer() {
  let captured = null;
  const create = http.createServer;
  http.createServer = function createServer(...args) {
    const i = captured ? -1 : args.findIndex((arg) => typeof arg === 'function');
    if (i !== -1) {
      const listener = args[i];
      args[i] = (req, res) => {
        req.headers['x-forwarded-proto'] ??= 'https';
        return listener(req, res);
      };
    }
    const server = create.apply(this, args);
    if (!captured) captured = server;
    return server;
  };
  return () => captured;
}

function readRelease(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
  } catch {
    return {};
  }
}

/** Run before Next starts; returns what the entry needs. */
async function boot(root, env = process.env) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) {
    throw new Error(
      `Node ${process.versions.node} is too old: choose Node 22.18 or newer in the panel's Node.js app settings.`,
    );
  }
  const dataDir = dataDirOf(env);
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  loadSecrets(env, dataDir);
  applyDefaults(env, dataDir, readRelease(root));
  fs.mkdirSync(env.MEDIA_DIR, { recursive: true });
  const seeded = seedFirstRun(env, dataDir, path.join(root, 'seed'));
  // The listener first: the capture keeps the first server created after it, which must be Next's.
  let getNextServer = () => null;
  if (!env.INTERNAL_ORIGIN) await startInternalListener(env, () => getNextServer());
  getNextServer = captureNextServer();
  return { dataDir, seeded };
}

module.exports = {
  boot,
  loadSecrets,
  applyDefaults,
  seedFirstRun,
  startInternalListener,
  captureNextServer,
  SECRET_NAMES,
};
