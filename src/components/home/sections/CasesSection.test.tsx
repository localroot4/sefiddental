import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { PAGE_PATHS } from '@/lib/paths';
import type { Media } from '@/payload-types';

import { CasesSection } from './CasesSection';

// mediaPath reads the environment; the media origin is not under test here.
vi.mock('@/lib/env', () => ({
  readEnv: () => ({ mediaPublicOrigin: undefined, demoContent: false }),
}));

const photo = (id: number): Media =>
  ({ id, alt: 'نمونه', url: `/api/media/file/${id}.jpg`, width: 800, height: 800 }) as Media;

const pair = (id: number) =>
  ({
    id,
    title: `نمونهٔ ${id}`,
    before: photo(id * 10),
    after: photo(id * 10 + 1),
    service: null,
  }) as never;

describe('scene 6 markup', () => {
  it('CS1 three published cases: the slider and two thumbnails, and no link to the cases page (gap 6, it has no route)', () => {
    const root = document.createElement('div');
    root.innerHTML = renderToStaticMarkup(
      <CasesSection cases={[pair(1), pair(2), pair(3)]} copy={{ heading: 'h', intro: null }} />,
    );
    expect(root.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(root.querySelectorAll('ul > li')).toHaveLength(2);
    expect(root.querySelector(`a[href="${PAGE_PATHS.cases}"]`)).toBeNull();
    expect(root.querySelectorAll('a')).toHaveLength(0);
  });
});
