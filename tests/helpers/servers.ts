// Origins of the standalone servers playwright.config.ts starts (E2E_PORT, default 3000).
const port = Number(process.env.E2E_PORT ?? '3000');

/** The main server: ALLOW_INDEXING unset (false), QA routes on. */
export const APP_ORIGIN = `http://localhost:${port}`;
/** Same artifact with MAINTENANCE_MODE=on. */
export const MAINTENANCE_ORIGIN = `http://localhost:${port + 1}`;
/** Same artifact with ALLOW_INDEXING=true. */
export const INDEXING_ORIGIN = `http://localhost:${port + 2}`;
