/** localStorage key of the explicit theme choice: 'light' | 'dark'; absent = system. */
export const THEME_STORAGE_KEY = 'sefid-theme';

/**
 * Runs in <head> before first paint so an explicit choice never flashes. Exact bytes matter:
 * the CSP lists this script's hash, so any edit must update THEME_INIT_SCRIPT_SHA256.
 */
export const THEME_INIT_SCRIPT =
  '(function(){try{var t=localStorage.getItem("sefid-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}})();';

/** base64 SHA-256 of THEME_INIT_SCRIPT, for `script-src 'sha256-…'`. */
export const THEME_INIT_SCRIPT_SHA256 = 'sbC0eqnCTp86E6nW5x/TLpLLa2TclDnb2W4oNKfyt58=';
