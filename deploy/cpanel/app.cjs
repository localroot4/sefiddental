'use strict';
// Startup file for the panel's "Setup Node.js App" (docs/deploy.md section 7).
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { boot } = require('./boot.cjs');

boot(__dirname)
  .then(({ dataDir, seeded }) => {
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'cpanel_boot',
        node: process.versions.node,
        dataDir,
        seeded,
      }),
    );
    // Built into the package only (scripts/package-cpanel.mjs): a computed URL, not a static path.
    return import(pathToFileURL(path.join(__dirname, 'server', 'server.js')).href);
  })
  .catch((err) => {
    const line = JSON.stringify({
      level: 'fatal',
      msg: 'cpanel_boot_failed',
      reason: String(err?.message ?? err),
    });
    console.error(line);
    // The panel hides stderr on some hosts: keep the reason next to the app, readable in File Manager.
    try {
      fs.writeFileSync(
        path.join(__dirname, 'startup-error.log'),
        `${new Date().toISOString()} ${line}\n`,
        { flag: 'a' },
      );
    } catch {}
    process.exit(1);
  });
