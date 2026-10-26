import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { HomeHero } from './HomeHero';

// The booking island's data readers need Payload; the order test needs only the markup around it.
vi.mock('@/components/booking/BookingForm', () => ({ BookingForm: () => null }));

const set = { avif: 'a.avif 800w', other: 'a.webp 800w', otherType: 'image/webp' };

describe('home hero markup', () => {
  it('HH1 the scrim (H1 and subtext) comes before the photo in the streamed HTML', () => {
    const html = renderToStaticMarkup(
      <HomeHero
        title="عنوان"
        subtext="زیرعنوان"
        image={{
          wide: set,
          tall: set,
          img: { src: '/a.webp', width: 800, height: 1000, alt: 'عکس' },
          preloadHref: '/a.avif',
          placeholder: false,
        }}
        relief
        phone="+982100000000"
        facts={[{ value: 'یک' }]}
      />,
    );
    // A first frame that holds only the photo paints it under the header on phones (LCP, shift).
    expect(html.indexOf('id="hero-h1"')).toBeGreaterThan(-1);
    expect(html.indexOf('id="hero-sub"')).toBeLessThan(html.indexOf('<picture'));
    expect(html.indexOf('id="hero-h1"')).toBeLessThan(html.indexOf('<picture'));
  });
});
