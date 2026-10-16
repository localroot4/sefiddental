import { scrubDeep } from '@/lib/log/redact';

const store = globalThis as typeof globalThis & { __sefidConsoleScrubbed?: true };

/**
 * Next prints every uncaught server error itself, with console.error, before onRequestError and
 * outside pino (route-module.js onRequestError): strings and errors written there get the
 * logger's scrub, so no phone or bound query value reaches stderr either (S3). Once per process;
 * src/instrumentation.ts calls it.
 */
export function scrubConsole(target: Pick<Console, 'error' | 'warn'> = console): void {
  if (target === console) {
    if (store.__sefidConsoleScrubbed) return;
    store.__sefidConsoleScrubbed = true;
  }
  for (const level of ['error', 'warn'] as const) {
    const write = target[level].bind(target);
    target[level] = (...args: unknown[]) =>
      write(
        ...args.map((arg) =>
          typeof arg === 'string' || arg instanceof Error ? scrubDeep(arg) : arg,
        ),
      );
  }
}
