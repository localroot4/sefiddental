import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Testimonial } from '@/payload-types';

import { JourneySection } from './JourneySection';
import { VoicesSection } from './VoicesSection';

const voice = {
  id: 1,
  patientLabel: 'بیمار نمونه',
  quote: 'نقل قول',
  poster: null,
  service: null,
} as unknown as Testimonial & { service: null };

/** The section's server HTML as a DOM. */
function voicesDom(count: number): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(
    <VoicesSection
      testimonials={Array.from({ length: count }, (_, i) => ({ ...voice, id: i + 1 }))}
      copy={{ heading: 'h', intro: null }}
    />,
  );
  return root;
}

const classes = (el: Element | null) => (el?.getAttribute('class') ?? '').split(' ');

describe('scenes 8 and 9 markup', () => {
  it('VS1 the voices row is the focusable world slot the buttons control; under 1024 px it is the snap row at every tier, the buttons keep their box invisible and inert (D24); no video', () => {
    const root = voicesDom(2);
    const row = root.querySelector('ul')!;
    expect(row.id).toBe('home-voices-row');
    expect(row.getAttribute('data-world-slot')).toBe('voices');
    expect(row.hasAttribute('data-lenis-prevent-horizontal')).toBe(true);
    expect(row.getAttribute('aria-labelledby')).toBe('home-voices-title');
    expect(row.getAttribute('tabindex')).toBe('0');
    expect(row.hasAttribute('data-carousel')).toBe(false); // the attribute comes from voices.ts only
    // The row under 1024 px in the server HTML (no tier attribute decides it).
    expect(classes(row)).toEqual(
      expect.arrayContaining([
        'max-lg:grid-flow-col',
        'max-lg:overflow-x-auto',
        'max-lg:snap-x',
        'max-lg:snap-mandatory',
        'lg:grid-cols-3',
        'lg:data-carousel:grid-flow-col',
      ]),
    );
    expect(classes(row).some((c) => /^(?:md:|data-carousel:)/.test(c))).toBe(false);
    const nav = root.querySelector('[data-voices-nav]')!;
    expect(nav.hasAttribute('hidden')).toBe(false);
    expect(nav.hasAttribute('inert')).toBe(true);
    expect(nav.hasAttribute('data-single')).toBe(false);
    expect(classes(nav)).toEqual(
      expect.arrayContaining([
        'invisible',
        'flex',
        'lg:hidden',
        'lg:peer-data-carousel/voices:flex',
      ]),
    );
    const buttons = nav.querySelectorAll('button');
    expect(Array.from(buttons, (b) => b.getAttribute('aria-controls'))).toEqual([
      'home-voices-row',
      'home-voices-row',
    ]);
    expect(Array.from(buttons, (b) => b.getAttribute('data-dir'))).toEqual(['-1', '1']);
    expect(root.querySelector('video')).toBeNull();
    expect(root.querySelector('[style]')).toBeNull();
  });

  it('VS2 one voice gets no buttons at any tier: data-single hides their box', () => {
    const nav = voicesDom(1).querySelector('[data-voices-nav]')!;
    expect(nav.hasAttribute('data-single')).toBe(true);
    expect(classes(nav)).toContain('data-single:hidden');
  });

  it("JS1 the warm layer is the journey section's first sibling, hidden from readers, with no style attribute", () => {
    const html = renderToStaticMarkup(
      <JourneySection
        steps={[{ title: 't', text: 'x' }]}
        guidePath={null}
        copy={{ heading: 'h', intro: null }}
      />,
    );
    expect(html.indexOf('data-warm-layer=""')).toBeLessThan(
      html.indexOf('data-home-section="journey"'),
    );
    // 100lvh from the top, not inset 0: the box never resizes with a phone's toolbar.
    expect(html).toMatch(
      /<div data-warm-layer="" aria-hidden="true" class="[^"]*fixed inset-x-0 top-0 -z-1 h-lvh[^"]*"/,
    );
    expect(html).not.toMatch(/ style="/);
  });
});
