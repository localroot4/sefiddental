import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildIconSprite, iconSourceFile } from './iconSprite';
import { ICON_SPRITE_HASH, ICONS } from './icons';

const read = (source: string) => readFileSync(iconSourceFile(source), 'utf8');

describe('icon sprite (freeze F2)', () => {
  it('IS1 the committed hash matches the sprite built from the pinned package and design/brand', () => {
    expect(buildIconSprite(ICONS, read).hash).toBe(ICON_SPRITE_HASH);
  });

  it('IS2 one symbol per name with its viewBox, nothing else: no style, script or link', () => {
    const { svg } = buildIconSprite(ICONS, read);
    const ids = [...svg.matchAll(/<symbol id="([^"]+)" viewBox="[\d. ]+">/g)].map((m) => m[1]);
    expect(ids).toEqual(Object.keys(ICONS));
    expect(svg).not.toMatch(/\sstyle=|<script|href=|\sopacity=/);
    // Regular glyphs and the mark inherit the host fill; no fixed color survives.
    expect(svg).not.toMatch(/fill="#/);
    expect(svg.match(/<symbol id="phone"[^]*?<\/symbol>/)?.[0]).not.toContain('fill=');
  });

  it('IS3 duotone: the tint layer inherits the host fill, the outline is pinned to currentColor', () => {
    const sprite = buildIconSprite(
      { duo: 'phosphor/duotone/x' },
      () =>
        '<svg viewBox="0 0 256 256" fill="currentColor"><path d="M1" opacity="0.2"/><path d="M2"/></svg>',
    );
    expect(sprite.svg).toContain(
      '<symbol id="duo" viewBox="0 0 256 256"><path d="M1"/><path fill="currentColor" fill-opacity="1" d="M2"/></symbol>',
    );
  });

  it('IS4 refuses unsafe or unknown sources', () => {
    const one = (svg: string) => () => buildIconSprite({ x: 'phosphor/regular/x' }, () => svg);
    expect(one('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>')).toThrow(/plain shapes/);
    expect(one('<svg viewBox="0 0 1 1"><path style="fill:red" d="M0"/></svg>')).toThrow(
      /plain shapes/,
    );
    expect(one('<svg viewBox="0 0 1 1"><use href="#a"/></svg>')).toThrow(/plain shapes/);
    expect(one('<svg><path d="M0"/></svg>')).toThrow(/viewBox/);
    expect(() => iconSourceFile('elsewhere/x')).toThrow(/unknown source/);
    expect(iconSourceFile('brand/logo-mark')).toBe('design/brand/logo-mark.svg');
  });
});
