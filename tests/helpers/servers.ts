// Origins of the standalone servers playwright.config.ts starts (E2E_PORT, default 3000).
const port = Number(process.env.E2E_PORT ?? '3000');

/**
 * The WebKit run (E2E_ENGINE=webkit) reaches the main server through scripts/tls-front.mjs on
 * port + 3, as browsers reach production: WebKit on Linux keeps no Secure cookie from
 * http://localhost, and the form and flash cookies are `__Host-` (Secure).
 */
export const TLS_FRONT = process.env.E2E_ENGINE?.trim() === 'webkit';
export const TLS_FRONT_PORT = port + 3;
/** The main server's public origin (its SITE_URL): ALLOW_INDEXING unset (false), QA routes on. */
export const APP_ORIGIN = TLS_FRONT
  ? `https://localhost:${TLS_FRONT_PORT}`
  : `http://localhost:${port}`;
/** Same artifact with MAINTENANCE_MODE=on. */
export const MAINTENANCE_ORIGIN = `http://localhost:${port + 1}`;
/** Same artifact with ALLOW_INDEXING=true. */
export const INDEXING_ORIGIN = `http://localhost:${port + 2}`;
