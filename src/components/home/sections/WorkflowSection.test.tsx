import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Media } from '@/payload-types';

import { PLACE, WorkflowSection, type WorkflowItem } from './WorkflowSection';

const photo = (n: number) =>
  ({
    id: n,
    url: `/api/media/file/workflow-${n}.jpg`,
    alt: `گام ${n}`,
    width: 1200,
    height: 900,
    sizes: {},
  }) as unknown as Media;

const items: WorkflowItem[] = [1, 2, 3, 4].map((n) => ({
  id: `s${n}`,
  title: `گام ${n}`,
  text: `خط ${n}`,
  photo: photo(n),
}));

describe('home scene 5 workflow section (D2, lanes WORKFLOW)', () => {
  it('WS1 renders nothing without the published block', () => {
    expect(renderToStaticMarkup(<WorkflowSection items={[]} />)).toBe('');
  });

  it('WS2 four steps in order, diagonal placement classes, lockup diamonds, lazy 4:3 photos, no style attribute', () => {
    const html = renderToStaticMarkup(
      <WorkflowSection items={items} copy={{ heading: 'روش دیجیتال', intro: null }} />,
    );
    expect(html).toContain('data-scene="workflow"');
    expect(html).toContain('data-home-section="workflow"');
    expect(html).toContain('data-family="G"');
    expect(html).toContain('data-world-slot="workflow"');
    expect(html).toContain('روش دیجیتال');
    const steps = html.match(/<li [^>]*data-workflow-step=""[^>]*>/g) ?? [];
    expect(steps).toHaveLength(4);
    steps.forEach((li, i) => expect(li).toContain(PLACE[i]));
    // Never `relative`: the insets would then offset the vertical list.
    steps.forEach((li) => expect(li).not.toMatch(/\brelative\b/));
    expect([...html.matchAll(/#lockup-diamond-(\d)/g)].map((m) => m[1])).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    expect(html.match(/<img [^>]*loading="lazy"/g)).toHaveLength(4);
    // The list's photo column from 1280 px (592 px) is wider than the diagonal's step (448 px).
    expect(
      html.match(/sizes="\(min-width: 1280px\) 37rem, \(min-width: 1024px\) 28rem/g),
    ).toHaveLength(4);
    expect(html.match(/aspect-\[4\/3\]/g)).toHaveLength(4);
    expect(html.match(/data-workflow-warm=""/g)).toHaveLength(4);
    expect(html).not.toMatch(/ style="/);
    // The tier-0 HTML hides nothing: neither attribute the scene adds is there.
    expect(html).not.toContain('data-diagonal=""');
    expect(html).not.toContain('data-reveal=""');
    // The timeline line (phone spec scene 5, D24: in the HTML at every tier, full at tier 0): one
    // decorative span beside the list, which holds only its steps.
    const root = document.createElement('div');
    root.innerHTML = html;
    const lines = root.querySelectorAll('[data-workflow-line]');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.getAttribute('aria-hidden')).toBe('true');
    expect(lines[0]?.parentElement?.hasAttribute('data-workflow-stage')).toBe(true);
    expect(Array.from(root.querySelector('ol')!.children, (c) => c.tagName)).toEqual([
      'LI',
      'LI',
      'LI',
      'LI',
    ]);
  });

  it('WS3 an unpopulated photo (an id) gets the labeled placeholder; a fifth item is dropped', () => {
    const html = renderToStaticMarkup(
      <WorkflowSection
        items={[{ ...items[0]!, photo: 7 }, ...items.slice(1), { ...items[3]!, title: 'پنجم' }]}
      />,
    );
    expect(html).toContain('جای عکس');
    expect(html).toContain('گام 1');
    expect(html.match(/data-workflow-step=""/g)).toHaveLength(4);
    expect(html).not.toContain('پنجم');
  });
});
