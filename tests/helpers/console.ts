// Collects console errors and uncaught page errors, for "0 console errors" checks.
import type { Page } from '@playwright/test';

/**
 * Starts collecting before navigation; call the returned function at the end of the test.
 * Chrome logs "Failed to load resource" for every document with a non-2xx status (404, 410,
 * 500, 503). That line is the status the test asserts anyway, so it is dropped when its
 * location is the document itself; the same line for any other URL still counts.
 */
export function watchConsoleErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const { url } = message.location();
    const ownStatus =
      message.text().startsWith('Failed to load resource') && url === page.mainFrame().url();
    if (!ownStatus) errors.push(`${message.text()} (${url || 'no location'})`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return () => errors;
}
