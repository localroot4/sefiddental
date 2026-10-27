import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SERVICE_MARK_OUTLINE } from '@/brand/serviceIconPaths';
import type { CatalogCategory } from '@/lib/data/catalog';
import { PAGE_PATHS } from '@/lib/paths';

import { ServicesSection } from './ServicesSection';

const ACCENTS = ['cosmetic', 'surgery', 'restorative', 'ortho', 'kids'] as const;

const tree: CatalogCategory[] = ACCENTS.map((accent, i) => ({
  id: i + 1,
  key: accent,
  title: `دسته ${i + 1}`,
  navLabel: `دسته ${i + 1}`,
  summary: null,
  icon: null,
  accent,
  standalone: false,
  path: `/خدمات/${accent}`,
  services: [
    { id: i + 10, key: `s${i}`, navLabel: 'خدمت', summary: null, path: '/x', priority: 0 },
  ],
}));

const copy = { heading: 'خدمات', intro: 'پنج دستهٔ درمان.' };

function render(props: Parameters<typeof ServicesSection>[0]): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<ServicesSection {...props} />);
  return host;
}

describe('ServicesSection', () => {
  it('renders nothing without a linkable category', () => {
    expect(render({ tree: [{ ...tree[0]!, path: null }], copy }).innerHTML).toBe('');
  });

  it('is one markup for every layout: a rail, a snap track and the worlds in catalogue order', () => {
    const host = render({ tree, copy });
    const track = host.querySelector(
      '[data-scene="services"] [data-stage] [data-rail] [data-track]',
    );
    expect(track).not.toBeNull();
    expect(track?.hasAttribute('data-lenis-prevent-horizontal')).toBe(true);
    expect(track?.getAttribute('data-worlds')).toBe(ACCENTS.join(' '));
    expect(track?.children).toHaveLength(5);
    expect(host.querySelector('[data-pins], [data-pinned]')).toBeNull();
    expect(host.querySelector('.pin-spacer')).toBeNull();
    // Focus order: the five worlds, then «همهٔ خدمات».
    const hrefs = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([...tree.map((c) => c.path), PAGE_PATHS['services-hub']]);
  });

  it('shows the brand mark as the morph start plus one hidden ink outline per world', () => {
    const host = render({ tree, copy });
    const svgs = host.querySelectorAll('[data-mark] svg');
    expect(svgs).toHaveLength(6);
    expect(svgs[0]?.querySelector('path')?.getAttribute('d')).toBe(SERVICE_MARK_OUTLINE);
    for (const outline of [...svgs].slice(1)) {
      expect(outline.getAttribute('class')).toContain('opacity-0');
      expect(outline.querySelector('use')?.getAttribute('href')).toMatch(/#duo-/);
    }
    expect(host.querySelector('[data-mark]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the progress bar out of the tier 0 page and never writes a style attribute (CSP)', () => {
    const host = render({ tree, copy });
    const bar = host.querySelector('[data-progress]');
    expect(bar?.getAttribute('role')).toBe('progressbar');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
    expect(bar?.getAttribute('aria-valuemax')).toBe('5');
    expect(host.querySelector('[style]')).toBeNull();
    expect(host.querySelector('h2')?.id).toBe('home-services-title');
  });

  it('renders the mark without a heading when the section has no copy', () => {
    const host = render({ tree, copy: null });
    expect(host.querySelector('h2')).toBeNull();
    expect(host.querySelector('[data-mark] svg path')).not.toBeNull();
    expect(host.querySelector('section')?.hasAttribute('aria-labelledby')).toBe(false);
  });
});
