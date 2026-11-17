// The production dependency audit (CI): `npm audit --omit=dev` fails on any high or critical
// advisory, except one named in ALLOWED below with its reason and an expiry date. An entry
// past its date fails again, so an exception never outlives its review. A failed audit run (no
// JSON, a network error) fails too: unknown is never clean.
//   node scripts/audit-prod.mjs
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Advisories accepted for a while, each with why it cannot reach this site and until when.
 * @type {readonly { id: string, reason: string, expires: string }[]}
 */
export const ALLOWED = [
  {
    // picomatch <= 4.0.7 (every release so far): a ReDoS on a crafted glob. It reaches the
    // production tree through @payloadcms/next (sass's file watcher), @payloadcms/storage-s3
    // and payload's type generator, which match only globs written in their own code, never
    // one from a request. No fixed release exists yet. Owner's decision, 2026-11-17.
    id: 'GHSA-fc5q-39xc-vjpf',
    reason: 'picomatch ReDoS; globs are never user input here; no fixed release yet',
    expires: '2026-12-01',
  },
];

const FAILING = new Set(['high', 'critical']);

/**
 * The high and critical advisories of an `npm audit --json` report that no unexpired ALLOWED
 * entry covers, and the ones an entry covers (each once, by its GHSA id).
 * @param {{ vulnerabilities?: Record<string, { via: (string | { url?: string, title?: string, severity?: string, name?: string })[] }> }} report
 * @param {readonly { id: string, reason: string, expires: string }[]} allowed
 * @param {Date} now
 */
export function judge(report, allowed, now) {
  const today = now.toISOString().slice(0, 10);
  const failing = new Map();
  const excused = new Map();
  const expired = new Set();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via) {
      // A string names another vulnerable package: its own advisories are counted there.
      if (typeof via === 'string' || !FAILING.has(via.severity ?? '')) continue;
      const id = /GHSA-[\w-]+/.exec(via.url ?? '')?.[0] ?? via.url ?? via.title ?? 'unknown';
      const entry = allowed.find((a) => a.id === id);
      const row = { id, severity: via.severity, package: via.name, title: via.title };
      if (entry && today <= entry.expires) excused.set(id, { ...row, entry });
      else {
        if (entry) expired.add(id);
        failing.set(id, row);
      }
    }
  }
  return { failing: [...failing.values()], excused: [...excused.values()], expired: [...expired] };
}

function main() {
  const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8' });
  let report;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    console.error(`audit-prod: npm audit gave no report (exit ${run.status}).`);
    console.error(run.stderr || run.stdout);
    process.exit(1);
  }
  if (report.error) {
    console.error(`audit-prod: npm audit failed: ${report.error.summary ?? report.error.code}`);
    process.exit(1);
  }
  const { failing, excused, expired } = judge(report, ALLOWED, new Date());
  for (const e of excused) {
    console.log(
      `excused until ${e.entry.expires}: ${e.id} (${e.package}, ${e.severity}): ${e.entry.reason}`,
    );
  }
  for (const id of expired) {
    console.error(
      `audit-prod: the exception for ${id} has expired: review it, then update or remove it.`,
    );
  }
  for (const f of failing) {
    console.error(`${f.severity}: ${f.id} in ${f.package}: ${f.title}`);
  }
  if (failing.length > 0) {
    console.error(
      `audit-prod: ${failing.length} high or critical advisory(ies) in production dependencies.`,
    );
    process.exit(1);
  }
  console.log('audit-prod: no high or critical advisory left in production dependencies.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main();
}
