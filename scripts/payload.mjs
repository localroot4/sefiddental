// Runs the Payload CLI; package.json scripts call `node scripts/payload.mjs <command> [args]`.
// shortcut: on Node 22 tsx compiles TypeScript in a loader thread, and on a cold compile cache
// that loader sometimes stalls for good (Payload's own launcher then exited 0 before the script
// ran, and a CI job hung for 45 minutes). A stalled attempt prints nothing more, so after
// STALL_MS of silence it is stopped and run again; the first attempt has warmed the cache.
// The commands it runs (migrate, seed, generate:*) are safe to repeat. Drop once tsx or Node
// fixes the loader.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const STALL_MS = 120_000;
const ATTEMPTS = 3;
const tsx = createRequire(import.meta.url).resolve('tsx/cli');
const inner = fileURLToPath(new URL('./payload-bin.mjs', import.meta.url));

/** Exit code of one attempt, or null when it stalled and was stopped. */
function attempt() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [tsx, inner, ...process.argv.slice(2)], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    let timer;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve(null);
      }, STALL_MS);
    };
    arm();
    child.stdout.on('data', (chunk) => (process.stdout.write(chunk), arm()));
    child.stderr.on('data', (chunk) => (process.stderr.write(chunk), arm()));
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? 1);
    });
  });
}

for (let i = 1; i <= ATTEMPTS; i += 1) {
  const code = await attempt();
  if (code !== null) process.exit(code);
  console.error(
    `payload CLI: no output for ${STALL_MS / 1000} s (attempt ${i} of ${ATTEMPTS}); the TypeScript loader stalled, running it again.`,
  );
}
console.error(`payload CLI: stalled on all ${ATTEMPTS} attempts; stopped.`);
process.exit(1);
