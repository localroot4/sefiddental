import { createHash } from 'node:crypto';

/**
 * File of an icons.ts source, `phosphor/<weight>/<name>` or `brand/<name>`, relative to the
 * repository unless `phosphorAssets` (the package's resolved assets folder) is given.
 */
export function iconSourceFile(
  source: string,
  phosphorAssets = 'node_modules/@phosphor-icons/core/assets',
): string {
  const [set, ...rest] = source.split('/');
  if (set === 'phosphor' && rest.length === 2) return `${phosphorAssets}/${rest.join('/')}.svg`;
  if (set === 'brand' && rest.length === 1) return `design/brand/${rest[0]}.svg`;
  throw new Error(`icon sprite: unknown source "${source}"`);
}

/**
 * Builds the icon sprite from the source SVG files (freeze F2). Pure apart from `read`, which the
 * caller wires to the file system: scripts/sync-public-assets.mjs at predev and prebuild, and the
 * unit test. Node runs this file directly, so it imports nothing from the app.
 *
 * - Regular glyphs: paths keep no fill and inherit the host `<svg fill="currentColor">`.
 * - Duotone glyphs: the tint layer (Phosphor marks it `opacity="0.2"`) inherits the host fill and
 *   fill-opacity, so a class such as `fill-cat-kids` colors it; the outline is pinned to
 *   currentColor at full opacity.
 * - The brand mark drops its fixed teal and takes the host fill.
 */
export function buildIconSprite(
  icons: Readonly<Record<string, string>>,
  read: (source: string) => string,
): { svg: string; hash: string } {
  const symbols = Object.entries(icons).map(([id, source]) => {
    const raw = read(source);
    const root = /^\s*<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(raw);
    const viewBox = root && /\sviewBox="([^"]+)"/.exec(root[1] ?? '')?.[1];
    if (!root || !viewBox)
      throw new Error(`icon sprite: ${source} is not a single <svg> with a viewBox`);
    const body = root[2] ?? '';
    // Only plain shapes: anything else could carry script, a style attribute (CSP) or a link.
    if (
      /<(?!\/?(path|circle|rect|line|polyline|polygon|ellipse|g)\b)/.test(body) ||
      /\s(style|on\w+|href)=/.test(body)
    ) {
      throw new Error(`icon sprite: ${source} holds markup other than plain shapes`);
    }
    let inner = body.replace(/\sfill="[^"]*"/g, '');
    if (source.includes('/duotone/')) {
      inner = inner
        .replace(
          /<(path|circle|rect|polygon|ellipse)\b(?![^>]*opacity=)/g,
          '<$1 fill="currentColor" fill-opacity="1"',
        )
        .replace(/\sopacity="0\.2"/g, '');
    }
    return `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`;
  return { svg, hash: createHash('sha256').update(svg).digest('hex').slice(0, 8) };
}
