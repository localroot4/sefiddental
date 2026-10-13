import localFont from 'next/font/local';

/**
 * The family name equals the exported constant, so `design/tokens.css`
 * (`"Vazirmatn", "Vazirmatn Fallback"`, `"Estedad"`) resolves without edits.
 * Both are called in a root layout, so both are preloaded on every route.
 */
// Source is the bracket-free copy that scripts/sync-public-assets.mjs writes (predev, prebuild).
// With 'Vazirmatn[wght]' the preload Link header percent-encodes the brackets and @font-face
// does not, so the browser fetched the same font twice under two URLs.
export const Vazirmatn = localFont({
  src: '../../public/fonts/Vazirmatn-wght.woff2',
  weight: '400 700',
  style: 'normal',
  display: 'swap',
  variable: '--font-vazirmatn',
  fallback: ['system-ui', 'sans-serif'],
});

// Persian-only display face: no Latin letters, so no metric-adjusted fallback; the token
// stack falls back to Vazirmatn.
export const Estedad = localFont({
  src: '../../design/fonts/Estedad-Bold.woff2',
  weight: '700',
  style: 'normal',
  display: 'swap',
  variable: '--font-estedad',
  adjustFontFallback: false,
});
